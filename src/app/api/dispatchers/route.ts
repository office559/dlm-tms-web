import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { addAbsence, deleteAbsence, deleteStint, saveStint } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function allowed() {
  // doar proprietarul platformei (contul de administrator)
  const ctx = await getOrgContext();
  return !!ctx?.isPlatformAdmin;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

// POST /api/dispatch
//   { kind: "absence", vehicleId, start, end, reason, note? }   — adaugă o absență
//   { kind: "stint", vehicleId, start, end, replaceStart?, replaceEnd? } — corectează / adaugă o perioadă la muncă
export async function POST(req: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });

  const res =
    body.kind === "absence"
      ? await addAbsence({
          vehicleId: str(body.vehicleId),
          start: str(body.start),
          end: str(body.end),
          reason: str(body.reason),
          note: str(body.note),
        })
      : body.kind === "stint"
        ? await saveStint({
            vehicleId: str(body.vehicleId),
            start: str(body.start),
            end: str(body.end),
            replaceStart: str(body.replaceStart) || null,
            replaceEnd: str(body.replaceEnd) || null,
          })
        : null;
  if (!res) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/dispatch?kind=absence|stint&id=...
export async function DELETE(req: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  const res = kind === "absence" ? await deleteAbsence(id) : kind === "stint" ? await deleteStint(id) : null;
  if (!res) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
