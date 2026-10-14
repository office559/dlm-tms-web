import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deleteCompany, updateCompany } from "@/lib/companies";

type Ctx = { params: Promise<{ id: string }> };

async function hasSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  try {
    const updated = await updateCompany(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "Firma nu există" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Există deja o firmă cu acest nume" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteCompany(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Firma are vehicule asociate. Mută-le la altă firmă înainte să o ștergi." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
