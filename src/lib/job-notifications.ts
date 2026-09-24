import type { Job } from "@/lib/jobs";
import { getDriver } from "@/lib/drivers";
import { getCustomer } from "@/lib/customers";
import { getSettings } from "@/lib/settings";
import { toE164 } from "@/lib/whatsapp";
import { sendWhatsAppTemplate } from "@/lib/twilio";

/**
 * Looks up the job's driver + phone, and if found, sends the given
 * approved Content Template (env var name, e.g. "TWILIO_CONTENT_SID_JOB_ASSIGNED")
 * with variables built from the driver's name. Silently does nothing if the
 * template isn't configured, the job has no driver, or the driver has no
 * usable phone number.
 */
async function sendJobTemplate(
  job: Job,
  contentSidEnvVar: string,
  buildVariables: (driverName: string) => Record<string, string>
) {
  const contentSid = process.env[contentSidEnvVar];
  if (!contentSid) {
    console.warn(`${contentSidEnvVar} nu este setat — notificare WhatsApp omisă.`);
    return;
  }
  if (!job.driver_id) return;

  const [driver, settings] = await Promise.all([
    getDriver(job.driver_id),
    getSettings(),
  ]);
  if (!driver?.phone) return;

  const to = toE164(driver.phone, settings?.wa_country ?? null);
  if (!to) return;

  await sendWhatsAppTemplate(to, contentSid, buildVariables(driver.name));
}

async function notifyJobAssigned(job: Job) {
  const customer = job.client_id ? await getCustomer(job.client_id) : null;

  await sendJobTemplate(job, "TWILIO_CONTENT_SID_JOB_ASSIGNED", (driverName) => ({
    "1": driverName,
    "2": `${job.load_place || "—"} → ${job.unload_place || "—"}`,
    "3": job.start_at ? new Date(job.start_at).toLocaleString("ro-RO") : "—",
    "4": customer?.name ?? "—",
    "5": job.ref ?? "—",
  }));
}

async function notifyJobCancelled(job: Job) {
  await sendJobTemplate(job, "TWILIO_CONTENT_SID_JOB_CANCELLED", () => ({
    "1": `${job.load_place || "—"} → ${job.unload_place || "—"}`,
    "2": job.ref ?? "—",
  }));
}

/**
 * Compares the job before/after a create or update and fires the relevant
 * automatic WhatsApp notifications:
 *  - driver newly assigned (or changed) → "cursă alocată" template
 *  - status just became "anulat" → "cursă anulată" template
 *
 * `before` is null on creation. Never throws — failures (missing Twilio
 * config, template not yet approved, recipient outside the sandbox
 * allow-list, etc.) are logged and swallowed so they never break the job
 * create/update request itself.
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
