import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Primește un text liber (comandă copiată din email/WhatsApp) și/sau o poză
 * (ex. comandă pe hârtie, captură de ecran) și un client Claude (Anthropic
 * Messages API, cu vedere) extrage din ele câmpurile relevante pentru
 * formularul "Adaugă cursă". Nu creează nimic în bază de date — doar
 * returnează valorile sugerate, pe care dispecerul le revede și le poate
 * corecta înainte de a salva efectiv cursa (submit-ul rămâne cel normal,
 * prin /api/jobs).
 */

const MODEL = "claude-sonnet-5";
const MAX_INPUT_LENGTH = 6000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// ~5MB în base64 (imaginea originală e ceva mai mică decât atât).
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;

const EXTRACT_TOOL = {
  name: "extract_job_details",
  description:
    "Extrage detaliile unei curse de transport rutier dintr-un text liber (email sau mesaj WhatsApp cu o comandă de transport), pentru pre-completarea unui formular. Dacă un câmp nu apare clar în text, întoarce un string gol pentru el — nu inventa valori.",
  input_schema: {
    type: "object" as const,
    properties: {
      clientName: {
        type: "string",
        description:
          "Numele companiei client (expeditorul comenzii / firma de transport care a trimis cursa), exact cum apare în text, sau string gol.",
      },
      ref: {
        type: "string",
        description: "Referință, număr de comandă sau număr de load, sau string gol.",
      },
      loadPlace: {
        type: "string",
        description:
          "Locul de încărcare. Dacă înaintea numelui orașului apare un cod scurt de depozit/terminal (ex. \"SCN2 KAISERSLAUTERN, Rhineland-Palatinate\" → \"SCN2\"), întoarce DOAR codul, fără oraș sau regiune. Dacă nu există un asemenea cod, întoarce orașul (+ țara, dacă apare). Sau string gol.",
      },
      unloadPlace: {
        type: "string",
        description:
          "Locul de descărcare — aceeași regulă ca la loadPlace: dacă apare un cod scurt de depozit/terminal înaintea orașului, întoarce DOAR codul (ex. \"DNW3 DÜSSELDORF, North Rhine-Westphalia\" → \"DNW3\"). Altfel, orașul (+ țara). Sau string gol.",
      },
      startAt: {
        type: "string",
        description:
          "Data și ora încărcării, format exact YYYY-MM-DDTHH:mm (oră locală, 24h). Dacă nu apare ora, folosește 08:00. Dacă nu apare deloc data, string gol.",
      },
      endAt: {
        type: "string",
        description: "Data și ora descărcării, același format ca startAt, sau string gol.",
      },
      miles: {
        type: "string",
        description: "Distanța (km sau mile) menționată, ca text numeric (ex. \"850\"), sau string gol.",
      },
      currency: {
        type: "string",
        description: "Simbolul monedei tarifului: €, $, £ sau RON. Dacă nu apare, string gol.",
      },
      rate: {
        type: "string",
        description: "Tariful/prețul cursei, ca text numeric (ex. \"1200\"), sau string gol.",
      },
      extra: {
        type: "string",
        description: "Costuri suplimentare menționate explicit (ex. paletizare, ADR), ca text numeric, sau string gol.",
      },
      notes: {
        type: "string",
        description:
          "Alte detalii utile din text care nu se încadrează în câmpurile de mai sus (tip marfă, instrucțiuni, contact), pe scurt.",
      },
    },
    required: [
      "clientName",
      "ref",
      "loadPlace",
      "unloadPlace",
      "startAt",
      "endAt",
      "miles",
      "currency",
      "rate",
      "extra",
      "notes",
    ],
  },
};

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY nu este configurată pe server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const customers: { id: string; name: string }[] = Array.isArray(body?.customers)
    ? body.customers
    : [];

  const rawImage = body?.image as { mediaType?: unknown; data?: unknown } | null | undefined;
  let image: { mediaType: string; data: string } | null = null;
  if (rawImage && typeof rawImage === "object") {
    const mediaType = typeof rawImage.mediaType === "string" ? rawImage.mediaType : "";
    const data = typeof rawImage.data === "string" ? rawImage.data : "";
    if (mediaType || data) {
      if (!ALLOWED_IMAGE_TYPES.includes(mediaType)) {
        return NextResponse.json(
          { error: "Format de imagine neacceptat (folosește JPG, PNG, WEBP sau GIF)." },
          { status: 400 }
        );
      }
      if (!data) {
        return NextResponse.json({ error: "Imaginea trimisă e goală." }, { status: 400 });
      }
      if (data.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: "Poza e prea mare." }, { status: 400 });
      }
      image = { mediaType, data };
    }
  }

  if (!text && !image) {
    return NextResponse.json(
      { error: "Lipsește textul sau poza comenzii." },
      { status: 400 }
    );
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `Textul e prea lung (max ${MAX_INPUT_LENGTH} caractere).` },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({
    type: "text",
    text: text || "Extrage detaliile cursei din poza atașată.",
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system:
          `Ești un asistent care ajută un dispecer de transport rutier din România să introducă o cursă nouă în sistem. ` +
          `Data de azi este ${today}. Primești fie un text (comandă copiată din email sau WhatsApp), fie o poză (comandă pe hârtie, document, CMR, captură de ecran), fie ambele — posibil în română, engleză sau amestecate. ` +
          `Dacă primești o poză, citește cu atenție tot ce e relevant din ea: locul de încărcare, locul de descărcare, data și ora încărcării/descărcării, tariful, distanța (km/mile), referința comenzii. ` +
          `Pentru locul de încărcare/descărcare: dacă înaintea orașului apare un cod scurt de depozit/terminal (ex. dintr-un load board: "SCN2 KAISERSLAUTERN, Rhineland-Palatinate" sau "DNW3 DÜSSELDORF, North Rhine-Westphalia"), pune DOAR codul (SCN2, respectiv DNW3) în loadPlace/unloadPlace, nu orașul întreg. ` +
          `Extrage câmpurile cerute apelând tool-ul extract_job_details. Nu inventa informații care nu apar în text sau în poză.`,
        messages: [{ role: "user", content }],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "tool", name: "extract_job_details" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API a răspuns cu eroare:", res.status, errText);
      return NextResponse.json(
        { error: "Serviciul AI a răspuns cu o eroare. Încearcă din nou." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      content?: { type: string; input?: Record<string, string> }[];
    };
    const toolUse = data.content?.find((c) => c.type === "tool_use");
    const extracted = toolUse?.input;
    if (!extracted) {
      return NextResponse.json(
        { error: "Nu am putut extrage datele din text." },
        { status: 502 }
      );
    }

    let clientId = "";
    const clientName = (extracted.clientName ?? "").trim().toLowerCase();
    if (clientName) {
      const match =
        customers.find((c) => c.name.trim().toLowerCase() === clientName) ??
        customers.find(
          (c) =>
            c.name.trim().toLowerCase().includes(clientName) ||
            clientName.includes(c.name.trim().toLowerCase())
        );
      if (match) clientId = match.id;
    }

    return NextResponse.json({
      clientId,
      clientName: extracted.clientName ?? "",
      ref: extracted.ref ?? "",
      loadPlace: extracted.loadPlace ?? "",
      unloadPlace: extracted.unloadPlace ?? "",
      startAt: extracted.startAt ?? "",
      endAt: extracted.endAt ?? "",
      miles: extracted.miles ?? "",
      currency: extracted.currency ?? "",
      rate: extracted.rate ?? "",
      extra: extracted.extra ?? "",
      notes: extracted.notes ?? "",
    });
  } catch (err) {
    console.error("Extragere AI eșuată:", err);
    return NextResponse.json(
      { error: "Extragerea AI a eșuat neașteptat." },
      { status: 500 }
    );
  }
}
