import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateVehicle, deleteVehicle } from "@/lib/vehicles";

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
  if (!body.plate || typeof body.plate !== "string" || !body.plate.trim()) {
    return NextResponse.json({ error: "Numărul de înmatriculare este obligatoriu" }, { status: 400 });
  }

  const vehicle = await updateVehicle(id, body);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehiculul nu a fost găsit" }, { status: 404 });
  }
  return NextResponse.json(vehicle);
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
  await deleteVehicle(id);
  return NextResponse.json({ ok: true });
}
