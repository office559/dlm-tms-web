import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDispatcherById } from "@/lib/db";

// DELETE /api/dispatchers/:id
// Doar un admin poate șterge un dispecer. Se șterge contul Better Auth
// asociat (auth.api.removeUser) — asta șterge automat și sesiunile/contul
// lui de autentificare, iar rândul din tabelul "dispatchers" dispare
// automat după el (foreign key ON DELETE CASCADE către "user", vezi
// migrations/001_dispatchers.sql). După ștergere, dispecerul nu se mai
// poate loga.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const dispatcher = await getDispatcherById(id);
  if (!dispatcher) {
    return NextResponse.json({ error: "Dispecer inexistent" }, { status: 404 });
  }

  if (dispatcher.user_id === session.user.id) {
    return NextResponse.json(
      { error: "Nu îți poți șterge propriul cont din această listă." },
      { status: 400 }
    );
  }

  await auth.api.removeUser({
    body: { userId: dispatcher.user_id },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true });
}
