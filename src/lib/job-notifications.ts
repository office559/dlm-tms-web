import type { Job } from "@/lib/jobs";
import { setJobWhatsAppSent } from "@/lib/jobs";
import { getDriver } from "@/lib/drivers";
import { getCustomer } from "@/lib/customers";
import { getSettings } from "@/lib/settings";
import { toE164 } from "@/lib/whatsapp";
import { sendWhatsAppTemplate } from "@/lib/twilio";
import { isCloudApiConfigured, sendWhatsAppCloudTemplate } from "@/lib/whatsapp-cloud";

type TemplateConfig = {
  /** Variabila de mediu cu Content SID-ul Twilio (ex. "TWILIO_CONTENT_SID_JOB_ASSIGNED"). */
  twilioContentSidEnv: string;
  /** Variabila de mediu cu numele șablonului Meta (ex. "WHATSAPP_TEMPLATE_JOB_ASSIGNED"). */
  cloudTemplateEnv: string;
  /** Payload-ul butonului "Răspuns rapid" al șablonului Meta, dacă are unul. */
  cloudQuickReplyPayload?: string;
};

/**
 * Caută șoferul cursei și telefonul lui și, dacă le găsește, trimite
 * șablonul aprobat.
 *
 * Furnizorul se alege automat: dacă sunt setate variabilele WhatsApp Cloud
 * API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID), se trimite direct
 * prin Meta; altfel se folosește Twilio (comportamentul de până acum).
 * Nu face nimic dacă șablonul nu e configurat, cursa nu are șofer sau
 * șoferul nu are telefon valid.
 *
 * Cu `trackConfirmation`, ID-ul mesajului trimis se salvează pe cursă, ca
 * apăsarea butonului "Confirm" și statusul "citit" să poată fi asociate
 * cursei.
 */
async function sendJobTemplate(
  job: Job,
  config: TemplateConfig,
  buildVariables: (driverName: string) => Record<string, string>,
  opts?: { trackConfirmation?: boolean }
) {
  const useCloud = isCloudApiConfigured();
  const cloudTemplate = process.env[config.cloudTemplateEnv];
  const contentSid = process.env[config.twilioContentSidEnv];

  if (useCloud ? !cloudTemplate : !contentSid) {
    console.warn(
      `${useCloud ? config.cloudTemplateEnv : config.twilioContentSidEnv} nu este setat — notificare WhatsApp omisă.`
    );
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

  const variables = buildVariables(driver.name);
  let messageId: string | null = null;

  if (useCloud && cloudTemplate) {
    messageId = await sendWhatsAppCloudTemplate(to, cloudTemplate, variables, {
      quickReplyPayload: config.cloudQuickReplyPayload,
    });
  } else if (contentSid) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const statusCallbackUrl =
      opts?.trackConfirmation && appUrl
        ? `${appUrl.replace(/\/$/, "")}/api/webhooks/twilio/status`
        : undefined;
    messageId = await sendWhatsAppTemplate(to, contentSid, variables, statusCallbackUrl);
  }

  if (opts?.trackConfirmation && messageId) {
    await setJobWhatsAppSent(job.id, messageId);
  }
}

async function notifyJobAssigned(job: Job) {
  const customer = job.client_id ? await getCustomer(job.client_id) : null;

  await sendJobTemplate(
    job,
    {
      twilioContentSidEnv: "TWILIO_CONTENT_SID_JOB_ASSIGNED",
      cloudTemplateEnv: "WHATSAPP_TEMPLATE_JOB_ASSIGNED",
      cloudQuickReplyPayload: "confirma",
    },
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
  await sendJobTemplate(
    job,
    {
      twilioContentSidEnv: "TWILIO_CONTENT_SID_JOB_CANCELLED",
      cloudTemplateEnv: "WHATSAPP_TEMPLATE_JOB_CANCELLED",
    },
    () => ({
      "1": `${job.load_place || "—"} → ${job.unload_place || "—"}`,
      "2": job.ref ?? "—",
    })
  );
}

/**
 * Compară cursa înainte/după o creare sau modificare și trimite
 * notificările WhatsApp automate relevante:
 *  - șofer nou alocat (sau schimbat) → șablonul "cursă alocată"
 *  - statusul tocmai a devenit "anulat" → șablonul "cursă anulată"
 *
 * `before` e null la creare. Nu aruncă niciodată erori — eșecurile
 * (configurare lipsă, șablon neaprobat etc.) sunt doar logate, ca să nu
 * strice cererea de creare/modificare a cursei.
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
