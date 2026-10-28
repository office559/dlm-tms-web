import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

/**
 * Dispecerat: pontajul lunar al vehiculelor, pe firme.
 *
 * O „perioadă la muncă" a unui vehicul se deduce automat din curse: cursele separate de cel mult
 * STINT_GAP_DAYS zile fără nicio cursă formează o singură perioadă (de la ziua încărcării primei curse
 * până la ziua descărcării ultimei). Se numără TOATE zilele perioadei, cu sau fără cursă.
 * Dispecerul poate corecta o perioadă (data de plecare / de întoarcere) sau adăuga una; o corecție
 * înlocuiește perioada automată pe care o suprapune. Absențele (concediu / service / staționare)
 * se introduc manual și se scad din zilele lucrate.
 *
 * Datele sunt text ISO „AAAA-LL-ZZ" (zile calendaristice, fără oră).
 */

export const STINT_GAP_DAYS = 5;

export type AbsenceReason = "concediu" | "service" | "stationare";
export const ABSENCE_REASONS: AbsenceReason[] = ["concediu", "service", "stationare"];

export type Absence = { id: string; start: string; end: string; reason: AbsenceReason; note: string | null };
export type Stint = { start: string; end: string; source: "auto" | "manual"; id: string | null };

export type DispatchVehicle = {
  id: string;
  plate: string;
  /** Un caracter pe zi: w = la muncă, a = absență, h = acasă / fără perioadă. */
  days: string;
  worked: number;
  stints: Stint[];
  absences: Absence[];
};

export type DispatchFirm = {
  id: string | null;
  name: string;
  worked: number;
  vehicles: DispatchVehicle[];
};

export type DispatchMonth = {
  month: string; // AAAA-LL
  daysInMonth: number;
  /** Ziua săptămânii a zilei 1: 0 = luni ... 6 = duminică. */
  firstDow: number;
  firms: DispatchFirm[];
};

const DAY_MS = 86400000;

export function toDayNum(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromDayNum(toDayNum(s)) === s;
}

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** Luna curentă („AAAA-LL") în fusul orar ales. */
export function currentMonth(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .slice(0, 7);
}

/** Ziua de azi („AAAA-LL-ZZ") în fusul orar ales. */
export function todayIso(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

type Range = { start: string; end: string };

/** Cursele (intervale de zile) → perioade la muncă: se unesc cele cu cel mult `gap` zile libere între ele. */
export function buildStints(ranges: Range[], gap: number = STINT_GAP_DAYS): Range[] {
  const sorted = ranges
    .map((r) => ({ s: toDayNum(r.start), e: Math.max(toDayNum(r.start), toDayNum(r.end)) }))
    .sort((a, b) => a.s - b.s || a.e - b.e);
  const out: { s: number; e: number }[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.s - last.e - 1 <= gap) last.e = Math.max(last.e, r.e);
    else out.push({ ...r });
  }
  return out.map((r) => ({ start: fromDayNum(r.s), end: fromDayNum(r.e) }));
}

function overlaps(a: Range, b: Range): boolean {
  return a.start <= b.end && a.end >= b.start;
}

/** Perioadele finale: corecțiile manuale înlocuiesc perioadele automate pe care le suprapun. */
export function resolveStints(auto: Range[], manual: { id: string; start: string; end: string }[]): Stint[] {
  const out: Stint[] = manual.map((m) => ({ start: m.start, end: m.end, source: "manual", id: m.id }));
  for (const a of auto) {
    if (!manual.some((m) => overlaps(a, m))) out.push({ start: a.start, end: a.end, source: "auto", id: null });
  }
  return out.sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(daysInMonth).padStart(2, "0")}`, daysInMonth, y, m };
}

export async function getDispatchMonth(month: string, tz: string): Promise<DispatchMonth> {
  const org = await orgId();
  const b = monthBounds(month);
  const winStart = fromDayNum(toDayNum(b.start) - 366);
  const winEnd = fromDayNum(toDayNum(b.end) + 120);
  const today = todayIso(tz);

  const [vehRes, jobRes, stintRes, absRes] = await Promise.all([
    pool.query<{ id: string; plate: string; active: boolean; company_id: string | null; company_name: string | null }>(
      `select v.id, v.plate, v.active, v.company_id, c.name as company_name
         from vehicles v
         left join companies c on c.id = v.company_id and c.organization_id = v.organization_id
        where v.organization_id = $1`,
      [org]
    ),
    pool.query<{ vehicle_id: string; s: string; e: string; status: string; has_end: boolean }>(
      `select vehicle_id,
              to_char((start_at at time zone $2)::date, 'YYYY-MM-DD') as s,
              to_char((coalesce(end_at, start_at) at time zone $2)::date, 'YYYY-MM-DD') as e,
              status,
              (end_at is not null) as has_end
         from jobs
        where organization_id = $1 and vehicle_id is not null and start_at is not null
          and status <> 'anulat'
          and (start_at at time zone $2)::date between $3::date and $4::date`,
      [org, tz, winStart, winEnd]
    ),
    pool.query<{ id: string; vehicle_id: string; s: string; e: string }>(
      `select id, vehicle_id, to_char(start_date, 'YYYY-MM-DD') as s, to_char(end_date, 'YYYY-MM-DD') as e
         from dispatch_stints
        where organization_id = $1 and start_date <= $3::date and end_date >= $2::date`,
      [org, winStart, winEnd]
    ),
    pool.query<{ id: string; vehicle_id: string; s: string; e: string; reason: string; note: string | null }>(
      `select id, vehicle_id, to_char(start_date, 'YYYY-MM-DD') as s, to_char(end_date, 'YYYY-MM-DD') as e, reason, note
         from dispatch_absences
        where organization_id = $1 and start_date <= $3::date and end_date >= $2::date
        order by start_date`,
      [org, b.start, b.end]
    ),
  ]);

  const jobsBy = new Map<string, Range[]>();
  for (const j of jobRes.rows) {
    let end = j.e < j.s ? j.s : j.e;
    // cursă în desfășurare fără oră de descărcare: mașina e la muncă până azi
    if (j.status === "activ" && !j.has_end && today > end) end = today;
    const list = jobsBy.get(j.vehicle_id) ?? [];
    list.push({ start: j.s, end });
    jobsBy.set(j.vehicle_id, list);
  }
  const stintsBy = new Map<string, { id: string; start: string; end: string }[]>();
  for (const s of stintRes.rows) {
    const list = stintsBy.get(s.vehicle_id) ?? [];
    list.push({ id: s.id, start: s.s, end: s.e });
    stintsBy.set(s.vehicle_id, list);
  }
  const absBy = new Map<string, Absence[]>();
  for (const a of absRes.rows) {
    const list = absBy.get(a.vehicle_id) ?? [];
    list.push({ id: a.id, start: a.s, end: a.e, reason: a.reason as AbsenceReason, note: a.note });
    absBy.set(a.vehicle_id, list);
  }

  const firmsMap = new Map<string, DispatchFirm>();
  for (const v of vehRes.rows) {
    const all = resolveStints(buildStints(jobsBy.get(v.id) ?? []), stintsBy.get(v.id) ?? []);
    const stints = all.filter((s) => overlaps(s, { start: b.start, end: b.end }));
    const absences = absBy.get(v.id) ?? [];

    const chars: string[] = Array(b.daysInMonth).fill("h");
    for (const s of stints) {
      const from = Math.max(toDayNum(s.start), toDayNum(b.start));
      const to = Math.min(toDayNum(s.end), toDayNum(b.end));
      for (let n = from; n <= to; n++) chars[n - toDayNum(b.start)] = "w";
    }
    for (const a of absences) {
      const from = Math.max(toDayNum(a.start), toDayNum(b.start));
      const to = Math.min(toDayNum(a.end), toDayNum(b.end));
      for (let n = from; n <= to; n++) chars[n - toDayNum(b.start)] = "a";
    }
    const days = chars.join("");
    if (!v.active && !/[wa]/.test(days)) continue; // vehicul scos din uz, fără activitate în lună

    const worked = chars.filter((c) => c === "w").length;
    const key = v.company_id && v.company_name ? v.company_id : "";
    let firm = firmsMap.get(key);
    if (!firm) {
      firm = { id: key || null, name: key ? (v.company_name as string) : "Fără firmă", worked: 0, vehicles: [] };
      firmsMap.set(key, firm);
    }
    firm.vehicles.push({ id: v.id, plate: v.plate, days, worked, stints, absences });
    firm.worked += worked;
  }

  const firms = [...firmsMap.values()];
  for (const f of firms) f.vehicles.sort((x, y) => x.plate.localeCompare(y.plate, "ro", { numeric: true }));
  firms.sort((x, y) => (x.id === null ? 1 : y.id === null ? -1 : x.name.localeCompare(y.name, "ro")));

  const firstDow = (new Date(Date.UTC(b.y, b.m - 1, 1)).getUTCDay() + 6) % 7;
  return { month, daysInMonth: b.daysInMonth, firstDow, firms };
}

type Fail = { ok: false; error: string };
type Ok = { ok: true };

async function vehicleInOrg(vehicleId: string, org: string): Promise<boolean> {
  const { rows } = await pool.query(`select 1 from vehicles where id = $1 and organization_id = $2`, [vehicleId, org]);
  return rows.length > 0;
}

function checkRange(start: unknown, end: unknown, maxDays: number): string | null {
  if (!isIsoDate(start) || !isIsoDate(end)) return "Datele nu sunt valide.";
  if (end < start) return "Data de final nu poate fi înaintea celei de început.";
  if (toDayNum(end) - toDayNum(start) + 1 > maxDays) return `Perioada nu poate depăși ${maxDays} de zile.`;
  return null;
}

export async function addAbsence(input: {
  vehicleId: string;
  start: string;
  end: string;
  reason: string;
  note?: string | null;
}): Promise<Ok | Fail> {
  const org = await orgId();
  const bad = checkRange(input.start, input.end, 366);
  if (bad) return { ok: false, error: bad };
  if (!ABSENCE_REASONS.includes(input.reason as AbsenceReason)) return { ok: false, error: "Motiv invalid." };
  const note = (input.note ?? "").trim().slice(0, 200) || null;
  if (!(await vehicleInOrg(input.vehicleId, org))) return { ok: false, error: "Vehiculul nu există." };
  await pool.query(
    `insert into dispatch_absences (organization_id, vehicle_id, start_date, end_date, reason, note)
     values ($1, $2, $3::date, $4::date, $5, $6)`,
    [org, input.vehicleId, input.start, input.end, input.reason, note]
  );
  return { ok: true };
}

export async function deleteAbsence(id: string): Promise<Ok | Fail> {
  const org = await orgId();
  const res = await pool.query(`delete from dispatch_absences where id = $1 and organization_id = $2 returning id`, [id, org]);
  return res.rows.length ? { ok: true } : { ok: false, error: "Absența nu există." };
}

/**
 * Salvează o perioadă la muncă (corecție sau adăugare). Cu `replaceStart`/`replaceEnd` se corectează
 * perioada afișată: noua perioadă trebuie să o suprapună, ca să o înlocuiască.
 */
export async function saveStint(input: {
  vehicleId: string;
  start: string;
  end: string;
  replaceStart?: string | null;
  replaceEnd?: string | null;
}): Promise<Ok | Fail> {
  const org = await orgId();
  const bad = checkRange(input.start, input.end, 400);
  if (bad) return { ok: false, error: bad };
  if (!(await vehicleInOrg(input.vehicleId, org))) return { ok: false, error: "Vehiculul nu există." };

  const hasReplace = !!input.replaceStart && !!input.replaceEnd;
  if (hasReplace) {
    if (!isIsoDate(input.replaceStart) || !isIsoDate(input.replaceEnd)) return { ok: false, error: "Datele nu sunt valide." };
    if (!overlaps({ start: input.start, end: input.end }, { start: input.replaceStart!, end: input.replaceEnd! })) {
      return { ok: false, error: "Noua perioadă trebuie să se suprapună peste cea corectată. Pentru altă perioadă folosește „Adaugă perioadă”." };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    // corecțiile vechi suprapuse (de noua perioadă sau de cea înlocuită) dispar
    await client.query(
      `delete from dispatch_stints
        where organization_id = $1 and vehicle_id = $2
          and ((start_date <= $4::date and end_date >= $3::date)
            or ($5::date is not null and start_date <= $6::date and end_date >= $5::date))`,
      [org, input.vehicleId, input.start, input.end, hasReplace ? input.replaceStart : null, hasReplace ? input.replaceEnd : null]
    );
    await client.query(
      `insert into dispatch_stints (organization_id, vehicle_id, start_date, end_date)
       values ($1, $2, $3::date, $4::date)`,
      [org, input.vehicleId, input.start, input.end]
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error("Salvarea perioadei a eșuat:", e);
    return { ok: false, error: "Perioada nu a putut fi salvată." };
  } finally {
    client.release();
  }
  return { ok: true };
}

/** Șterge o corecție manuală: perioada revine la cea dedusă automat din curse. */
export async function deleteStint(id: string): Promise<Ok | Fail> {
  const org = await orgId();
  const res = await pool.query(`delete from dispatch_stints where id = $1 and organization_id = $2 returning id`, [id, org]);
  return res.rows.length ? { ok: true } : { ok: false, error: "Perioada nu există." };
}
