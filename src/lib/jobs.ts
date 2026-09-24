import { randomBytes } from "crypto";
import { pool } from "@/lib/db";

export type Job = {
  id: string;
  kind: string;
  client_id: string | null;
  ref: string | null;
  load_place: string | null;
  unload_place: string | null;
  start_at: Date | null;
  end_at: Date | null;
  dist_unit: string | null;
  miles: number | null;
  currency: string | null;
  rate: number | null;
  extra: number | null;
  driver_id: string | null;
  vehicle_id: string | null;
  trailer_id: string | null;
  dispatcher_id: string | null;
  status: string;
  notes: string | null;
  invoice: string;
  paid_at: string | null;
  created_at: Date;
  wa_message_sid: string | null;
  wa_sent_at: Date | null;
  wa_read_at: Date | null;
  wa_confirmed_at: Date | null;
};

export type JobInput = {
  kind?: string | null;
  clientId?: string | null;
  ref?: string | null;
  loadPlace?: string | null;
  unloadPlace?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  miles?: number | null;
  currency?: string | null;
  rate?: number | null;
  extra?: number | null;
  driverId?: string | null;
  vehicleId?: string | null;
  trailerId?: string | null;
  dispatcherId?: string | null;
  status?: string | null;
  notes?: string | null;
  invoice?: string | null;
  paidAt?: string | null;
};

export function genJobId() {
  return "j" + randomBytes(5).toString("hex");
}

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function listJobs() {
  const { rows } = await pool.query<Job>(
    `select * from jobs order by coalesce(start_at, created_at) desc`
  );
  return rows;
}

export async function getJob(id: string) {
  const { rows } = await pool.query<Job>(`select * from jobs where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createJob(input: JobInput) {
  const id = genJobId();
  const { rows } = await pool.query<Job>(
    `insert into jobs (
       id, kind, client_id, ref, load_place, unload_place, start_at, end_at,
       miles, currency, rate, extra, driver_id, vehicle_id, trailer_id,
       dispatcher_id, status, notes, invoice, paid_at
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     returning *`,
    [
      id,
      input.kind?.trim() || "curse",
      nullify(input.clientId),
      nullify(input.ref),
      nullify(input.loadPlace),
      nullify(input.unloadPlace),
      nullify(input.startAt),
      nullify(input.endAt),
      input.miles ?? null,
      nullify(input.currency),
      input.rate ?? null,
      input.extra ?? null,
      nullify(input.driverId),
      nullify(input.vehicleId),
      nullify(input.trailerId),
      nullify(input.dispatcherId),
      input.status?.trim() || "planificare",
      nullify(input.notes),
      input.invoice?.trim() || "none",
      nullify(input.paidAt),
    ]
  );
  return rows[0];
}

export async function updateJob(id: string, input: JobInput) {
  const { rows } = await pool.query<Job>(
    `update jobs set
       kind = $2, client_id = $3, ref = $4, load_place = $5, unload_place = $6,
       start_at = $7, end_at = $8, miles = $9, currency = $10, rate = $11, extra = $12,
       driver_id = $13, vehicle_id = $14, trailer_id = $15, dispatcher_id = $16,
       status = $17, notes = $18, invoice = $19, paid_at = $20
     where id = $1
     returning *`,
    [
      id,
      input.kind?.trim() || "curse",
      nullify(input.clientId),
      nullify(input.ref),
      nullify(input.loadPlace),
      nullify(input.unloadPlace),
      nullify(input.startAt),
      nullify(input.endAt),
      input.miles ?? null,
      nullify(input.currency),
      input.rate ?? null,
      input.extra ?? null,
      nullify(input.driverId),
      nullify(input.vehicleId),
      nullify(input.trailerId),
      nullify(input.dispatcherId),
      input.status?.trim() || "planificare",
      nullify(input.notes),
      input.invoice?.trim() || "none",
      nullify(input.paidAt),
    ]
  );
  return rows[0] ?? null;
}

export async function deleteJob(id: string) {
  await pool.query(`delete from jobs where id = $1`, [id]);
}

/**
 * Salvează SID-ul mesajului WhatsApp trimis automat pentru această cursă și
 * resetează starea de citire/confirmare (folosit când se trimite o
 * notificare nouă de alocare — de ex. dacă șoferul e schimbat din nou).
 */
export async function setJobWhatsAppSent(id: string, messageSid: string) {
  await pool.query(
    `update jobs
       set wa_message_sid = $2, wa_sent_at = now(), wa_read_at = null, wa_confirmed_at = null
     where id = $1`,
    [id, messageSid]
  );
}

/**
 * Marchează mesajul cu acest SID ca citit (apelat din webhook-ul de status
 * al Twilio, când MessageStatus devine "read"). Nu suprascrie o citire deja
 * înregistrată.
 */
export async function markWhatsAppReadBySid(messageSid: string) {
  await pool.query(
    `update jobs set wa_read_at = now() where wa_message_sid = $1 and wa_read_at is null`,
    [messageSid]
  );
}

/**
 * Găsește cea mai recentă cursă a unui șofer pentru care s-a trimis un
 * mesaj WhatsApp și care încă nu a fost confirmată (folosit din webhook-ul
 * de mesaje primite, când șoferul apasă butonul "Confirmă").
 */
export async function findLatestPendingJobForDriver(driverId: string) {
  const { rows } = await pool.query<Job>(
    `select * from jobs
      where driver_id = $1
        and wa_message_sid is not null
        and wa_confirmed_at is null
      order by wa_sent_at desc nulls last
      limit 1`,
    [driverId]
  );
  return rows[0] ?? null;
}

/** Marchează o cursă ca fiind confirmată de șofer prin WhatsApp. */
export async function markJobConfirmed(jobId: string) {
  await pool.query(`update jobs set wa_confirmed_at = now() where id = $1`, [jobId]);
}
