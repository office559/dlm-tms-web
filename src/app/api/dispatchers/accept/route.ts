import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDispatcherInviteByToken,
  markInviteUsed,
  createDispatcherRecord,
} from "@/lib/db";

// POST /api/dispatchers/accept   { token, password }
// Validează invitația, creează contul Better Auth (rol "dispatcher") și
// înregistrarea din tabelul "dispatchers", apoi marchează invitația folosită.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: "Token lipsă sau parolă prea scurtă (minim 8 caractere)" },
      { status: 400 }
    );
  }

  const invite = await getDispatcherInviteByToken(token);
  if (!invite) {
    return NextResponse.json({ error: "Invitație inexistentă" }, { status: 404 });
  }
  if (invite.used_at) {
    return NextResponse.json({ error: "Invitația a fost deja folosită" }, { status: 409 });
  }
  if (invite.expires_at.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invitația a expirat" }, { status: 410 });
  }

const created = await auth.api.createUser({
    body: {
      email: invite.email,
      password,
      name: invite.name,
    },
  }); 
  
  await createDispatcherRecord({
    userId: created.user.id,
    name: invite.name,
    email: invite.email,
  });
  await markInviteUsed(invite.id);

  return NextResponse.json({ ok: true });
}
