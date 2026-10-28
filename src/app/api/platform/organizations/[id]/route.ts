import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { deleteOrganization, setOrganizationActive } from "@/lib/platform";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/platform/organizations/:id   { active: boolean }
// Doar proprietarul platformei: dezactivează sau reactivează o firmă (datele rămân).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Firma nu există." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  }
  const res = await setOrganizationActive(id, body.active);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/platform/organizations/:id   { confirmName: string }
// Doar proprietarul platformei: șterge DEFINITIV firma și toate datele ei (necesită numele firmei).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Firma nu există." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const confirmName = typeof body?.confirmName === "string" ? body.confirmName : "";
  const res = await deleteOrganization(id, confirmName);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  // dacă tocmai lucrai în firma ștearsă, cookie-ul de firmă nu mai are sens
  const out = NextResponse.json({ ok: true });
  if (ctx.organizationId === id) out.cookies.delete("dlm-org");
  return out;
}
