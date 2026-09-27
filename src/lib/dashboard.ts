import { pool } from "@/lib/db";

export type DashboardTotals = {
  venitTotal: number;
  kmTotal: number;
  curseFinalizate: number;
  mediaPeKm: number;
};

export type MonthlyPoint = {
  month: string;
  label: string;
  venit: number;
  km: number;
  curse: number;
};

export type TopDriver = {
  name: string;
  venit: number;
  km: number;
  curse: number;
};

/**
 * Totaluri agregate pe toate cursele finalizate (tot istoricul), pentru
 * căsuțele de informare de sus de pe Dashboard.
 */
export async function getDashboardTotals(): Promise<DashboardTotals> {
  const { rows } = await pool.query<{ venit: number; km: number; curse: number }>(
    `select
       coalesce(sum(coalesce(rate,0) + coalesce(extra,0)), 0)::float as venit,
       coalesce(sum(coalesce(miles,0)), 0)::float as km,
       count(*)::int as curse
     from jobs
     where status = 'finalizat'`
  );
  const r = rows[0] ?? { venit: 0, km: 0, curse: 0 };
  const venitTotal = Number(r.venit) || 0;
  const kmTotal = Number(r.km) || 0;
  const curseFinalizate = Number(r.curse) || 0;
  const mediaPeKm = kmTotal > 0 ? venitTotal / kmTotal : 0;
  return { venitTotal, kmTotal, curseFinalizate, mediaPeKm };
}

const MONTH_LABELS = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

/**
 * Evoluția lunară (ultimele `months` luni, inclusiv luna curentă), pentru
 * graficul de comparație Venit / Km / Nr. curse — doar curse finalizate.
 * Completează cu 0 lunile fără curse, ca să apară mereu toate barele.
 */
export async function getMonthlyTrend(months = 6): Promise<MonthlyPoint[]> {
  const { rows } = await pool.query<{ month: string; venit: number; km: number; curse: number }>(
    `select
       to_char(date_trunc('month', coalesce(start_at, created_at)), 'YYYY-MM') as month,
       coalesce(sum(coalesce(rate,0) + coalesce(extra,0)), 0)::float as venit,
       coalesce(sum(coalesce(miles,0)), 0)::float as km,
       count(*)::int as curse
     from jobs
     where status = 'finalizat'
       and coalesce(start_at, created_at) >= date_trunc('month', now()) - make_interval(months => $1::int)
     group by 1
     order by 1`,
    [months - 1]
  );

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const now = new Date();
  const points: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const found = byMonth.get(key);
    points.push({
      month: key,
      label: MONTH_LABELS[d.getMonth()],
      venit: Number(found?.venit) || 0,
      km: Number(found?.km) || 0,
      curse: Number(found?.curse) || 0,
    });
  }
  return points;
}

/**
 * Top șoferi după venit, doar pentru luna curentă (curse finalizate).
 */
export async function getTopDriversThisMonth(limit = 5): Promise<TopDriver[]> {
  const { rows } = await pool.query<TopDriver>(
    `select
       d.name as name,
       coalesce(sum(coalesce(j.rate,0) + coalesce(j.extra,0)), 0)::float as venit,
       coalesce(sum(coalesce(j.miles,0)), 0)::float as km,
       count(*)::int as curse
     from jobs j
     join drivers d on d.id = j.driver_id
     where j.status = 'finalizat'
       and coalesce(j.start_at, j.created_at) >= date_trunc('month', now())
       and coalesce(j.start_at, j.created_at) < date_trunc('month', now()) + interval '1 month'
     group by d.name
     order by venit desc
     limit $1`,
    [limit]
  );
  return rows.map((r) => ({
    name: r.name,
    venit: Number(r.venit) || 0,
    km: Number(r.km) || 0,
    curse: Number(r.curse) || 0,
  }));
}
