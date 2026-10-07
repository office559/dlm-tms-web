/**
 * Client minimal pentru WhatsApp Cloud API (Meta), fără intermediar.
 * Variabile de mediu (Vercel):
 *  - WHATSAPP_ACCESS_TOKEN      token permanent (System User)
 *  - WHATSAPP_PHONE_NUMBER_ID   ID-ul numărului de telefon din WhatsApp Manager
 *  - WHATSAPP_VERIFY_TOKEN      șir ales de noi, pentru verificarea webhook-ului
 *  - WHATSAPP_APP_SECRET        (opțional, recomandat) App Secret, pentru semnătura webhook-ului
 *  - WHATSAPP_TEMPLATE_JOB_ASSIGNED   numele șablonului aprobat (ex. cursa_alocata_v2)
 *  - WHATSAPP_TEMPLATE_JOB_CANCELLED  numele șablonului aprobat (ex. cursa_anulata_v2)
 */

const GRAPH_VERSION = "v21.0";

export function isCloudApiConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Meta nu acceptă în parametri text goi, newline/tab sau 4+ spații
 * consecutive — curățăm valorile ca să nu respingă mesajul.
 */
function cleanParam(value: string) {
  const v = value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return v || "—";
}

/**
 * Trimite un mesaj bazat pe șablon aprobat prin Cloud API.
 *
 * @param toE164 număr în format E.164, ex. "+40722123456"
 * @param templateName numele șablonului aprobat în WhatsApp Manager
 * @param variables valorile pentru {{1}}, {{2}}, ... (cheile "1", "2", ...)
 * @param opts.quickReplyPayload dacă șablonul are un buton "Răspuns rapid",
 *        payload-ul trimis înapoi în webhook când șoferul îl apasă
 * @returns ID-ul mesajului (wamid...) sau null dacă nu e configurat
 */
export async function sendWhatsAppCloudTemplate(
  toE164: string,
  templateName: string,
  variables: Record<string, string>,
  opts?: { quickReplyPayload?: string; languageCode?: string }
): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn("WhatsApp Cloud API nu este configurat — mesaj omis.");
    return null;
  }

  const orderedKeys = Object.keys(variables).sort((a, b) => Number(a) - Number(b));
  const components: Record<string, unknown>[] = [];

  if (orderedKeys.length > 0) {
    components.push({
      type: "body",
      parameters: orderedKeys.map((k) => ({
        type: "text",
        text: cleanParam(variables[k] ?? ""),
      })),
    });
  }

  if (opts?.quickReplyPayload) {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [{ type: "payload", payload: opts.quickReplyPayload }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: opts?.languageCode ?? "ro" },
          components,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp Cloud API a răspuns cu eroare (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { messages?: { id?: string }[] };
  return data.messages?.[0]?.id ?? null;
}
