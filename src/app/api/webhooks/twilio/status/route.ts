import { NextRequest, NextResponse } from "next/server";
import { markWhatsAppReadBySid } from "@/lib/jobs";

/**
 * Twilio "StatusCallback" webhook — apelat automat de Twilio de fiecare
 * dată când starea unui mesaj WhatsApp trimis de noi se schimbă (queued,
 * sent, delivered, read, failed...). Nu necesită configurare manuală în
 * Twilio Console: URL-ul e trimis o dată cu fiecare mesaj (parametrul
 * StatusCallback din sendWhatsAppTemplate).
 *
 * Ne interesează doar tranziția către "read", ca să marcăm cursa
 * corespunzătoare ca citită de șofer. Reținem: acest status apare doar
 * dacă șoferul are confirmările de citire ("read receipts") activate în
 * WhatsApp — altfel Twilio nu ne va trimite niciodată "read" pentru acel
 * mesaj, indiferent dacă șoferul a deschis efectiv conversația.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const messageSid = form.get("MessageSid")?.toString();
    const status = form.get("MessageStatus")?.toString();

    if (messageSid && status === "read") {
      await markWhatsAppReadBySid(messageSid);
    }
  } catch (err) {
    console.error("Webhook Twilio (status) eșuat:", err);
  }

  return new NextResponse(null, { status: 204 });
}
