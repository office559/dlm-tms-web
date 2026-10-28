import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { createOrganization } from "@/lib/platform";
import { sendOrgAdminInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/platform/organizations   { name, adminName, adminEmail }
// Doar proprietarul platformei: creează firma și trimite invitația administratorului ei.
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const adminName = typeof body?.adminName === "string" ? body.adminName : "";
  const adminEmail = typeof body?.adminEmail === "string" ? body.adminEmail : "";

  const res = await createOrganization({ name, adminName, adminEmail });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${res.invite.token}`;
  let emailSent = true;
  try {
    await sendOrgAdminInviteEmail({
      to: res.invite.email,
      name: res.invite.name,
      organizationName: res.organizationName,
      inviteUrl,
    });
  } catch (err) {
    console.error("Emailul de invitație nu s-a trimis:", err);
    emailSent = false;
  }

  return NextResponse.json({ ok: true, organizationId: res.organizationId, inviteUrl, emailSent }, { status: 201 });
}
