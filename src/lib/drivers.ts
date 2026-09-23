import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Driver = {
  id: string;
  name: string;
  fictive_name: string | null;
  owner_id: string | null;
  salary: number | null;
  tm: string | null;
  card: string | null;
  permis_exp: string | null;
  cpc_exp: string | null;
  card_exp: string | null;
  medical_exp: string | null;
  card_last: string | null;
  phone: string | null;
  active: boolean;
  created_at: Date;
};

export type DriverInput = {
  name: string;
  fictiveName?: string | null;
  salary?: number | null;
  tm?: string | null;
  card?: string | null;
  permisExp?: string | null;
  cpcExp?: string | null;
  cardExp?: string | null;
  medicalExp?: string | null;
  phone?: string | null;
  active?: boolean;
};

export function genId(prefix: string) {
  return prefix + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listDrivers() {
  const { rows } = await pool.query<Driver>(`select * from drivers order by name asc`);
  return rows;
}

export async function getDriver(id: string) {
  const { rows } = await pool.query<Driver>(`select * from drivers where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createDriver(input: DriverInput) {
  const id = genId("d");
  const { rows } = await pool.query<Driver>(
    `insert into drivers (id, name, fictive_name, salary, tm, card, permis_exp, cpc_exp, card_exp, medical_exp, phone, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      id,
      input.name.trim(),
      nullify(input.fictiveName),
      nullify(input.salary),
      nullify(input.tm),
      nullify(input.card),
      nullify(input.permisExp),
      nullify(input.cpcExp),
      nullify(input.cardExp),
      nullify(input.medicalExp),
      nullify(input.phone),
      input.active ?? true,
    ]
  );
  return rows[0];
}

export async function updateDriver(id: string, input: DriverInput) {
  const { rows } = await pool.query<Driver>(
    `update drivers set
       name = $2, fictive_name = $3, salary = $4, tm = $5, card = $6,
       permis_exp = $7, cpc_exp = $8, card_exp = $9, medical_exp = $10,
       phone = $11, active = $12
     where id = $1
     returning *`,
    [
      id,
      input.name.trim(),
      nullify(input.fictiveName),
      nullify(input.salary),
      nullify(input.tm),
      nullify(input.card),
      nullify(input.permisExp),
      nullify(input.cpcExp),
      nullify(input.cardExp),
      nullify(input.medicalExp),
      nullify(input.phone),
      input.active ?? true,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteDriver(id: string) {
  await pool.query(`delete from drivers where id = $1`, [id]);
}
