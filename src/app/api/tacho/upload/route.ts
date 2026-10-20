import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { saveDddFile } from "@/lib/tacho/pontaj";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Primește UN fișier .DDD (corpul cererii = conținutul fișierului) și îl salvează.
 * Numele fișierului vine în antetul „x-file-name".
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const fileName = decodeURIComponent(req.headers.get("x-file-name") || "fisier.ddd");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 16) {
    return NextResponse.json({ error: "Fișierul este gol." }, { status: 400 });
  }
  if (buf.length > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Fișierul e prea mare (maxim 4 MB)." }, { status: 400 });
  }
  try {
    const result = await saveDddFile(buf, fileName, session.user.email);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Nu am putut citi fișierul: ${(e as Error).message}` },
      { status: 422 }
    );
  }
}
