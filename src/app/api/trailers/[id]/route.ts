import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateTrailer, deleteTrailer } from "@/lib/trailers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  if (!body.plate || typeof body.plate !== "string" || !body.plate.trim()) {
    return NextResponse.json({ error: "Numărul de înmatriculare este obligatoriu" }, { status: 400 });
  }

  try {
    const trailer = await updateTrailer(id, body);
    if (!trailer) {
      return NextResponse.json({ error: "Remorca nu a fost găsită" }, { status: 404 });
    }
    return NextResponse.json(trailer);
  } catch (err) {
    const e = err as { message?: string; detail?: string; constraint?: string; code?: string } | null;
    const why =
      [e?.message, e?.detail, e?.constraint ? `(constrângere: ${e.constraint})` : "", e?.code ? `[cod ${e.code}]` : ""]
        .filter(Boolean)
        .join(" ") || "Eroare necunoscută";
    console.error("PATCH /api/trailers/[id] a eșuat:", err);
    return NextResponse.json({ error: `Nu s-a putut salva: ${why}` }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  await deleteTrailer(id);
  return NextResponse.json({ ok: true });
}
