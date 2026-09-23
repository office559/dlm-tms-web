import type { Job } from "@/lib/jobs";
import { getDriver } from "@/lib/drivers";
import { getCustomer } from "@/lib/customers";
import { getSettings } from "@/lib/settings";
import { toE164 } from "@/lib/whatsapp";
import { sendWhatsAppMessage } from "@/lib/twilio";

async function sendJobWhatsApp(job: Job, lines: string[]) {
  if (!job.driver_id) return;

  const [driver, settings] = await Promise.all([
    getDriver(job.driver_id),
    getSettings(),
  ]);
  if (!driver?.phone) return;

  const to = toE164(driver.phone, settings?.wa_country ?? null);
  if (!to) return;

  await sendWhatsAppMessage(to, lines.join("\n"));
}

async function notifyJobAssigned(job: Job) {
  const customer = job.client_id ? await getCustomer(job.client_id) : null;

  const lines = [
    `Cursă nouă alocată:`,
    `${job.load_place || "—"} → ${job.unload_place || "—"}`,
  ];
  if (job.start_at) lines.push(`Start: ${new Date(job.start_at).toLocaleString("ro-RO")}`);
  if (customer) lines.push(`Client: ${customer.name}`);
  if (job.ref) lines.push(`Referință: ${job.ref}`);

  await sendJobWhatsApp(job, lines);
}

async function notifyJobCancelled(job: Job) {
  const lines = [
    `Cursa a fost anulată:`,
    `${job.load_place || "—"} → ${job.unload_place || "—"}`,
  ];
  if (job.ref) lines.push(`Referință: ${job.ref}`);

  await sendJobWhatsApp(job, lines);
}

/**
 * Compares the job before/after a create or update and fires the relevant
 * automatic WhatsApp notifications:
 *  - driver newly assigned (or changed) → "cursă nouă alocată"
 *  - status just became "anulat" → "cursă anulată"
 *
 * `before` is null on creation. Never throws — failures (missing Twilio
 * config, recipient not on the sandbox allow-list, etc.) are logged and
 * swallowed so they never break the job create/update request itself.
 */
export async function notifyJobChanges(before: Job | null, after: Job) {
  try {
    if (after.driver_id && after.driver_id !== before?.driver_id) {
      await notifyJobAssigned(after);
    }
    if (after.status === "anulat" && before?.status !== "anulat") {
      await notifyJobCancelled(after);
    }
  } catch (err) {
    console.error("Trimitere WhatsApp automată eșuată:", err);
  }
}
