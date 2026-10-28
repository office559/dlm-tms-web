import { NextRequest, NextResponse } from "next/server";
import { confirmJobFromWhatsAppNumber } from "@/lib/wa-inbound";

function twiml() {
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Webhook Twilio "WHEN A MESSAGE COMES IN" — trebuie configurat manual în
 * Twilio Console (Sandbox Settings / WhatsApp Sender Settings) cu URL-ul
 * public al acestei rute. Se declanșează atât la mesaje text primite, cât
 * și când șoferul apasă butonul "Confirmă" din șablonul Quick reply
 * (Twilio trimite ButtonPayload = ID-ul butonului, adică "confirma").
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = (form.get("From")?.toString() ?? "").replace(/^whatsapp:/, "");
    const buttonPayload = form.get("ButtonPayload")?.toString()?.toLowerCase();
    const buttonText = form.get("ButtonText")?.toString()?.toLowerCase();
    const body = form.get("Body")?.toString()?.toLowerCase();

    const isConfirm =
      buttonPayload === "confirma" ||
      buttonText?.includes("confirm") ||
      body?.includes("confirm");

    if (!isConfirm || !from) {
      return twiml();
    }

    await confirmJobFromWhatsAppNumber(from);
  } catch (err) {
    console.error("Webhook Twilio (inbound) eșuat:", err);
  }

  return twiml();
}
