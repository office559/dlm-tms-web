import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { listDrivers } from "@/lib/drivers";
import { getSettings } from "@/lib/settings";
import { formatWaPhone } from "@/lib/whatsapp";
import {
  findLatestPendingJobForDriver,
  markJobConfirmed,
  markWhatsAppReadBySid,
} from "@/lib/jobs";

/**
 * Webhook WhatsApp Cloud API (Meta). URL-ul public al acestei rute se
 * configurează o singură dată în Meta for Developers → aplicația ta →
 * WhatsApp → Configuration (Callback URL + Verify token), cu câmpul
 * "messages" abonat.
 *
 * GET  — verificarea webhook-ului (Meta trimite hub.challenge).
 * POST — evenimente: statusuri (sent/delivered/read/failed) și mesaje primite
 *        (apăsarea butonului "Confirm" sau un text care conține "confirm").
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.warn("WHATSAPP_APP_SECRET nu este setat — semnătura webhook-ului nu este verificată.");
    return true;
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type InboundMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};

type StatusEvent = {
  id?: string;
  status?: string;
  errors?: { code?: number; title?: string; message?: string }[];
};

type WebhookBody = {
  entry?: {
    changes?: {
      value?: { messages?: InboundMessage[]; statuses?: StatusEvent[] };
    }[];
  }[];
};

function isConfirmation(m: InboundMessage) {
  const payload = (
    m.button?.payload ??
    m.interactive?.button_reply?.id ??
    ""
  ).toLowerCase();
  const text = (
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.text?.body ??
    ""
  ).toLowerCase();
  return payload === "confirma" || text.includes("confirm");
}

async function handleConfirmation(from: string) {
  const settings = await getSettings();
  const waCountry = settings?.wa_country ?? null;
  const fromDigits = formatWaPhone(`+${from.replace(/\D/g, "")}`, waCountry);
  if (!fromDigits) return;

  const drivers = await listDrivers();
  const driver = drivers.find((d) => formatWaPhone(d.phone, waCountry) === fromDigits);
  if (!driver) {
    console.warn("Confirmare WhatsApp primită de la un număr necunoscut:", from);
    return;
  }

  const job = await findLatestPendingJobForDriver(driver.id);
  if (job) await markJobConfirmed(job.id);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const body = JSON.parse(raw) as WebhookBody;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        for (const s of value?.statuses ?? []) {
          if (s.id && s.status === "read") {
            await markWhatsAppReadBySid(s.id);
          }
          if (s.status === "failed") {
            console.error("WhatsApp: mesaj eșuat", s.id, JSON.stringify(s.errors ?? []));
          }
        }

        for (const m of value?.messages ?? []) {
          if (m.from && isConfirmation(m)) {
            await handleConfirmation(m.from);
          }
        }
      }
    }
  } catch (err) {
    console.error("Webhook WhatsApp Cloud API eșuat:", err);
  }

  // Meta cere 200 rapid; altfel retrimite evenimentul.
  return new NextResponse(null, { status: 200 });
}
