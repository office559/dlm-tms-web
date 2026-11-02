import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";
import { createVehicle } from "@/lib/vehicles";
import { createCompany } from "@/lib/companies";

/**
 * Dispecerat: pontajul vehiculelor, pe firme și pe luni.
 *
 * Dispecerul introduce, pentru fiecare vehicul, perioadele în care a fost la dispecerat:
 * data venirii și data plecării (data plecării poate lipsi = „în curs", se numără până azi).
 * Se numără ambele zile (și cea a venirii, și cea a plecării). O perioadă care trece de la o lună
 * la alta se împarte singură între luni.
 *
 * Datele sunt text ISO „AAAA-LL-ZZ" (zile calendaristice, fără oră).
 */

export type DispatchPeriod = {
  id: string;
  start: string;
  end: string | null;
  /** Zilele acestei perioade care cad în luna afișată (ambele capete incluse). */
  days: number;
};

export type DispatchVehicle = {
  id: string;
  plate: string;
  /** Zilele lucrate în luna afișată. */
  days: number;
  /** Prețul pe zi (euro) introdus pentru această mașină în luna afișată, sau null. */
  rate: number | null;
  /** Totalul lunii pentru mașină: zile × preț pe zi (0 dacă nu e preț). */
  total: number;
  /** Perioadele care ating luna afișată. */
  periods: DispatchPeriod[];
};

export type DispatchFirm = {
  id: string | null;
  name: string;
  days: number;
  total: number;
  vehicles: DispatchVehicle[];
};

export type DispatchFirmInfo = {
  id: string;
  name: string;
  /** Firma e ascunsă din Dispecerat (ex. mașinile proprii). */
  hidden: boolean;
  vehicleCount: number;
};

/** O mașină existentă în TMS (din Vehicule), care poate fi pusă la o firmă din Dispecerat. */
export type DispatchVehicleOption = {
  id: string;
  plate: string;
  firmId: string | null;
  firmName: string | null;
  /** Firma ei actuală e ascunsă din Dispecerat. */
  firmHidden: boolean;
};

export type DispatchMonth = {
  /** „AAAA-LL" */
  month: string;
  /** Ziua de azi (AAAA-LL-ZZ), în fusul orar al utilizatorului. */
  today: string;
  /** Firmele afișate (fără cele ascunse). */
  firms: DispatchFirm[];
  /** Toate firmele (afișate și ascunse), pentru „Gestionează firme". */
  allFirms: DispatchFirmInfo[];
  /** Toate mașinile active din TMS, pentru „Din Vehicule". */
  vehicleOptions: DispatchVehicleOption[];
  totalEuro: number;
  totalDays: number;
  /** Mașini cu cel puțin o perioadă în lună. */
  vehiclesWorking: number;
  /** Perioade fără dată de plecare („în curs"). */
  openCount: number;
};

const DAY_MS = 86400000;
const FAR_FUTURE = "9999-12-31";

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
  return typeof s === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(s);
}

/** Ziua de azi („AAAA-LL-ZZ") în fusul orar ales. */
export function todayIso(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function currentMonth(tz: string, now: Date = new Date()): string {
  return todayIso(tz, now).slice(0, 7);
}

/** Prima și ultima zi a lunii „AAAA-LL". */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Zilele (ambele capete incluse) dintre două date. */
export function spanDays(start: string, end: string): number {
  return toDayNum(end) - toDayNum(start) + 1;
}

type Interval = { s: number; e: number };

/** Uniunea intervalelor (zilele suprapuse se numără o singură dată). */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.e >= i.s).sort((a, b) => a.s - b.s || a.e - b.e);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.s <= last.e + 1) last.e = Math.max(last.e, i.e);
    else out.push({ ...i });
  }
  return out;
}

/** Zilele lucrate în fiecare lună a anului, din perioade ({start, end|null}); „în curs" se numără până la `today`. */
export function countByMonth(periods: { start: string; end: string | null }[], year: number, today: string): number[] {
  const merged = mergeIntervals(
    periods.map((p) => ({ s: toDayNum(p.start), e: toDayNum(p.end ?? today) }))
  );
  const months: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const ms = toDayNum(`${year}-${String(m).padStart(2, "0")}-01`);
    const me = ms + new Date(Date.UTC(year, m, 0)).getUTCDate() - 1;
    let n = 0;
    for (const i of merged) n += Math.max(0, Math.min(i.e, me) - Math.max(i.s, ms) + 1);
    months.push(n);
  }
  return months;
}

/** Zilele dintr-o perioadă care cad în [from, to]; „în curs" se numără până la `today`. */
export function daysWithin(start: string, end: string | null, from: string, to: string, today: string): number {
  const s = Math.max(toDayNum(start), toDayNum(from));
  const e = Math.min(toDayNum(end ?? today), toDayNum(to));
  return Math.max(0, e - s + 1);
}

export async function getDispatchMonth(month: string, tz: string): Promise<DispatchMonth> {
  const org = await orgId();
  const today = todayIso(tz);
  const { from, to } = monthRange(month);

  const [vehRes, perRes, priceRes, compRes] = await Promise.all([
    pool.query<{ id: string; plate: string; active: boolean; company_id: string | null; company_name: string | null }>(
      `select v.id, v.plate, v.active, v.company_id, c.name as company_name
         from vehicles v
         left join companies c on c.id = v.company_id and c.organization_id = v.organization_id
        where v.organization_id = $1`,
      [org]
    ),
    pool.query<{ id: string; vehicle_id: string; s: string; e: string | null }>(
      `select id, vehicle_id,
              to_char(start_date, 'YYYY-MM-DD') as s,
              to_char(end_date, 'YYYY-MM-DD') as e
         from dispatch_stints
        where organization_id = $1
          and start_date <= $3::date and coalesce(end_date, '9999-12-31'::date) >= $2::date
        order by start_date`,
      [org, from, to]
    ),
    pool.query<{ vehicle_id: string; rate: string }>(
      `select vehicle_id, daily_rate::text as rate
         from dispatch_prices
        where organization_id = $1 and month = $2 and daily_rate is not null`,
      [org, month]
    ),
    pool.query<{ id: string; name: string; active: boolean; dispatch_hidden: boolean; vehicle_count: number }>(
      `select c.id, c.name, c.active, c.dispatch_hidden,
              (select count(*)::int from vehicles v
                where v.company_id = c.id and v.organization_id = c.organization_id) as vehicle_count
         from companies c
        where c.organization_id = $1`,
      [org]
    ),
  ]);

  const periodsBy = new Map<string, DispatchPeriod[]>();
  for (const p of perRes.rows) {
    const list = periodsBy.get(p.vehicle_id) ?? [];
    list.push({ id: p.id, start: p.s, end: p.e, days: daysWithin(p.s, p.e, from, to, today) });
    periodsBy.set(p.vehicle_id, list);
  }
  const priceBy = new Map<string, number>();
  for (const r of priceRes.rows) priceBy.set(r.vehicle_id, Number(r.rate));

  const hiddenIds = new Set(compRes.rows.filter((c) => c.dispatch_hidden).map((c) => c.id));
  const firmsMap = new Map<string, DispatchFirm>();
  // firmele active și neascunse apar chiar dacă încă nu au mașini (ex. un client nou)
  for (const c of compRes.rows) {
    if (c.dispatch_hidden || c.active === false) continue;
    firmsMap.set(c.id, { id: c.id, name: c.name, days: 0, total: 0, vehicles: [] });
  }
  const vehicleOptions: DispatchVehicleOption[] = vehRes.rows
    .filter((v) => v.active)
    .map((v) => ({
      id: v.id,
      plate: v.plate,
      firmId: v.company_id && v.company_name ? v.company_id : null,
      firmName: v.company_id && v.company_name ? v.company_name : null,
      firmHidden: !!v.company_id && hiddenIds.has(v.company_id),
    }))
    .sort((x, y) => x.plate.localeCompare(y.plate, "ro", { numeric: true }));
  let totalEuro = 0;
  let totalDays = 0;
  let vehiclesWorking = 0;
  let openCount = 0;
  for (const v of vehRes.rows) {
    const periods = periodsBy.get(v.id) ?? [];
    if (v.company_id && hiddenIds.has(v.company_id)) continue; // firma e ascunsă din Dispecerat
    const rate = priceBy.get(v.id) ?? null;
    if (!v.active && periods.length === 0 && rate === null) continue; // scos din uz, fără nimic în lună
    // zilele mașinii: uniunea perioadelor (dacă ar exista suprapuneri vechi, nu se dublează)
    const merged = mergeIntervals(
      periods.map((p) => ({ s: Math.max(toDayNum(p.start), toDayNum(from)), e: Math.min(toDayNum(p.end ?? today), toDayNum(to)) }))
    );
    const days = merged.reduce((a, i) => a + (i.e - i.s + 1), 0);
    const key = v.company_id && v.company_name ? v.company_id : "";
    let firm = firmsMap.get(key);
    if (!firm) {
      firm = { id: key || null, name: key ? (v.company_name as string) : "Fără firmă", days: 0, total: 0, vehicles: [] };
      firmsMap.set(key, firm);
    }
    const total = Math.round(days * (rate ?? 0) * 100) / 100;
    firm.vehicles.push({ id: v.id, plate: v.plate, days, rate, total, periods });
    firm.days += days;
    firm.total += total;
    totalDays += days;
    totalEuro += total;
    if (periods.length > 0) vehiclesWorking++;
    openCount += periods.filter((p) => p.end === null).length;
  }

  const firms = [...firmsMap.values()];
  for (const f of firms) {
    f.vehicles.sort((x, y) => x.plate.localeCompare(y.plate, "ro", { numeric: true }));
    f.total = Math.round(f.total * 100) / 100;
  }
  firms.sort((x, y) => (x.id === null ? 1 : y.id === null ? -1 : x.name.localeCompare(y.name, "ro")));
  const allFirms: DispatchFirmInfo[] = compRes.rows
    .map((c) => ({ id: c.id, name: c.name, hidden: c.dispatch_hidden, vehicleCount: c.vehicle_count }))
    .sort((x, y) => x.name.localeCompare(y.name, "ro"));
  return {
    month,
    today,
    firms,
    allFirms,
    vehicleOptions,
    totalEuro: Math.round(totalEuro * 100) / 100,
    totalDays,
    vehiclesWorking,
    openCount,
  };
}

type Fail = { ok: false; error: string };
type Ok = { ok: true };

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function checkDates(start: unknown, end: unknown): string | null {
  if (!isIsoDate(start)) return "Data venirii nu este validă.";
  if (start < "2000-01-01" || start > "2100-12-31") return "Data venirii nu este validă.";
  if (end === null || end === undefined || end === "") return null;
  if (!isIsoDate(end)) return "Data plecării nu este validă.";
  if (end < start) return "Data plecării nu poate fi înaintea datei venirii.";
  if (spanDays(start, end) > 3660) return "Perioada este prea lungă.";
  return null;
}

async function vehicleInOrg(vehicleId: string, org: string): Promise<boolean> {
  const { rows } = await pool.query(`select 1 from vehicles where id = $1 and organization_id = $2`, [vehicleId, org]);
  return rows.length > 0;
}

/** O altă perioadă a aceluiași vehicul care se suprapune peste intervalul dat (sau null). */
async function findOverlap(org: string, vehicleId: string, start: string, end: string | null, excludeId: string | null) {
  const { rows } = await pool.query<{ s: string; e: string | null }>(
    `select to_char(start_date, 'YYYY-MM-DD') as s, to_char(end_date, 'YYYY-MM-DD') as e
       from dispatch_stints
      where organization_id = $1 and vehicle_id = $2
        and ($5::uuid is null or id <> $5::uuid)
        and start_date <= $4::date and coalesce(end_date, '9999-12-31'::date) >= $3::date
      limit 1`,
    [org, vehicleId, start, end ?? FAR_FUTURE, excludeId]
  );
  return rows[0] ?? null;
}

function overlapMessage(o: { s: string; e: string | null }): string {
  return `Se suprapune cu perioada ${fmt(o.s)} – ${o.e ? fmt(o.e) : "în curs"}.`;
}

export async function addPeriod(input: { vehicleId: string; start: string; end: string | null }): Promise<Ok | Fail> {
  const org = await orgId();
  const end = input.end || null;
  const bad = checkDates(input.start, end);
  if (bad) return { ok: false, error: bad };
  if (!(await vehicleInOrg(input.vehicleId, org))) return { ok: false, error: "Alege o mașină." };
  const overlap = await findOverlap(org, input.vehicleId, input.start, end, null);
  if (overlap) return { ok: false, error: overlapMessage(overlap) };
  await pool.query(
    `insert into dispatch_stints (organization_id, vehicle_id, start_date, end_date)
     values ($1, $2, $3::date, $4::date)`,
    [org, input.vehicleId, input.start, end]
  );
  return { ok: true };
}

export async function updatePeriod(input: { id: string; start: string; end: string | null }): Promise<Ok | Fail> {
  const org = await orgId();
  const end = input.end || null;
  const bad = checkDates(input.start, end);
  if (bad) return { ok: false, error: bad };
  const cur = await pool.query<{ vehicle_id: string }>(
    `select vehicle_id from dispatch_stints where id = $1 and organization_id = $2`,
    [input.id, org]
  );
  if (!cur.rows[0]) return { ok: false, error: "Perioada nu există." };
  const overlap = await findOverlap(org, cur.rows[0].vehicle_id, input.start, end, input.id);
  if (overlap) return { ok: false, error: overlapMessage(overlap) };
  await pool.query(
    `update dispatch_stints set start_date = $3::date, end_date = $4::date where id = $1 and organization_id = $2`,
    [input.id, org, input.start, end]
  );
  return { ok: true };
}

export async function deletePeriod(id: string): Promise<Ok | Fail> {
  const org = await orgId();
  const res = await pool.query(`delete from dispatch_stints where id = $1 and organization_id = $2 returning id`, [id, org]);
  return res.rows.length ? { ok: true } : { ok: false, error: "Perioada nu există." };
}

/** Prețul pe zi (euro) al unei mașini pentru o lună; `rate` null = șterge prețul. Totalul = zile × preț pe zi. */
export async function setRate(input: { vehicleId: string; month: string; rate: number | null }): Promise<Ok | Fail> {
  const org = await orgId();
  if (!isMonth(input.month)) return { ok: false, error: "Luna nu este validă." };
  if (!(await vehicleInOrg(input.vehicleId, org))) return { ok: false, error: "Alege o mașină." };
  if (input.rate === null) {
    await pool.query(`delete from dispatch_prices where organization_id = $1 and vehicle_id = $2 and month = $3`, [
      org,
      input.vehicleId,
      input.month,
    ]);
    return { ok: true };
  }
  if (typeof input.rate !== "number" || !Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100000) {
    return { ok: false, error: "Prețul pe zi nu este valid." };
  }
  const rate = Math.round(input.rate * 100) / 100;
  await pool.query(
    `insert into dispatch_prices (organization_id, vehicle_id, month, daily_rate)
     values ($1, $2, $3, $4)
     on conflict (vehicle_id, month) do update set daily_rate = excluded.daily_rate`,
    [org, input.vehicleId, input.month, rate]
  );
  return { ok: true };
}

/** „sv 23  for" → „SV 23 FOR": majuscule, spații strânse. */
export function normalizePlate(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

const plateKey = (p: string) => p.replace(/[\s-]/g, "");

/** Adaugă o mașină nouă (apare și în Flotă/Planificare), la firma aleasă (sau fără firmă). */
export async function addVehicle(input: { plate: string; companyId: string | null }): Promise<(Ok & { id: string }) | Fail> {
  const org = await orgId();
  const plate = normalizePlate(input.plate);
  if (!/^[A-Z0-9][A-Z0-9 -]{1,14}$/.test(plate)) {
    return { ok: false, error: "Numărul de înmatriculare nu este valid (2–15 litere sau cifre)." };
  }
  if (input.companyId) {
    const c = await pool.query(`select 1 from companies where id = $1 and organization_id = $2`, [input.companyId, org]);
    if (c.rows.length === 0) return { ok: false, error: "Alege o firmă." };
  }
  const dup = await pool.query<{ plate: string }>(
    `select plate from vehicles
      where organization_id = $1 and upper(regexp_replace(plate, '[\s-]', '', 'g')) = $2
      limit 1`,
    [org, plateKey(plate)]
  );
  if (dup.rows[0]) return { ok: false, error: `Există deja o mașină cu numărul ${dup.rows[0].plate}.` };
  const v = await createVehicle({ plate, companyId: input.companyId });
  return { ok: true, id: v.id };
}

/**
 * Pune o mașină existentă (din Vehicule) la o firmă din Dispecerat.
 * Firma mașinii se schimbă în tot TMS-ul (Flotă, Planificare), pentru că Dispecerat folosește aceeași firmă.
 */
export async function assignVehicleToFirm(input: { vehicleId: string; companyId: string }): Promise<Ok | Fail> {
  const org = await orgId();
  if (!(await vehicleInOrg(input.vehicleId, org))) return { ok: false, error: "Alege o mașină." };
  const c = await pool.query(`select 1 from companies where id = $1 and organization_id = $2`, [input.companyId, org]);
  if (c.rows.length === 0) return { ok: false, error: "Alege o firmă." };
  await pool.query(`update vehicles set company_id = $3 where id = $1 and organization_id = $2`, [
    input.vehicleId,
    org,
    input.companyId,
  ]);
  return { ok: true };
}

/** Adaugă un client nou (firmă). */
export async function addClient(input: { name: string }): Promise<(Ok & { id: string }) | Fail> {
  const org = await orgId();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Numele firmei trebuie să aibă între 2 și 80 de caractere." };
  const dup = await pool.query<{ name: string; dispatch_hidden: boolean }>(
    `select name, dispatch_hidden from companies where organization_id = $1 and lower(name) = lower($2) limit 1`,
    [org, name]
  );
  if (dup.rows[0]) {
    return {
      ok: false,
      error: dup.rows[0].dispatch_hidden
        ? `Firma ${dup.rows[0].name} există, dar este ascunsă din Dispecerat. O poți afișa din „Gestionează firme".`
        : `Există deja o firmă cu numele ${dup.rows[0].name}.`,
    };
  }
  try {
    const c = await createCompany(name);
    return { ok: true, id: c.id };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, error: "Există deja o firmă cu acest nume." };
    throw e;
  }
}

/** Ascunde / arată o firmă în Dispecerat (nu o șterge și nu atinge mașinile ei în restul TMS-ului). */
export async function setFirmHidden(input: { id: string; hidden: boolean }): Promise<Ok | Fail> {
  const org = await orgId();
  const res = await pool.query(
    `update companies set dispatch_hidden = $3 where id = $1 and organization_id = $2 returning id`,
    [input.id, org, !!input.hidden]
  );
  return res.rows.length ? { ok: true } : { ok: false, error: "Firma nu există." };
}
