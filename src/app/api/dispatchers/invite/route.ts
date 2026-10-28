import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDispatcherInvite } from "@/lib/db";
import { getOrgContext } from "@/lib/org";
import { sendDispatcherInviteEmail } from "@/lib/email";

// POST /api/dispatchers/invite   { name, email }
// Doar un administrator autentificat (al firmei sau al platformei) poate trimite invitații
// de dispecer, iar invitația aparține organizației lui.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const ctx = session ? await getOrgContext() : null;
  if (!session || !ctx?.isOrgAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Nume și email valide sunt obligatorii" }, { status: 400 });
  }

  const invite = await createDispatcherInvite({
    name,
    email,
    organizationId: ctx.organizationId,
    orgRole: "dispatcher",
  });
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${invite.token}`;

  await sendDispatcherInviteEmail({ to: email, name, inviteUrl });

  return NextResponse.json({ ok: true });
}
