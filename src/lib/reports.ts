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

export async function getRevenueByCurrency(from: string, to: string) {
  const { rows } = await pool.query<CurrencyRevenue>(
    `select
       coalesce(currency, '—') as currency,
       count(*)::int as count,
       coalesce(sum(coalesce(rate,0) + coalesce(extra,0)), 0)::float as total
     from jobs
     where coalesce(start_at::date, created_at::date) between $1 and $2
     group by currency
     order by total desc`,
    [from, to]
  );
  return rows;
}

export async function getCostsByCategory(from: string, to: string) {
  const { rows } = await pool.query<CategoryCost>(
    `select category, coalesce(sum(amount), 0)::float as total
     from costs
     where date between $1 and $2
     group by category
     order by total desc`,
    [from, to]
  );
  return rows;
}

export async function getCostsByVehicle(from: string, to: string) {
  const { rows } = await pool.query<VehicleCost>(
    `select v.plate as plate, coalesce(sum(c.amount), 0)::float as total
     from costs c
     join vehicles v on v.id = c.vehicle_id
     where c.date between $1 and $2
     group by v.plate
     order by total desc
     limit 8`,
    [from, to]
  );
  return rows;
}

export async function getCostsTotal(from: string, to: string) {
  const { rows } = await pool.query<{ total: number }>(
    `select coalesce(sum(amount), 0)::float as total from costs where date between $1 and $2`,
    [from, to]
  );
  return rows[0]?.total ?? 0;
}

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

export async function getJobsSummary(from: string, to: string) {
  const { rows } = await pool.query<{ status: string; count: number }>(
    `select status, count(*)::int as count
     from jobs
     where coalesce(start_at::date, created_at::date) between $1 and $2
     group by status`,
    [from, to]
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
