import type { Job } from "@/lib/jobs";
import { getDriver, setJobWhatsAppSent } from "@/lib/jobs";
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
 *
 * When `trackConfirmation` is true, the message is sent with a
 * StatusCallback pointing at our webhook (so we learn when it's delivered/
 * read) and the returned message SID is saved on the job, so the "Confirmă"
 * button tap (handled by a separate inbound webhook) can be matched back to
 * this job.
 */
async function sendJobTemplate(
  job: Job,
  contentSidEnvVar: string,
  buildVariables: (driverName: string) => Record<string, string>,
  opts?: { trackConfirmation?: boolean }
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const statusCallbackUrl =
    opts?.trackConfirmation && appUrl
      ? `${appUrl.replace(/\/$/, "")}/api/webhooks/twilio/status`
      : undefined;

  const messageSid = await sendWhatsAppTemplate(
    to,
    contentSid,
    buildVariables(driver.name),
    statusCallbackUrl
  );

  if (opts?.trackConfirmation && messageSid) {
    await setJobWhatsAppSent(job.id, messageSid);
  }
}

async function notifyJobAssigned(job: Job) {
  const customer = job.client_id ? await getCustomer(job.client_id) : null;

  await sendJobTemplate(
    job,
    "TWILIO_CONTENT_SID_JOB_ASSIGNED",
    (driverName) => ({
      "1": driverName,
      "2": job.start_at ? new Date(job.start_at).toLocaleString("ro-RO") : "—",
      "3": job.load_place || "—",
      "4": job.end_at ? new Date(job.end_at).toLocaleString("ro-RO") : "—",
      "5": job.unload_place || "—",
      "6": customer?.name ?? "—",
      "7": job.ref ?? "—",
    }),
    { trackConfirmation: true }
  );
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
