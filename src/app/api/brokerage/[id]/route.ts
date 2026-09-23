
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateBrokerage, deleteBrokerage } from "@/lib/brokerage";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  if (!body.client || String(body.client).trim() === "") {
    return NextResponse.json({ error: "Clientul este obligatoriu" }, { status: 400 });
  }

  const brokerage = await updateBrokerage(id, body);
  if (!brokerage) {
    return NextResponse.json({ error: "Înregistrarea nu a fost găsită" }, { status: 404 });
  }
  return NextResponse.json(brokerage);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  await deleteBrokerage(id);
  return NextResponse.json({ ok: true });
}
