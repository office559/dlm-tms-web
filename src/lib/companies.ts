import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

export type Company = {
  id: string;
  name: string;
  active: boolean;
  created_at: Date;
};

export type CompanyWithCount = Company & { vehicle_count: number };

export function genCompanyId() {
  return "c" + randomBytes(5).toString("hex");
}

export async function listCompanies() {
  const { rows } = await pool.query<Company>(
    `select * from companies where organization_id = $1 order by name asc`,
    [await orgId()]
  );
  return rows;
}

export async function listCompaniesWithCounts() {
  const { rows } = await pool.query<CompanyWithCount>(
    `select c.*, count(v.id)::int as vehicle_count
       from companies c
       left join vehicles v on v.company_id = c.id and v.organization_id = c.organization_id
      where c.organization_id = $1
      group by c.id
      order by c.name asc`,
    [await orgId()]
  );
  return rows;
}

export async function createCompany(name: string) {
  const { rows } = await pool.query<Company>(
    `insert into companies (id, name, organization_id) values ($1, $2, $3) returning *`,
    [genCompanyId(), name.trim(), await orgId()]
  );
  return rows[0];
}

export async function updateCompany(id: string, fields: { name?: string; active?: boolean }) {
  const { rows } = await pool.query<Company>(
    `update companies
        set name = coalesce($2, name),
            active = coalesce($3, active)
      where id = $1 and organization_id = $4
      returning *`,
    [id, fields.name?.trim() || null, fields.active ?? null, await orgId()]
  );
  return rows[0] ?? null;
}

/** Șterge firma doar dacă nu mai are vehicule. Întoarce false dacă are. */
export async function deleteCompany(id: string): Promise<boolean> {
  const org = await orgId();
  const { rows } = await pool.query<{ n: number }>(
    `select count(*)::int as n from vehicles where company_id = $1 and organization_id = $2`,
    [id, org]
  );
  if ((rows[0]?.n ?? 0) > 0) return false;
  await pool.query(`delete from companies where id = $1 and organization_id = $2`, [id, org]);
  return true;
}
