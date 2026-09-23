import { Pool } from "pg";
import { randomBytes } from "crypto";

// Pool unic, refolosit de toată aplicația (Better Auth îl folosește direct,
// iar noi îl refolosim pentru tabelele proprii: dispatcher_invites, dispatchers).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type DispatcherInvite = {
  id: string;
  email: string;
  name: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export type Dispatcher = {
  id: string;
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
}) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { rows } = await pool.query<DispatcherInvite>(
    `insert into dispatcher_invites (email, name, token, expires_at)
     values ($1, $2, $3, $4)
     returning *`,
    [params.email.toLowerCase().trim(), params.name.trim(), token, expiresAt]
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
}) {
  const { rows } = await pool.query<Dispatcher>(
    `insert into dispatchers (user_id, name, email, active)
     values ($1, $2, $3, true)
     returning *`,
    [params.userId, params.name, params.email.toLowerCase().trim()]
  );
  return rows[0];
}

export async function listDispatchers() {
  const { rows } = await pool.query<Dispatcher>(
    `select * from dispatchers order by created_at desc`
  );
  return rows;
}
