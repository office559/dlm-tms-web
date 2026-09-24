import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { patchVehicleQuick } from "@/lib/fleet";

/**
 * Actualizare rapidă a unui vehicul din tabelul de Planificare (șofer,
 * locație, pauză) — separat de PATCH /api/vehicles/[id], care cere tot
 * formularul complet al vehiculului.
 */
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

  await patchVehicleQuick(id, {
    driverId: "driverId" in body ? body.driverId : undefined,
    location: "location" in body ? body.location : undefined,
    pause: "pause" in body ? Boolean(body.pause) : undefined,
    programStart: "programStart" in body ? body.programStart : undefined,
    programEnd: "programEnd" in body ? body.programEnd : undefined,
    restDurH: "restDurH" in body ? body.restDurH : undefined,
    restStart: "restStart" in body ? body.restStart : undefined,
    restEnd: "restEnd" in body ? body.restEnd : undefined,
    restStartAt: "restStartAt" in body ? body.restStartAt : undefined,
    restEndAt: "restEndAt" in body ? body.restEndAt : undefined,
  });

  return NextResponse.json({ ok: true });
}
