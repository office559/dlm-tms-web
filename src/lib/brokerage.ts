import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Brokerage = {
  id: string;
  client: string;
  ref: string | null;
  route: string | null;
  collect_date: string | null;
  deliver_date: string | null;
  client_price: number | null;
  sub: string | null;
  sub_price: number | null;
  status: string;
  paid_client: boolean;
  paid_sub: boolean;
  created_at: Date;
};

export type BrokerageInput = {
  client?: string | null;
  ref?: string | null;
  route?: string | null;
  collectDate?: string | null;
  deliverDate?: string | null;
  clientPrice?: number | null;
  sub?: string | null;
  subPrice?: number | null;
  status?: string | null;
  paidClient?: boolean | null;
  paidSub?: boolean | null;
};

export function genBrokerageId() {
  return "b" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listBrokerage() {
  const { rows } = await pool.query<Brokerage>(
    `select * from brokerage order by coalesce(collect_date, created_at::date) desc, created_at desc`
  );
  return rows;
}

export async function getBrokerage(id: string) {
  const { rows } = await pool.query<Brokerage>(`select * from brokerage where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createBrokerage(input: BrokerageInput) {
  const id = genBrokerageId();
  const { rows } = await pool.query<Brokerage>(
    `insert into brokerage (
       id, client, ref, route, collect_date, deliver_date,
       client_price, sub, sub_price, status, paid_client, paid_sub
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      id,
      input.client?.trim() || "",
      nullify(input.ref),
      nullify(input.route),
      nullify(input.collectDate),
      nullify(input.deliverDate),
      input.clientPrice ?? null,
      nullify(input.sub),
      input.subPrice ?? null,
      input.status?.trim() || "În curs",
      input.paidClient ?? false,
      input.paidSub ?? false,
    ]
  );
  return rows[0];
}

export async function updateBrokerage(id: string, input: BrokerageInput) {
  const { rows } = await pool.query<Brokerage>(
    `update brokerage set
       client = $2, ref = $3, route = $4, collect_date = $5, deliver_date = $6,
       client_price = $7, sub = $8, sub_price = $9, status = $10,
       paid_client = $11, paid_sub = $12
     where id = $1
     returning *`,
    [
      id,
      input.client?.trim() || "",
      nullify(input.ref),
      nullify(input.route),
      nullify(input.collectDate),
      nullify(input.deliverDate),
      input.clientPrice ?? null,
      nullify(input.sub),
      input.subPrice ?? null,
      input.status?.trim() || "În curs",
      input.paidClient ?? false,
      input.paidSub ?? false,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteBrokerage(id: string) {
  await pool.query(`delete from brokerage where id = $1`, [id]);
}
