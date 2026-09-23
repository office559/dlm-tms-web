import { pool } from "@/lib/db";
import type { Job } from "@/lib/jobs";
import type { Brokerage } from "@/lib/brokerage";

export async function listJobsForPayments() {
  const { rows } = await pool.query<Job>(
    `select * from jobs
     where rate is not null and status <> 'anulat'
     order by (invoice = 'plătită') asc, coalesce(start_at, created_at) desc`
  );
  return rows;
}

export async function listBrokerageForPayments() {
  const { rows } = await pool.query<Brokerage>(
    `select * from brokerage
     where status <> 'Anulat'
     order by (paid_client and paid_sub) asc, coalesce(collect_date, created_at::date) desc`
  );
  return rows;
}

export type PaymentsSummary = {
  jobsUnpaidByCurrency: { currency: string; total: number }[];
  brokerageToCollect: number;
  brokerageToPay: number;
};

export async function getPaymentsSummary(): Promise<PaymentsSummary> {
  const [jobsRes, brokerageRes] = await Promise.all([
    pool.query<{ currency: string; total: number }>(
      `select coalesce(currency,'—') as currency, coalesce(sum(coalesce(rate,0)+coalesce(extra,0)),0)::float as total
       from jobs
       where rate is not null and status <> 'anulat' and invoice <> 'plătită'
       group by currency`
    ),
    pool.query<{ to_collect: number; to_pay: number }>(
      `select
         coalesce(sum(coalesce(client_price,0)) filter (where not paid_client), 0)::float as to_collect,
         coalesce(sum(coalesce(sub_price,0)) filter (where not paid_sub), 0)::float as to_pay
       from brokerage
       where status <> 'Anulat'`
    ),
  ]);
  return {
    jobsUnpaidByCurrency: jobsRes.rows,
    brokerageToCollect: brokerageRes.rows[0]?.to_collect ?? 0,
    brokerageToPay: brokerageRes.rows[0]?.to_pay ?? 0,
  };
}
