import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isValidTimezone } from "@/lib/tz";
import { setUserTimezone } from "@/lib/user-prefs";

/** Salvează fusul orar ales de utilizatorul conectat. */
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const timezone = body?.timezone;
  if (!isValidTimezone(timezone)) {
    return NextResponse.json({ error: "Fus orar invalid" }, { status: 400 });
  }

  await setUserTimezone(session.user.id, timezone);
  return NextResponse.json({ ok: true, timezone });
}
