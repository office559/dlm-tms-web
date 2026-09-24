/**
 * Sends a WhatsApp message via the Twilio API. Reads credentials from
 * environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_WHATSAPP_FROM). If they're not configured, logs a warning and
 * does nothing instead of throwing, so the app keeps working even before
 * Twilio is set up.
 *
 * @param toE164 Recipient's phone number in E.164 format, e.g. "+40722123456".
 * @param body Message text.
 */
export async function sendWhatsAppMessage(toE164: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    console.warn(
      "Twilio nu este configurat (lipsesc variabilele de mediu TWILIO_*) — mesajul WhatsApp automat a fost omis."
    );
    return;
  }

  const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: `whatsapp:${toE164}`,
    From: from,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio a răspuns cu eroare (${res.status}): ${text}`);
  }
}

/**
 * Sends a WhatsApp message using an approved Content Template (required by
 * WhatsApp for any business-initiated message, i.e. one not sent as a reply
 * within 24h of the recipient messaging first). Reads the same TWILIO_*
 * credentials as sendWhatsAppMessage.
 *
 * @param toE164 Recipient's phone number in E.164 format, e.g. "+40722123456".
 * @param contentSid The approved template's SID (starts with "HX...").
 * @param variables Values for the template's numbered placeholders, e.g. {"1": "Ion", "2": "..."}.
 * @param statusCallbackUrl Optional URL where Twilio will POST delivery/read status updates.
 * @returns The Twilio message SID on success, or null if Twilio isn't configured.
 */
export async function sendWhatsAppTemplate(
  toE164: string,
  contentSid: string,
  variables: Record<string, string>,
  statusCallbackUrl?: string
): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    console.warn(
      "Twilio nu este configurat (lipsesc variabilele de mediu TWILIO_*) — mesajul WhatsApp automat a fost omis."
    );
    return null;
  }

  const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: `whatsapp:${toE164}`,
    From: from,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });
  if (statusCallbackUrl) {
    params.set("StatusCallback", statusCallbackUrl);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio a răspuns cu eroare (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { sid?: string };
  return data.sid ?? null;
}
