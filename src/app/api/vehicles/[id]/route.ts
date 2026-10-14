import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deleteVehicle, getVehicle, updateVehicle } from "@/lib/vehicles";
import type { VehicleInput } from "@/lib/vehicles";

type Ctx = { params: Promise<{ id: string }> };

async function hasSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

function read(body: Record<string, unknown>, camel: string, snake: string) {
  if (camel in body) return { has: true, value: body[camel] };
  if (snake in body) return { has: true, value: body[snake] };
  return { has: false, value: undefined as unknown };
}

function textOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Un vehicul (pentru formularul de editare). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehiculul nu există" }, { status: 404 });
  }
  return NextResponse.json(vehicle);
}

/**
 * Salvarea formularului complet de vehicul (număr, tip, preț, expirări,
 * șofer, remorcă, locație, activ). Câmpurile care nu vin în cerere rămân
 * neschimbate. Tabelul de Planificare folosește altă rută: /quick.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getVehicle(id);
  if (!existing) {
    return NextResponse.json({ error: "Vehiculul nu există" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  const pickText = (camel: string, snake: string, current: string | null) => {
    const r = read(body, camel, snake);
    return r.has ? textOrNull(r.value) : current;
  };

  const type = read(body, "type", "type");
  const price = read(body, "price", "price");
  const active = read(body, "active", "active");

  const plate =
    typeof body.plate === "string" && body.plate.trim() ? body.plate.trim() : existing.plate;

  const input: VehicleInput = {
    plate,
    type: type.has ? textOrNull(type.value) : existing.type,
    price: price.has ? numOrNull(price.value) : existing.price,
    itpExp: pickText("itpExp", "itp_exp", existing.itp_exp),
    rcaExp: pickText("rcaExp", "rca_exp", existing.rca_exp),
    cascoExp: pickText("cascoExp", "casco_exp", existing.casco_exp),
    insuranceExp: pickText("insuranceExp", "insurance_exp", existing.insurance_exp),
    tachoExp: pickText("tachoExp", "tacho_exp", existing.tacho_exp),
    driverId: pickText("driverId", "driver_id", existing.driver_id),
    trailerId: pickText("trailerId", "trailer_id", existing.trailer_id),
    location: pickText("location", "location", existing.location),
    active: active.has ? Boolean(active.value) : existing.active,
  };

  const updated = await updateVehicle(id, input);
  if (!updated) {
    return NextResponse.json({ error: "Vehiculul nu există" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** Ștergerea unui vehicul (butonul „Șterge" din lista Vehicule). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { id } = await params;
  await deleteVehicle(id);
  return NextResponse.json({ ok: true });
}
