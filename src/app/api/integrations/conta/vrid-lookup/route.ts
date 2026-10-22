import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Endpoint pentru aplicația Conta: pentru o listă de VRID-uri (câmpul „ref"
 * al cursei, afișat în Planificare ca VRID) întoarce numărul de înmatriculare
 * al tractorului alocat cursei.
 *
 * Fără sesiune / login: se autentifică doar cu `Authorization: Bearer <token>`,
 * unde tokenul e variabila de mediu CONTA_API_TOKEN. Fără token configurat,
 * fără header sau cu token greșit → 401.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VRIDS = 1000;
const MAX_VRID_LENGTH = 100;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra },
  });
}

/** Compară tokenul primit cu cel din mediu, în timp constant. */
function tokenOk(authHeader: string | null): boolean {
  const expected = process.env.CONTA_API_TOKEN;
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  if (!m) return false;
  const a = createHash("sha256").update(m[1].trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Forma comparată: fără spații la capete, litere mari. */
function norm(s: string): string {
  return s.trim().toUpperCase();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get("authorization"))) {
    return json({ error: "Unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON invalid" }, 400);
  }

  const raw = (body as { vrids?: unknown } | null)?.vrids;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
    return json({ error: 'Se așteaptă {"vrids": ["...", "..."]}' }, 400);
  }
  if (raw.length > MAX_VRIDS) {
    return json({ error: `Maximum ${MAX_VRIDS} VRID-uri per cerere` }, 400);
  }

  // VRID-urile cerute (fără goale / prea lungi), păstrând forma trimisă de Conta.
  const asked = (raw as string[])
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= MAX_VRID_LENGTH);
  if (asked.length === 0) return json({ results: [] });

  const keys = [...new Set(asked.map(norm))];

  // Pentru fiecare VRID: cursa neanulată cea mai recentă care are tractor alocat.
  const { rows } = await pool.query<{ key: string; plate: string }>(
    `select distinct on (upper(btrim(j.ref)))
            upper(btrim(j.ref)) as key,
            v.plate as plate
       from jobs j
       join vehicles v on v.id = j.vehicle_id
      where upper(btrim(j.ref)) = any($1::text[])
        and j.status <> 'anulat'
        and v.plate is not null
      order by upper(btrim(j.ref)), coalesce(j.start_at, j.created_at) desc`,
    [keys]
  );
  const plateByKey = new Map(rows.map((r) => [r.key, r.plate]));

  // VRID-urile negăsite sau fără tractor alocat se omit din listă.
  const seen = new Set<string>();
  const results: { vrid: string; plate: string }[] = [];
  for (const vrid of asked) {
    const k = norm(vrid);
    const plate = plateByKey.get(k);
    if (!plate || seen.has(k)) continue;
    seen.add(k);
    results.push({ vrid, plate });
  }

  return json({ results });
}
