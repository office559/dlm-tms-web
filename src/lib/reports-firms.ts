import { pool } from "@/lib/db";
import { listCompanies } from "@/lib/companies";
import { listCustomers } from "@/lib/customers";
import { DEFAULT_TIMEZONE } from "@/lib/tz";

/** Data unei curse = data încărcării (sau a creării, dacă lipsește). */
const DATE_EXPR = `coalesce(j.start_at::date, j.created_at::date)`;
/** $3: "" = toate firmele, "none" = fără firmă, altfel id-ul firmei. */
const COMPANY_FILTER = `($3::text = '' or ($3::text = 'none' and v.company_id is null) or v.company_id = $3::text)`;
const JOIN_DRIVER = `left join drivers d on d.id = coalesce(j.driver_id, v.driver_id)`;

export type VehicleRow = {
  plate: string;
  driver: string;
  jobs: number;
  total: number;
};

export type CurrencyBlock = {
  currency: string;
  jobs: number;
  total: number;
  rows: VehicleRow[];
};

export type JobLine = {
  ref: string;
  startAt: string | null;
  route: string;
  client: string;
  plate: string;
  driver: string;
  status: string;
  currency: string;
  amount: number;
};

export type FirmReport = {
  id: string;
  name: string;
  jobs: number;
  currencies: CurrencyBlock[];
  jobList: JobLine[];
};

export type CostRow = { label: string; total: number };

export type Report = {
  from: string;
  to: string;
  company: string;
  companyLabel: string;
  firms: FirmReport[];
  totals: { currency: string; jobs: number; total: number }[];
  statusCounts: { status: string; count: number }[];
  jobsCount: number;
  costsTotal: number;
  costsByCategory: CostRow[];
  costsByVehicle: CostRow[];
};

/* ───────────────────────── formatare + perioade ───────────────────────── */

export function currencySymbol(c: string): string {
  if (c === "EUR") return "€";
  if (c === "USD") return "$";
  return c;
}

export function fmtMoney(n: number, currency?: string): string {
  const s = n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${s} ${currencySymbol(currency)}` : s;
}

/** 2026-10-18 → 18.10.2026 */
export function fmtDay(s: string): string {
  return s.split("-").reverse().join(".");
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: DEFAULT_TIMEZONE });
}

function addDays(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekRange(offset = 0): { from: string; to: string } {
  const t = todayStr();
  const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; // luni = 0
  const monday = addDays(t, -dow + offset * 7);
  return { from: monday, to: addDays(monday, 6) };
}

export function monthRange(offset = 0): { from: string; to: string } {
  const [y, m] = todayStr().split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Citește ?from=&to=&firma= (cu perioadă implicită = săptămâna aceasta). */
export function parseReportParams(sp: { from?: string; to?: string; firma?: string }) {
  const def = weekRange(0);
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : def.from;
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : def.to;
  const firma = (sp.firma ?? "").trim();
  return from <= to ? { from, to, firma } : { from: to, to: from, firma };
}

/* ───────────────────────────── interogări ───────────────────────────── */

function driverLabel(name: string | null, fictive: string | null): string {
  if (!name) return "Fără șofer";
  return fictive ? `${name} / ${fictive}` : name;
}

async function loadCosts(from: string, to: string, company: string) {
  const args = [from, to, company];
  const base = `from costs c left join vehicles v on v.id = c.vehicle_id
    where c.date between $1::date and $2::date and ${COMPANY_FILTER}`;
  try {
    const [cat, veh, tot] = await Promise.all([
      pool.query(
        `select coalesce(nullif(c.category,''),'Altele') as label, sum(c.amount)::float8 as total
         ${base} group by 1 order by total desc`,
        args
      ),
      pool.query(
        `select coalesce(v.plate,'Fără vehicul') as label, sum(c.amount)::float8 as total
         ${base} group by 1 order by total desc limit 8`,
        args
      ),
      pool.query(`select coalesce(sum(c.amount),0)::float8 as total ${base}`, args),
    ]);
    return {
      byCategory: cat.rows as CostRow[],
      byVehicle: veh.rows as CostRow[],
      total: Number(tot.rows[0]?.total ?? 0),
    };
  } catch {
    return { byCategory: [], byVehicle: [], total: 0 };
  }
}

export async function buildReport(from: string, to: string, company: string): Promise<Report> {
  const args = [from, to, company];
  const where = `where ${DATE_EXPR} between $1::date and $2::date and ${COMPANY_FILTER}`;

  const [companies, customers, breakdown, jobsRes, statusRes, costs] = await Promise.all([
    listCompanies(),
    listCustomers(),
    pool.query(
      `select coalesce(v.company_id,'none') as company_id,
              coalesce(v.plate,'Fără vehicul') as plate,
              d.name as driver_name, d.fictive_name,
              coalesce(j.currency,'EUR') as currency,
              count(*)::int as jobs,
              coalesce(sum(coalesce(j.rate,0) + coalesce(j.extra,0)),0)::float8 as total
       from jobs j
       left join vehicles v on v.id = j.vehicle_id
       ${JOIN_DRIVER}
       ${where} and j.status <> 'anulat'
       group by 1, 2, 3, 4, 5
       order by total desc`,
      args
    ),
    pool.query(
      `select j.ref, j.start_at, j.load_place, j.unload_place, j.status, j.client_id,
              coalesce(j.currency,'EUR') as currency,
              (coalesce(j.rate,0) + coalesce(j.extra,0))::float8 as amount,
              coalesce(v.company_id,'none') as company_id,
              v.plate, d.name as driver_name, d.fictive_name
       from jobs j
       left join vehicles v on v.id = j.vehicle_id
       ${JOIN_DRIVER}
       ${where}
       order by j.start_at nulls last, j.created_at`,
      args
    ),
    pool.query(
      `select j.status, count(*)::int as count
       from jobs j left join vehicles v on v.id = j.vehicle_id
       ${where} group by j.status`,
      args
    ),
    loadCosts(from, to, company),
  ]);

  const companyName = new Map<string, string>(companies.map((c) => [c.id, c.name]));
  const nameOf = (id: string) => (id === "none" ? "Fără firmă" : companyName.get(id) ?? id);
  const clientName = new Map<string, string>(
    customers.map((c) => {
      const x = c as unknown as { id: string; code?: string | null; name?: string | null };
      return [x.id, x.name || x.code || ""];
    })
  );

  const firmMap = new Map<string, FirmReport>();
  const ensure = (id: string): FirmReport => {
    let f = firmMap.get(id);
    if (!f) {
      f = { id, name: nameOf(id), jobs: 0, currencies: [], jobList: [] };
      firmMap.set(id, f);
    }
    return f;
  };
  // Când alegi o firmă anume, apare chiar dacă n-are curse.
  if (company) ensure(company);

  for (const r of breakdown.rows) {
    const f = ensure(r.company_id as string);
    let block = f.currencies.find((b) => b.currency === r.currency);
    if (!block) {
      block = { currency: r.currency as string, jobs: 0, total: 0, rows: [] };
      f.currencies.push(block);
    }
    block.rows.push({
      plate: r.plate as string,
      driver: driverLabel(r.driver_name as string | null, r.fictive_name as string | null),
      jobs: r.jobs as number,
      total: r.total as number,
    });
    block.jobs += r.jobs as number;
    block.total += r.total as number;
    f.jobs += r.jobs as number;
  }

  for (const r of jobsRes.rows) {
    const f = ensure(r.company_id as string);
    f.jobList.push({
      ref: (r.ref as string | null) ?? "",
      startAt: r.start_at ? new Date(r.start_at as string).toISOString() : null,
      route: [r.load_place, r.unload_place].filter(Boolean).join(" → "),
      client: r.client_id ? clientName.get(r.client_id as string) ?? "" : "",
      plate: (r.plate as string | null) ?? "—",
      driver: driverLabel(r.driver_name as string | null, r.fictive_name as string | null),
      status: r.status as string,
      currency: r.currency as string,
      amount: r.amount as number,
    });
  }

  const firms = [...firmMap.values()].sort((a, b) => {
    if (a.id === "none") return 1;
    if (b.id === "none") return -1;
    return a.name.localeCompare(b.name, "ro");
  });
  for (const f of firms) f.currencies.sort((a, b) => b.total - a.total);

  const totalsMap = new Map<string, { currency: string; jobs: number; total: number }>();
  for (const f of firms)
    for (const b of f.currencies) {
      const t = totalsMap.get(b.currency) ?? { currency: b.currency, jobs: 0, total: 0 };
      t.jobs += b.jobs;
      t.total += b.total;
      totalsMap.set(b.currency, t);
    }

  const statusCounts = statusRes.rows.map((r) => ({
    status: r.status as string,
    count: r.count as number,
  }));

  return {
    from,
    to,
    company,
    companyLabel: company === "" ? "Toate firmele" : nameOf(company),
    firms,
    totals: [...totalsMap.values()].sort((a, b) => b.total - a.total),
    statusCounts,
    jobsCount: statusCounts.reduce((s, x) => s + x.count, 0),
    costsTotal: costs.total,
    costsByCategory: costs.byCategory,
    costsByVehicle: costs.byVehicle,
  };
}
