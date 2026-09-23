import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Cost = {
  id: string;
  date: string;
  category: string;
  vehicle_id: string | null;
  amount: number;
  note: string | null;
  created_at: Date;
};

export type CostInput = {
  date: string;
  category: string;
  vehicleId?: string | null;
  amount: number;
  note?: string | null;
};

export function genCostId() {
  return "ch" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listCosts() {
  const { rows } = await pool.query<Cost>(`select * from costs order by date desc, created_at desc`);
  return rows;
}

export async function getCost(id: string) {
  const { rows } = await pool.query<Cost>(`select * from costs where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createCost(input: CostInput) {
  const id = genCostId();
  const { rows } = await pool.query<Cost>(
    `insert into costs (id, date, category, vehicle_id, amount, note)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [id, input.date, input.category.trim(), nullify(input.vehicleId), input.amount, nullify(input.note)]
  );
  return rows[0];
}

export async function updateCost(id: string, input: CostInput) {
  const { rows } = await pool.query<Cost>(
    `update costs set
       date = $2, category = $3, vehicle_id = $4, amount = $5, note = $6
     where id = $1
     returning *`,
    [id, input.date, input.category.trim(), nullify(input.vehicleId), input.amount, nullify(input.note)]
  );
  return rows[0] ?? null;
}

export async function deleteCost(id: string) {
  await pool.query(`delete from costs where id = $1`, [id]);
}
