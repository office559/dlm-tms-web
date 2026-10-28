import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { inviteOrganizationAdmin } from "@/lib/platform";
import { sendOrgAdminInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/platform/organizations/:id/invite   { name, email }
// Doar proprietarul platformei: trimite (sau retrimite) invitația unui administrator al firmei.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const email = typeof body?.email === "string" ? body.email : "";

  const res = await inviteOrganizationAdmin(id, name, email);
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

  return NextResponse.json({ ok: true, inviteUrl, emailSent });
}
