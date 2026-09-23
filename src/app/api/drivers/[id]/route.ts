import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateDriver, deleteDriver, type DriverInput } from "@/lib/drivers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as DriverInput | null;
  if (!body?.name) {
    return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
  }

  const driver = await updateDriver(id, body);
  if (!driver) return NextResponse.json({ error: "Șofer inexistent" }, { status: 404 });
  return NextResponse.json({ driver });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await params;
  await deleteDriver(id);
  return NextResponse.json({ ok: true });
}
