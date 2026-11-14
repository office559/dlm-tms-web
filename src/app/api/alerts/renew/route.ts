import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";

/** Coloana de expirare pentru fiecare document (listă fixă, nu vine niciodată din cerere). */
const COLUMNS: Record<string, Record<string, string>> = {
  vehicul: {
    ITP: "itp_exp",
    RCA: "rca_exp",
    CASCO: "casco_exp",
    Asigurare: "insurance_exp",
    Tahograf: "tacho_exp",
  },
  "remorcă": {
    ITP: "itp_exp",
    RCA: "rca_exp",
    CASCO: "casco_exp",
  },
};

const TABLES: Record<string, string> = { vehicul: "vehicles", "remorcă": "trailers" };

/**
 * „Actualizează” un document din pagina Alerte: schimbă doar data de
 * expirare a documentului ales (ex. RCA-ul remorcii), după reînnoire.
 * Corpul cererii: { kind, id, doc, expDate: "AAAA-LL-ZZ" }.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  const doc = String(body.doc ?? "");
  const id = String(body.id ?? "");
  const expDate = String(body.expDate ?? "");

  const table = TABLES[kind];
  const column = COLUMNS[kind]?.[doc];
  if (!table || !column || !id) {
    return NextResponse.json({ error: "Document necunoscut" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expDate) || Number.isNaN(Date.parse(expDate))) {
    return NextResponse.json({ error: "Data de expirare nu este validă" }, { status: 400 });
  }

  // numele tabelului și al coloanei vin din listele de mai sus, nu din cerere
  const { rowCount } = await pool.query(
    `update ${table} set ${column} = $1 where id = $2 and organization_id = $3`,
    [expDate, id, await orgId()]
  );
  if (!rowCount) {
    return NextResponse.json({ error: "Vehiculul / remorca nu a fost găsită" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, expDate });
}
