import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Vehicle = {
  id: string;
  plate: string;
  type: string | null;
  owner_id: string | null;
  price: number | null;
  itp_exp: string | null;
  rca_exp: string | null;
  casco_exp: string | null;
  insurance_exp: string | null;
  tacho_exp: string | null;
  tacho_last: string | null;
  driver_id: string | null;
  driver2_id: string | null;
  trailer_id: string | null;
  location: string | null;
  shift: string | null;
  pause: boolean;
  program_start: string | null;
  program_end: string | null;
  state_override: string | null;
  rest_type: string | null;
  rest_start: string | null;
  rest_start_at: Date | null;
  rest_end: string | null;
  rest_end_at: Date | null;
  rest_dur_h: number | null;
  rest_date: string | null;
  rest_location: string | null;
  rest_reason: string | null;
  active: boolean;
  created_at: Date;
};

export type VehicleInput = {
  plate: string;
  type?: string | null;
  price?: number | null;
  itpExp?: string | null;
  rcaExp?: string | null;
  cascoExp?: string | null;
  insuranceExp?: string | null;
  tachoExp?: string | null;
  driverId?: string | null;
  trailerId?: string | null;
  location?: string | null;
  active?: boolean;
};

export function genVehicleId() {
  return "v" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listVehicles() {
  const { rows } = await pool.query<Vehicle>(`select * from vehicles order by plate asc`);
  return rows;
}

export async function getVehicle(id: string) {
  const { rows } = await pool.query<Vehicle>(`select * from vehicles where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createVehicle(input: VehicleInput) {
  const id = genVehicleId();
  const { rows } = await pool.query<Vehicle>(
    `insert into vehicles (
       id, plate, type, price, itp_exp, rca_exp, casco_exp, insurance_exp,
       tacho_exp, driver_id, trailer_id, location, active
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     returning *`,
    [
      id,
      input.plate.trim(),
      nullify(input.type),
      input.price ?? null,
      nullify(input.itpExp),
      nullify(input.rcaExp),
      nullify(input.cascoExp),
      nullify(input.insuranceExp),
      nullify(input.tachoExp),
      nullify(input.driverId),
      nullify(input.trailerId),
      nullify(input.location),
      input.active ?? true,
    ]
  );
  return rows[0];
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const { rows } = await pool.query<Vehicle>(
    `update vehicles set
       plate = $2, type = $3, price = $4, itp_exp = $5, rca_exp = $6,
       casco_exp = $7, insurance_exp = $8, tacho_exp = $9, driver_id = $10,
       trailer_id = $11, location = $12, active = $13
     where id = $1
     returning *`,
    [
      id,
      input.plate.trim(),
      nullify(input.type),
      input.price ?? null,
      nullify(input.itpExp),
      nullify(input.rcaExp),
      nullify(input.cascoExp),
      nullify(input.insuranceExp),
      nullify(input.tachoExp),
      nullify(input.driverId),
      nullify(input.trailerId),
      nullify(input.location),
      input.active ?? true,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteVehicle(id: string) {
  await pool.query(`delete from vehicles where id = $1`, [id]);
}
