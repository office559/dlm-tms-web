import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteDispatcherAccount, getDispatcherById } from "@/lib/db";
import { getOrgContext } from "@/lib/org";

// DELETE /api/dispatchers/:id
// Doar un administrator (al firmei sau al platformei) poate șterge un dispecer din organizația
// lui. Se șterge contul asociat (iar sesiunile, contul de autentificare și rândul din tabelul
// "dispatchers" dispar prin ON DELETE CASCADE, vezi migrations/001_dispatchers.sql), împreună cu
// apartenența lui la organizație. După ștergere, dispecerul nu se mai poate loga.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const ctx = session ? await getOrgContext() : null;
  if (!session || !ctx?.isOrgAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const dispatcher = await getDispatcherById(id, ctx.organizationId);
  if (!dispatcher) {
    return NextResponse.json({ error: "Dispecer inexistent" }, { status: 404 });
  }

  if (dispatcher.user_id === session.user.id) {
    return NextResponse.json(
      { error: "Nu îți poți șterge propriul cont din această listă." },
      { status: 400 }
    );
  }

  const result = await deleteDispatcherAccount(id, ctx.organizationId);
  if (result === "protected") {
    return NextResponse.json(
      { error: "Acest cont nu poate fi șters de aici." },
      { status: 403 }
    );
  }
  if (result === "not_found") {
    return NextResponse.json({ error: "Dispecer inexistent" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
