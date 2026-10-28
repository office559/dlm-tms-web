import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

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

export type DispatchPeriod = { id: string; start: string; end: string | null };

export type DispatchVehicle = {
  id: string;
  plate: string;
  /** Zilele lucrate în fiecare lună a anului (12 valori, ian–dec). */
  months: number[];
  total: number;
  /** Perioadele care ating anul ales. */
  periods: DispatchPeriod[];
};

export type DispatchFirm = {
  id: string | null;
  name: string;
  total: number;
  vehicles: DispatchVehicle[];
};

export type DispatchYear = {
  year: number;
  /** Ziua de azi (AAAA-LL-ZZ), în fusul orar al utilizatorului. */
  today: string;
  firms: DispatchFirm[];
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

export function isYear(s: unknown): s is string {
  return typeof s === "string" && /^20\d{2}$/.test(s);
}

/** Ziua de azi („AAAA-LL-ZZ") în fusul orar ales. */
export function todayIso(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function currentYear(tz: string, now: Date = new Date()): number {
  return Number(todayIso(tz, now).slice(0, 4));
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

export async function getDispatchYear(year: number, tz: string): Promise<DispatchYear> {
  const org = await orgId();
  const today = todayIso(tz);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [vehRes, perRes] = await Promise.all([
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
  ]);

  const periodsBy = new Map<string, DispatchPeriod[]>();
  for (const p of perRes.rows) {
    const list = periodsBy.get(p.vehicle_id) ?? [];
    list.push({ id: p.id, start: p.s, end: p.e });
    periodsBy.set(p.vehicle_id, list);
  }

  const firmsMap = new Map<string, DispatchFirm>();
  for (const v of vehRes.rows) {
    const periods = periodsBy.get(v.id) ?? [];
    if (!v.active && periods.length === 0) continue; // vehicul scos din uz, fără perioade în an
    const months = countByMonth(periods, year, today);
    const total = months.reduce((a, b) => a + b, 0);
    const key = v.company_id && v.company_name ? v.company_id : "";
    let firm = firmsMap.get(key);
    if (!firm) {
      firm = { id: key || null, name: key ? (v.company_name as string) : "Fără firmă", total: 0, vehicles: [] };
      firmsMap.set(key, firm);
    }
    firm.vehicles.push({ id: v.id, plate: v.plate, months, total, periods });
    firm.total += total;
  }

  const firms = [...firmsMap.values()];
  for (const f of firms) f.vehicles.sort((x, y) => x.plate.localeCompare(y.plate, "ro", { numeric: true }));
  firms.sort((x, y) => (x.id === null ? 1 : y.id === null ? -1 : x.name.localeCompare(y.name, "ro")));
  return { year, today, firms };
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
