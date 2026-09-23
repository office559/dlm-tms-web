import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createVehicle } from "@/lib/vehicles";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.plate || typeof body.plate !== "string" || !body.plate.trim()) {
    return NextResponse.json({ error: "Numărul de înmatriculare este obligatoriu" }, { status: 400 });
  }

  const vehicle = await createVehicle(body);
  return NextResponse.json(vehicle, { status: 201 });
}
