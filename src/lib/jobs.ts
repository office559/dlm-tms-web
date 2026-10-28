import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

export type Job = {
  id: string;
  kind: string;
  client_id: string | null;
  ref: string | null;
  load_place: string | null;
  unload_place: string | null;
  load_country: string | null;
  unload_country: string | null;
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
  cancel_fee: number | null;
  created_at: Date;
  wa_message_sid: string | null;
  wa_sent_at: Date | null;
  wa_read_at: Date | null;
  wa_confirmed_at: Date | null;
  km_start: number | null;
  km_end: number | null;
};

export type JobInput = {
  kind?: string | null;
  clientId?: string | null;
  ref?: string | null;
  loadPlace?: string | null;
  unloadPlace?: string | null;
  loadCountry?: string | null;
  unloadCountry?: string | null;
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

/** Cod de țară din 2 litere (ex. "de" → "DE"); gol / invalid → null. */
function countryCode(v: string | null | undefined): string | null {
  const c = (v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * Când o cursă devine "finalizat":
 *  - locația mașinii devine locul de descărcare al cursei (dacă e completat);
 *  - dacă mașina mai are o altă cursă planificată, mașina trece în "Viitor"
 *    (fără stare forțată), iar cursa următoare rămâne în Planificare până o
 *    pune dispecerul în Tranzit;
 *  - altfel mașina trece în "pending", până o mută dispecerul în Disponibil /
 *    Pauză / Indisponibil. O mașină aflată pe "Staționare" rămâne așa.
 */
async function syncVehicleAfterFinish(job: Job | null) {
  if (!job || job.status !== "finalizat" || !job.vehicle_id) return;
  const place = (job.unload_place ?? "").trim();
  await pool.query(
    `update vehicles
        set location = coalesce(nullif($2, ''), location),
            state_override = case
              when state_override = 'stationare' then state_override
              when exists (
                select 1 from jobs
                 where vehicle_id = $1
                   and organization_id = $4
                   and status = 'planificare'
                   and id <> $3
              ) then null
              else 'pending'
            end
      where id = $1 and organization_id = $4`,
    [job.vehicle_id, place, job.id, await orgId()]
  );
}

/**
 * Când o cursă pornește (devine "activ" / Tranzit), pauza zilnică a mașinii
 * dispare din tabel. Programul rămâne neschimbat.
 */
async function clearPauseOnTransit(job: Job | null) {
  if (!job || job.status !== "activ" || !job.vehicle_id) return;
  await pool.query(
    `update vehicles
        set pause = false,
            rest_dur_h = null,
            rest_start = null,
            rest_end = null,
            rest_start_at = null,
            rest_end_at = null
      where id = $1 and organization_id = $2 and pause = true`,
    [job.vehicle_id, await orgId()]
  );
}

/**
 * Când o cursă se anulează: dacă mașina nu mai are altă cursă planificată sau
 * în Tranzit, nu mai rămâne "pending" — dacă e în pauză își continuă pauza, iar
 * dacă nu, devine Disponibil. (Staționare / Indisponibil setate manual rămân.)
 */
async function releaseVehicleAfterCancel(job: Job | null) {
  if (!job || job.status !== "anulat" || !job.vehicle_id) return;
  await pool.query(
    `update vehicles
        set state_override = null
      where id = $1
        and organization_id = $3
        and state_override = 'pending'
        and not exists (
          select 1 from jobs
           where vehicle_id = $1
             and organization_id = $3
             and status in ('planificare', 'activ')
             and id <> $2
        )`,
    [job.vehicle_id, job.id, await orgId()]
  );
}

export async function listJobs() {
  const { rows } = await pool.query<Job>(
    `select * from jobs where organization_id = $1 order by coalesce(start_at, created_at) desc`,
    [await orgId()]
  );
  return rows;
}

export async function getJob(id: string) {
  const { rows } = await pool.query<Job>(
    `select * from jobs where id = $1 and organization_id = $2`,
    [id, await orgId()]
  );
  return rows[0] ?? null;
}

export async function createJob(input: JobInput) {
  const id = genJobId();
  const { rows } = await pool.query<Job>(
    `insert into jobs (
       id, kind, client_id, ref, load_place, unload_place, start_at, end_at,
       miles, currency, rate, extra, driver_id, vehicle_id, trailer_id,
       dispatcher_id, status, notes, invoice, paid_at, load_country, unload_country, organization_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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
      countryCode(input.loadCountry),
      countryCode(input.unloadCountry),
      await orgId(),
    ]
  );
  const created = rows[0];
  await clearPauseOnTransit(created ?? null);
  return created;
}

export async function updateJob(id: string, input: JobInput) {
  // statusul de dinainte: mașina se schimbă doar la trecerea în "finalizat"
  const org = await orgId();
  const prev = await pool.query<{ status: string }>(
    `select status from jobs where id = $1 and organization_id = $2`,
    [id, org]
  );
  const prevStatus = prev.rows[0]?.status ?? null;

  const { rows } = await pool.query<Job>(
    `update jobs set
       kind = $2, client_id = $3, ref = $4, load_place = $5, unload_place = $6,
       start_at = $7, end_at = $8, miles = $9, currency = $10, rate = $11, extra = $12,
       driver_id = $13, vehicle_id = $14, trailer_id = $15, dispatcher_id = $16,
       status = $17, notes = $18, invoice = $19, paid_at = $20,
       load_country = $21, unload_country = $22
     where id = $1 and organization_id = $23
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
      countryCode(input.loadCountry),
      countryCode(input.unloadCountry),
      org,
    ]
  );
  const job = rows[0] ?? null;
  if (job && job.status === "finalizat" && prevStatus !== "finalizat") {
    await syncVehicleAfterFinish(job);
  }
  if (job && job.status === "activ" && prevStatus !== "activ") {
    await clearPauseOnTransit(job);
  }
  if (job && job.status === "anulat" && prevStatus !== "anulat") {
    await releaseVehicleAfterCancel(job);
  }
  return job;
}

export async function deleteJob(id: string) {
  await pool.query(`delete from jobs where id = $1 and organization_id = $2`, [id, await orgId()]);
}

/**
 * Schimbare rapidă doar a statusului unei curse (din Planificare).
 * `cancelFee` se salvează doar când statusul devine "anulat".
 * `km` (opțional) salvează kilometrajul de pe bord: start și/sau final;
 * o valoare lipsă (null) nu șterge ce era salvat deja.
 * La "finalizat": locația mașinii = locul de descărcare; mașina trece în "Viitor" dacă mai are
 * o cursă planificată, altfel în "pending".
 * La "activ" (Tranzit): pauza zilnică a mașinii dispare, programul rămâne.
 * La "anulat": mașina iese din "pending"; își continuă pauza sau devine Disponibil.
 */
export async function patchJobStatus(
  id: string,
  status: string,
  cancelFee?: number | null,
  km?: { start?: number | null; end?: number | null }
) {
  const { rows } = await pool.query<Job>(
    `update jobs set
       status = $2,
       cancel_fee = case when $2 = 'anulat' then $3 else cancel_fee end,
       km_start = coalesce($4::numeric, km_start),
       km_end = coalesce($5::numeric, km_end)
     where id = $1 and organization_id = $6
     returning *`,
    [id, status, cancelFee ?? null, km?.start ?? null, km?.end ?? null, await orgId()]
  );
  const job = rows[0] ?? null;
  await syncVehicleAfterFinish(job);
  await clearPauseOnTransit(job);
  await releaseVehicleAfterCancel(job);
  return job;
}

/** Salvează SID-ul mesajului WhatsApp trimis pentru cursă și resetează citirea/confirmarea. */
export async function setJobWhatsAppSent(id: string, messageSid: string) {
  await pool.query(
    `update jobs
       set wa_message_sid = $2, wa_sent_at = now(), wa_read_at = null, wa_confirmed_at = null
     where id = $1 and organization_id = $3`,
    [id, messageSid, await orgId()]
  );
}

/**
 * Marchează mesajul cu acest SID ca citit (nu suprascrie o citire existentă).
 * Apelată din webhook (fără sesiune): SID-ul mesajului e unic, deci nu filtrează pe organizație.
 */
export async function markWhatsAppReadBySid(messageSid: string) {
  await pool.query(
    `update jobs set wa_read_at = now() where wa_message_sid = $1 and wa_read_at is null`,
    [messageSid]
  );
}

/**
 * Cea mai recentă cursă a unui șofer cu mesaj WhatsApp trimis și neconfirmată încă.
 * Apelată din webhook (fără sesiune): id-ul șoferului e unic, deci nu filtrează pe organizație.
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

/** Marchează o cursă ca fiind confirmată de șofer prin WhatsApp (apelată din webhook, după id-ul cursei). */
export async function markJobConfirmed(jobId: string) {
  await pool.query(`update jobs set wa_confirmed_at = now() where id = $1`, [jobId]);
}
