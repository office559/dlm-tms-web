import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Doar administratorii pot modifica setările" }, { status: 403 });
  }

  const body = await req.json();
  const settings = await updateSettings(body);
  return NextResponse.json(settings);
}
