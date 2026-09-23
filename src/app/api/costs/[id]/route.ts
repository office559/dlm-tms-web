import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateCost, deleteCost } from "@/lib/costs";

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
  if (!body.date || !body.category || body.amount === undefined || body.amount === null) {
    return NextResponse.json({ error: "Data, categoria și suma sunt obligatorii" }, { status: 400 });
  }

  const cost = await updateCost(id, body);
  if (!cost) {
    return NextResponse.json({ error: "Cheltuiala nu a fost găsită" }, { status: 404 });
  }
  return NextResponse.json(cost);
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
  await deleteCost(id);
  return NextResponse.json({ ok: true });
}
