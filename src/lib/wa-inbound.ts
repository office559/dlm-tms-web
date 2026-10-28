import { pool } from "@/lib/db";
import { formatWaPhone } from "@/lib/whatsapp";
import { findLatestPendingJobForDriver, markJobConfirmed } from "@/lib/jobs";

/**
 * Confirmarea cursei prin WhatsApp (webhook-uri, fără sesiune): numărul care a răspuns se
 * caută între șoferii TUTUROR organizațiilor active (fiecare cu prefixul de țară din setările
 * firmei lui). Dacă același număr apare la mai mulți șoferi, se confirmă cursa în așteptare a
 * primului care are una.
 *
 * Întoarce true dacă a confirmat o cursă.
 */
export async function confirmJobFromWhatsAppNumber(rawFrom: string): Promise<boolean> {
  const digits = rawFrom.replace(/\D/g, "");
  if (!digits) return false;

  const { rows } = await pool.query<{ id: string; phone: string; wa_country: string | null }>(
    `select d.id, d.phone, s.wa_country
       from drivers d
       join organizations o on o.id = d.organization_id and o.active
       left join settings s on s.organization_id = d.organization_id
      where d.phone is not null and btrim(d.phone) <> ''`
  );

  let known = false;
  for (const d of rows) {
    const fromDigits = formatWaPhone(`+${digits}`, d.wa_country);
    if (!fromDigits || formatWaPhone(d.phone, d.wa_country) !== fromDigits) continue;
    known = true;
    const job = await findLatestPendingJobForDriver(d.id);
    if (job) {
      await markJobConfirmed(job.id);
      return true;
    }
  }
  if (!known) console.warn("Confirmare WhatsApp primită de la un număr necunoscut:", rawFrom);
  return false;
}
