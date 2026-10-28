import { Pool } from "pg";
import { randomBytes } from "crypto";

// Pool unic, refolosit de toată aplicația (Better Auth îl folosește direct,
// iar noi îl refolosim pentru tabelele proprii: dispatcher_invites, dispatchers).
// Atenție: acest fișier NU importă static "@/lib/org" (ar crea un ciclu cu auth.ts).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type DispatcherInvite = {
  id: string;
  organization_id: string;
  org_role: string;
  email: string;
  name: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export type Dispatcher = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  created_at: Date;
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 zile

export async function createDispatcherInvite(params: {
  email: string;
  name: string;
  organizationId: string;
  /** Rolul din organizație: implicit dispecer; "admin" doar din panoul platformei. */
  orgRole?: "admin" | "dispatcher";
}) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { rows } = await pool.query<DispatcherInvite>(
    `insert into dispatcher_invites (email, name, token, expires_at, organization_id, org_role)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      params.email.toLowerCase().trim(),
      params.name.trim(),
      token,
      expiresAt,
      params.organizationId,
      params.orgRole ?? "dispatcher",
    ]
  );
  return rows[0];
}

export async function getDispatcherInviteByToken(token: string) {
  const { rows } = await pool.query<DispatcherInvite>(
    `select * from dispatcher_invites where token = $1 limit 1`,
    [token]
  );
  return rows[0] ?? null;
}

export async function markInviteUsed(id: string) {
  await pool.query(`update dispatcher_invites set used_at = now() where id = $1`, [id]);
}

export async function createDispatcherRecord(params: {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
}) {
  const { rows } = await pool.query<Dispatcher>(
    `insert into dispatchers (user_id, name, email, active, organization_id)
     values ($1, $2, $3, true, $4)
     returning *`,
    [params.userId, params.name, params.email.toLowerCase().trim(), params.organizationId]
  );
  return rows[0];
}

/** Dispecerii organizației active (import dinamic: evită ciclul db → org → auth → db). */
export async function listDispatchers() {
  const { orgId } = await import("@/lib/org");
  const { rows } = await pool.query<Dispatcher>(
    `select * from dispatchers where organization_id = $1 order by created_at desc`,
    [await orgId()]
  );
  return rows;
}

export async function getDispatcherById(id: string, organizationId: string) {
  const { rows } = await pool.query<Dispatcher>(
    `select * from dispatchers where id = $1 and organization_id = $2 limit 1`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

/** Leagă un utilizator de o organizație, cu un rol (admin / dispatcher / viewer). */
export async function addMembership(userId: string, organizationId: string, orgRole: string) {
  await pool.query(
    `insert into memberships (user_id, organization_id, org_role)
     values ($1, $2, $3)
     on conflict (user_id) do update
       set organization_id = excluded.organization_id, org_role = excluded.org_role`,
    [userId, organizationId, orgRole]
  );
}

/**
 * Șterge contul unui dispecer din organizația lui: utilizatorul (iar sesiunile, conturile și
 * rândul din "dispatchers" dispar prin ON DELETE CASCADE) și apartenența lui.
 * Întoarce "not_found" dacă dispecerul nu aparține organizației și "protected" pentru
 * proprietarul platformei (acela nu se șterge de aici).
 */
export async function deleteDispatcherAccount(dispatcherId: string, organizationId: string) {
  const d = await getDispatcherById(dispatcherId, organizationId);
  if (!d) return "not_found" as const;
  const role = await pool.query<{ role: string | null }>(`select role from "user" where id = $1`, [d.user_id]);
  if (role.rows[0]?.role === "admin") return "protected" as const;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`delete from memberships where user_id = $1 and organization_id = $2`, [
      d.user_id,
      organizationId,
    ]);
    await client.query(`delete from "user" where id = $1`, [d.user_id]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return "ok" as const;
}
