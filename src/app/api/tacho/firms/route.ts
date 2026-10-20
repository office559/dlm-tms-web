import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listTachoCompanies, updateTachoCompany } from "@/lib/tacho/pontaj";

export const dynamic = "force-dynamic";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  return NextResponse.json(await listTachoCompanies());
}

/** Bifează firma pentru pontaj și setează diurna (doar admin). */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Doar administratorul poate schimba setările de pontaj." }, { status: 403 });
  }
  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Lipsește firma." }, { status: 400 });
  const num = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));
  const abroad = num(body.abroad);
  const ro = num(body.ro);
  if ((abroad !== undefined && (!isFinite(abroad) || abroad < 0)) || (ro !== undefined && (!isFinite(ro) || ro < 0))) {
    return NextResponse.json({ error: "Diurna trebuie să fie un număr pozitiv." }, { status: 400 });
  }
  const ok = await updateTachoCompany(id, {
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    abroad,
    ro,
    currency: typeof body.currency === "string" ? body.currency : undefined,
  });
  if (!ok) return NextResponse.json({ error: "Firma nu există." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
