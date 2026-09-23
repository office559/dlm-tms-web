import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Customer = {
  id: string;
  name: string;
  type: string | null;
  code: string | null;
  term_days: number | null;
  commission: number | null;
  terms: string | null;
  email: string | null;
  created_at: Date;
};

export type CustomerInput = {
  name: string;
  type?: string | null;
  code?: string | null;
  termDays?: number | null;
  commission?: number | null;
  terms?: string | null;
  email?: string | null;
};

export function genCustomerId() {
  return "c" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listCustomers() {
  const { rows } = await pool.query<Customer>(`select * from customers order by name asc`);
  return rows;
}

export async function getCustomer(id: string) {
  const { rows } = await pool.query<Customer>(`select * from customers where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createCustomer(input: CustomerInput) {
  const id = genCustomerId();
  const { rows } = await pool.query<Customer>(
    `insert into customers (id, name, type, code, term_days, commission, terms, email)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      id,
      input.name.trim(),
      nullify(input.type),
      nullify(input.code),
      input.termDays ?? null,
      input.commission ?? null,
      nullify(input.terms),
      nullify(input.email),
    ]
  );
  return rows[0];
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const { rows } = await pool.query<Customer>(
    `update customers set
       name = $2, type = $3, code = $4, term_days = $5, commission = $6, terms = $7, email = $8
     where id = $1
     returning *`,
    [
      id,
      input.name.trim(),
      nullify(input.type),
      nullify(input.code),
      input.termDays ?? null,
      input.commission ?? null,
      nullify(input.terms),
      nullify(input.email),
    ]
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(id: string) {
  await pool.query(`delete from customers where id = $1`, [id]);
}
