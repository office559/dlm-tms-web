import { NextRequest, NextResponse } from "next/server";
import { listDrivers } from "@/lib/drivers";
import { getSettings } from "@/lib/settings";
import { formatWaPhone } from "@/lib/whatsapp";
import { findLatestPendingJobForDriver, markJobConfirmed } from "@/lib/jobs";

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

    const settings = await getSettings();
    const waCountry = settings?.wa_country ?? null;
    const fromDigits = formatWaPhone(from, waCountry);
    if (!fromDigits) return twiml();

    const drivers = await listDrivers();
    const driver = drivers.find((d) => formatWaPhone(d.phone, waCountry) === fromDigits);

    if (!driver) {
      console.warn("Confirmare WhatsApp primită de la un număr necunoscut:", from);
      return twiml();
    }

    const job = await findLatestPendingJobForDriver(driver.id);
    if (job) {
      await markJobConfirmed(job.id);
    }
  } catch (err) {
    console.error("Webhook Twilio (inbound) eșuat:", err);
  }

  return twiml();
}
