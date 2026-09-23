import { pool } from "@/lib/db";
import type { Job } from "@/lib/jobs";

export async function listJobsBetween(from: string, to: string) {
  const { rows } = await pool.query<Job>(
    `select * from jobs
     where start_at is not null
       and start_at >= $1::timestamptz
       and start_at < ($2::timestamptz + interval '1 day')
     order by start_at asc`,
    [from, to]
  );
  return rows;
}

export async function listUnscheduledJobs() {
  const { rows } = await pool.query<Job>(
    `select * from jobs
     where start_at is null and status not in ('finalizat','anulat')
     order by created_at desc
     limit 20`
  );
  return rows;
}
