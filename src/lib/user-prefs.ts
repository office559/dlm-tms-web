import { pool } from "@/lib/db";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/tz";

/** Fusul orar ales de utilizator (implicit: București). */
export async function getUserTimezone(userId: string): Promise<string> {
  const { rows } = await pool.query<{ timezone: string }>(
    `select timezone from user_prefs where user_id = $1`,
    [userId]
  );
  const tz = rows[0]?.timezone;
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

export async function setUserTimezone(userId: string, timezone: string) {
  await pool.query(
    `insert into user_prefs (user_id, timezone, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set timezone = excluded.timezone, updated_at = now()`,
    [userId, timezone]
  );
}
