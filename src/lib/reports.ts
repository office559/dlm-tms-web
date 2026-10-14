import { pool } from "@/lib/db";

export type CurrencyRevenue = {
  currency: string;
  count: number;
  total: number;
};

export type CategoryCost = {
  category: string;
  total: number;
};

export type VehicleCost = {
  plate: string;
  total: number;
};

export type BrokerageSummary = {
  count: number;
  client_total: number;
  sub_total: number;
  margin: number;
};

export type JobsSummary = {
  total: number;
  finalizat: number;
  activ: number;
  planificare: number;
  anulat: number;
};

/**
 * Filtru pe firmă (al treilea parametru al interogărilor, $3):
 *  - ""      → toate firmele (fără filtru)
 *  - "none"  → vehicule fără firmă (și curse/cheltuieli fără vehicul)
 *  - un id   → doar vehiculele acelei firme
 * `v` este aliasul tabelului vehicles (legat prin LEFT JOIN).
 */
const COMPANY_FILTER = `($3::text = '' or ($3::text = 'none' and v.company_id is null) or v.company_id = $3::text)`;

export async function getRevenueByCurrency(from: string, to: string, company = "") {
  const { rows } = await pool.query<CurrencyRevenue>(
    `select
       coalesce(j.currency, '—') as currency,
       count(*)::int as count,
       coalesce(sum(coalesce(j.rate,0) + coalesce(j.extra,0)), 0)::float as total
     from jobs j
     left join vehicles v on v.id = j.vehicle_id
     where coalesce(j.start_at::date, j.created_at::date) between $1 and $2
       and ${COMPANY_FILTER}
     group by j.currency
     order by total desc`,
    [from, to, company]
  );
  return rows;
}

export async function getCostsByCategory(from: string, to: string, company = "") {
  const { rows } = await pool.query<CategoryCost>(
    `select c.category as category, coalesce(sum(c.amount), 0)::float as total
     from costs c
     left join vehicles v on v.id = c.vehicle_id
     where c.date between $1 and $2
       and ${COMPANY_FILTER}
     group by c.category
     order by total desc`,
    [from, to, company]
  );
  return rows;
}

export async function getCostsByVehicle(from: string, to: string, company = "") {
  const { rows } = await pool.query<VehicleCost>(
    `select v.plate as plate, coalesce(sum(c.amount), 0)::float as total
     from costs c
     join vehicles v on v.id = c.vehicle_id
     where c.date between $1 and $2
       and ${COMPANY_FILTER}
     group by v.plate
     order by total desc
     limit 8`,
    [from, to, company]
  );
  return rows;
}

export async function getCostsTotal(from: string, to: string, company = "") {
  const { rows } = await pool.query<{ total: number }>(
    `select coalesce(sum(c.amount), 0)::float as total
     from costs c
     left join vehicles v on v.id = c.vehicle_id
     where c.date between $1 and $2
       and ${COMPANY_FILTER}`,
    [from, to, company]
  );
  return rows[0]?.total ?? 0;
}

/** Brokerajul nu este legat de un vehicul, deci nu se poate filtra pe firmă. */
export async function getBrokerageSummary(from: string, to: string) {
  const { rows } = await pool.query<BrokerageSummary>(
    `select
       count(*)::int as count,
       coalesce(sum(coalesce(client_price,0)), 0)::float as client_total,
       coalesce(sum(coalesce(sub_price,0)), 0)::float as sub_total,
       coalesce(sum(coalesce(client_price,0) - coalesce(sub_price,0)), 0)::float as margin
     from brokerage
     where coalesce(collect_date, created_at::date) between $1 and $2`,
    [from, to]
  );
  return rows[0];
}

export async function getJobsSummary(from: string, to: string, company = "") {
  const { rows } = await pool.query<{ status: string; count: number }>(
    `select j.status as status, count(*)::int as count
     from jobs j
     left join vehicles v on v.id = j.vehicle_id
     where coalesce(j.start_at::date, j.created_at::date) between $1 and $2
       and ${COMPANY_FILTER}
     group by j.status`,
    [from, to, company]
  );
  const summary: JobsSummary = { total: 0, finalizat: 0, activ: 0, planificare: 0, anulat: 0 };
  for (const r of rows) {
    summary.total += Number(r.count);
    if (r.status === "finalizat") summary.finalizat = Number(r.count);
    else if (r.status === "activ") summary.activ = Number(r.count);
    else if (r.status === "planificare") summary.planificare = Number(r.count);
    else if (r.status === "anulat") summary.anulat = Number(r.count);
  }
  return summary;
}
