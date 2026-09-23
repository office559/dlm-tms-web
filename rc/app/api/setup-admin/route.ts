import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

// POST /api/setup-admin   { secret, name, email, password }
// Creează O SINGURĂ DATĂ contul de admin (owner), direct din browser, fără
// terminal. Protejat cu BETTER_AUTH_SECRET (cheia deja generată în Vercel) —
// și refuză dacă există deja un cont de admin, ca să nu poată fi refolosit.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  const name = typeof body?.name === "string" ? body.name : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!process.env.BETTER_AUTH_SECRET || secret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "Cheie incorectă" }, { status: 401 });
  }
  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Completează numele, emailul și o parolă de minim 8 caractere" },
      { status: 400 }
    );
  }

  const existing = await pool.query<{ count: string }>(
    `select count(*)::text as count from "user" where role = 'admin'`
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Există deja un cont de admin — această pagină nu mai poate fi folosită." },
      { status: 409 }
    );
  }

  const created = await auth.api.createUser({
    body: { name, email, password, role: "admin" },
  });

  return NextResponse.json({ ok: true, email: created.user.email });
}
