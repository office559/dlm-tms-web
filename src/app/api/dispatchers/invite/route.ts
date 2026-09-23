import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDispatcherInvite } from "@/lib/db";
import { sendDispatcherInviteEmail } from "@/lib/email";

// POST /api/dispatchers/invite   { name, email }
// Doar un admin autentificat poate trimite invitații de dispecer.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Nume și email valide sunt obligatorii" }, { status: 400 });
  }

  const invite = await createDispatcherInvite({ name, email });
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${invite.token}`;

  await sendDispatcherInviteEmail({ to: email, name, inviteUrl });

  return NextResponse.json({ ok: true });
}
