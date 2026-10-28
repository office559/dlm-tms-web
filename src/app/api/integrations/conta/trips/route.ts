import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Endpoint pentru aplicația Conta: întoarce cursele (joburile) cu data de
 * încărcare între „from" și „to" (ambele incluse), din toate firmele,
 * inclusiv cele finalizate și cele anulate.
 *
 * Fără sesiune / login: se autentifică doar cu `Authorization: Bearer <token>`,
 * unde tokenul e variabila de mediu CONTA_API_TOKEN (aceeași ca la vrid-lookup).
 * Fără token configurat, fără header sau cu token greșit → 401.
 *
 * Body: {"from": "2026-10-01", "to": "2026-10-07"}
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plasă de siguranță; în practică Conta cere sub ~2000 de curse. */
const MAX_TRIPS = 5000;

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

/** „YYYY-MM-DD" și o dată reală din calendar (nu 2026-02-31). */
function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Moneda din aplicație („€", „£", „RON"…) → cod: EUR / GBP / RON (/ USD). */
function currencyCode(raw: string | null): string {
  const c = (raw ?? "").trim().toUpperCase();
  if (!c || c === "€" || c === "EUR" || c === "EURO") return "EUR";
  if (c === "£" || c === "GBP") return "GBP";
  if (c === "RON" || c === "LEI" || c === "LEU") return "RON";
  if (c === "$" || c === "USD") return "USD";
  return /^[A-Z]{3}$/.test(c) ? c : "EUR";
}

type Row = {
  id: string;
  vrid: string;
  client_name: string | null;
  plate: string | null;
  driver_name: string | null;
  load_place: string | null;
  unload_place: string | null;
  loading_date: string;
  unloading_date: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  paid: boolean;
};

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

  const { from, to } = (body ?? {}) as { from?: unknown; to?: unknown };
  if (!validDate(from) || !validDate(to)) {
    return json({ error: 'Se așteaptă {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}' }, 400);
  }
  if (from > to) {
    return json({ error: '"from" nu poate fi după "to"' }, 400);
  }

  // Data de încărcare = data din câmpul „start_at" al cursei (ca în Planificare/Rapoarte).
  // Cursele fără VRID se omit. Valoarea: tariful + extra; la cursele anulate, doar taxa de anulare.
  const { rows } = await pool.query<Row>(
    `select j.id::text                                   as id,
            btrim(j.ref)                                 as vrid,
            c.name                                       as client_name,
            v.plate                                      as plate,
            d.name                                       as driver_name,
            j.load_place                                 as load_place,
            j.unload_place                               as unload_place,
            to_char(j.start_at::date, 'YYYY-MM-DD')      as loading_date,
            to_char(j.end_at::date, 'YYYY-MM-DD')        as unloading_date,
            (case when j.status = 'anulat'
                  then coalesce(j.cancel_fee, 0)
                  else coalesce(j.rate, 0) + coalesce(j.extra, 0) end)::float8 as amount,
            j.currency                                   as currency,
            j.status                                     as status,
            (j.invoice = 'plătită' or j.paid_at is not null) as paid
       from jobs j
       left join vehicles v  on v.id = j.vehicle_id
       left join companies c on c.id = v.company_id
       left join drivers d   on d.id = coalesce(j.driver_id, v.driver_id)
      where j.start_at is not null
        and j.start_at::date between $1::date and $2::date
        and btrim(coalesce(j.ref, '')) <> ''
      order by j.start_at, j.id
      limit ${MAX_TRIPS}`,
    [from, to]
  );

  const trips = rows.map((r) => {
    const driver = (r.driver_name ?? "").trim();
    return {
      vrid: r.vrid,
      id: r.id,
      client_name: r.client_name,
      tractor: { plate_number: r.plate },
      drivers: driver ? [{ name: driver }] : [],
      loading_location: { address: r.load_place ?? "" },
      unloading_location: { address: r.unload_place ?? "" },
      loading_date: r.loading_date,
      unloading_date: r.unloading_date,
      trip_value: Math.round((Number(r.amount) || 0) * 100) / 100,
      currency: currencyCode(r.currency),
      status: r.status,
      payment_status: r.paid ? "paid" : "unpaid",
    };
  });

  return json({ trips });
}
