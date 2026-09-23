import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createDriver, type DriverInput } from "@/lib/drivers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as DriverInput | null;
  if (!body?.name) {
    return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
  }

  const driver = await createDriver(body);
  return NextResponse.json({ driver });
}
