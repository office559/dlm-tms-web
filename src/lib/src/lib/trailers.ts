import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Trailer = {
  id: string;
  plate: string;
  type: string | null;
  owner_id: string | null;
  itp_exp: string | null;
  rca_exp: string | null;
  casco_exp: string | null;
  active: boolean;
  created_at: Date;
};

export type TrailerInput = {
  plate: string;
  type?: string | null;
  itpExp?: string | null;
  rcaExp?: string | null;
  cascoExp?: string | null;
  active?: boolean;
};

export function genTrailerId() {
  return "t" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listTrailers() {
  const { rows } = await pool.query<Trailer>(`select * from trailers order by plate asc`);
  return rows;
}

export async function getTrailer(id: string) {
  const { rows } = await pool.query<Trailer>(`select * from trailers where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createTrailer(input: TrailerInput) {
  const id = genTrailerId();
  const { rows } = await pool.query<Trailer>(
    `insert into trailers (id, plate, type, itp_exp, rca_exp, casco_exp, active)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [
      id,
      input.plate.trim(),
      nullify(input.type),
      nullify(input.itpExp),
      nullify(input.rcaExp),
      nullify(input.cascoExp),
      input.active ?? true,
    ]
  );
  return rows[0];
}

export async function updateTrailer(id: string, input: TrailerInput) {
  const { rows } = await pool.query<Trailer>(
    `update trailers set
       plate = $2, type = $3, itp_exp = $4, rca_exp = $5, casco_exp = $6, active = $7
     where id = $1
     returning *`,
    [
      id,
      input.plate.trim(),
      nullify(input.type),
      nullify(input.itpExp),
      nullify(input.rcaExp),
      nullify(input.cascoExp),
      input.active ?? true,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteTrailer(id: string) {
  await pool.query(`delete from trailers where id = $1`, [id]);
}
