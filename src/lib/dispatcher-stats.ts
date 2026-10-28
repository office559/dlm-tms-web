import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

export type DispatcherCounts = {
  dispatcherId: string | null;
  total: number;
  finalizate: number;
  tranzit: number;
  planificate: number;
  anulate: number;
};

export type DispatcherPricePerKm = {
  dispatcherId: string | null;
  currency: string;
  revenue: number;
  km: number;
  jobs: number;
};

const DATE_FILTER = `j.organization_id = $3
  and coalesce(j.start_at, j.created_at) >= $1::date
  and coalesce(j.start_at, j.created_at) < ($2::date + 1)`;

/** Câte curse a luat fiecare dispecer în perioadă (după data de start a cursei). */
export async function getDispatcherCounts(from: string, to: string): Promise<DispatcherCounts[]> {
  const { rows } = await pool.query<{
    dispatcher_id: string | null;
    total: number;
    finalizate: number;
    tranzit: number;
    planificate: number;
    anulate: number;
  }>(
    `select j.dispatcher_id::text as dispatcher_id,
            count(*)::int as total,
            (count(*) filter (where j.status = 'finalizat'))::int as finalizate,
            (count(*) filter (where j.status = 'activ'))::int as tranzit,
            (count(*) filter (where j.status = 'planificare'))::int as planificate,
            (count(*) filter (where j.status = 'anulat'))::int as anulate
       from jobs j
      where ${DATE_FILTER}
      group by j.dispatcher_id::text`,
    [from, to, await orgId()]
  );
  return rows.map((r) => ({
    dispatcherId: r.dispatcher_id,
    total: Number(r.total),
    finalizate: Number(r.finalizate),
    tranzit: Number(r.tranzit),
    planificate: Number(r.planificate),
    anulate: Number(r.anulate),
  }));
}

/** Km din cursă: reali de pe bord dacă există, altfel distanța completată în cursă. */
const KM_WITH_ODOMETER = `case
    when j.km_start is not null and j.km_end is not null and j.km_end > j.km_start
      then (j.km_end - j.km_start)::float8
    when j.miles is not null and j.miles > 0
      then case when lower(coalesce(j.dist_unit, 'km')) in ('mi', 'mile', 'miles')
                then (j.miles * 1.609344)::float8
                else j.miles::float8 end
    else null
  end`;

/** Varianta de rezervă, dacă coloanele km_start / km_end nu există încă. */
const KM_MILES_ONLY = `case
    when j.miles is not null and j.miles > 0
      then case when lower(coalesce(j.dist_unit, 'km')) in ('mi', 'mile', 'miles')
                then (j.miles * 1.609344)::float8
                else j.miles::float8 end
    else null
  end`;

async function queryPricePerKm(kmExpr: string, from: string, to: string) {
  const { rows } = await pool.query<{
    dispatcher_id: string | null;
    currency: string;
    revenue: number;
    km: number;
    jobs: number;
  }>(
    `select j.dispatcher_id::text as dispatcher_id,
            coalesce(nullif(j.currency, ''), 'EUR') as currency,
            sum(coalesce(j.rate, 0) + coalesce(j.extra, 0))::float8 as revenue,
            sum(k.km)::float8 as km,
            count(*)::int as jobs
       from jobs j
      cross join lateral (select ${kmExpr} as km) k
      where j.status <> 'anulat'
        and j.rate is not null
        and k.km is not null
        and k.km > 0
        and ${DATE_FILTER}
      group by j.dispatcher_id::text, coalesce(nullif(j.currency, ''), 'EUR')`,
    [from, to, await orgId()]
  );
  return rows.map((r) => ({
    dispatcherId: r.dispatcher_id,
    currency: r.currency,
    revenue: Number(r.revenue),
    km: Number(r.km),
    jobs: Number(r.jobs),
  }));
}

/**
 * Prețul total și km pe dispecer și monedă (curse neanulate, cu preț și km),
 * din care se calculează media: preț total / km total.
 */
export async function getDispatcherPricePerKm(
  from: string,
  to: string
): Promise<DispatcherPricePerKm[]> {
  try {
    return await queryPricePerKm(KM_WITH_ODOMETER, from, to);
  } catch {
    return await queryPricePerKm(KM_MILES_ONLY, from, to);
  }
}
