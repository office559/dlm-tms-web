import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { addPeriod, deletePeriod, updatePeriod } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function allowed() {
  // doar proprietarul platformei (contul de administrator)
  const ctx = await getOrgContext();
  return !!ctx?.isPlatformAdmin;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Eroare de server: o logăm și o arătăm (rubrica e doar pentru administratorul platformei). */
function serverError(e: unknown) {
  console.error("[api/dispatch]", e);
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: `Eroare de server: ${msg}` }, { status: 500 });
}

// POST   /api/dispatch   { vehicleId, start, end? }   — adaugă o perioadă (end gol = în curs)
// PATCH  /api/dispatch   { id, start, end? }          — modifică o perioadă
// DELETE /api/dispatch?id=...                          — șterge o perioadă
export async function POST(req: NextRequest) {
  try {
    if (!(await allowed())) return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
    const res = await addPeriod({ vehicleId: str(body.vehicleId), start: str(body.start), end: str(body.end) || null });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await allowed())) return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
    const body = await req.json().catch(() => null);
    const id = str(body?.id);
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
    const res = await updatePeriod({ id, start: str(body?.start), end: str(body?.end) || null });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await allowed())) return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
    const res = await deletePeriod(id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
