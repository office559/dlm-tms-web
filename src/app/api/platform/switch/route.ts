import { NextRequest, NextResponse } from "next/server";
import { getOrgContext, ORG_COOKIE } from "@/lib/org";
import { organizationExists } from "@/lib/platform";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/platform/switch   { organizationId }
// Doar proprietarul platformei: alege firma în care lucrează (cookie), apoi toată aplicația
// arată datele acelei firme.
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  if (!UUID_RE.test(organizationId) || !(await organizationExists(organizationId))) {
    return NextResponse.json({ error: "Firma nu există." }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
