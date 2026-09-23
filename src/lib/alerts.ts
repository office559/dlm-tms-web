import { pool } from "@/lib/db";

export type ExpiryAlert = {
  kind: "vehicul" | "remorcă";
  id: string;
  plate: string;
  doc: string;
  exp_date: string;
  days_left: number;
  driver_id: string | null;
};

export async function listExpiryAlerts(days: number) {
  const { rows } = await pool.query<ExpiryAlert>(
    `select kind, id, plate, doc, exp_date, (exp_date - current_date)::int as days_left, driver_id
     from (
       select 'vehicul' as kind, id, plate, 'ITP' as doc, itp_exp as exp_date, driver_id from vehicles where active and itp_exp is not null
       union all
       select 'vehicul', id, plate, 'RCA', rca_exp, driver_id from vehicles where active and rca_exp is not null
       union all
       select 'vehicul', id, plate, 'CASCO', casco_exp, driver_id from vehicles where active and casco_exp is not null
       union all
       select 'vehicul', id, plate, 'Asigurare', insurance_exp, driver_id from vehicles where active and insurance_exp is not null
       union all
       select 'vehicul', id, plate, 'Tahograf', tacho_exp, driver_id from vehicles where active and tacho_exp is not null
       union all
       select 'remorcă', id, plate, 'ITP', itp_exp, null::text as driver_id from trailers where active and itp_exp is not null
       union all
       select 'remorcă', id, plate, 'RCA', rca_exp, null::text as driver_id from trailers where active and rca_exp is not null
       union all
       select 'remorcă', id, plate, 'CASCO', casco_exp, null::text as driver_id from trailers where active and casco_exp is not null
     ) docs
     where exp_date <= (current_date + $1 * interval '1 day')
     order by exp_date asc`,
    [days]
  );
  return rows;
}
