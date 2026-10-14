import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createCompany, listCompaniesWithCounts } from "@/lib/companies";

async function hasSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

export async function GET() {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  return NextResponse.json(await listCompaniesWithCounts());
}

export async function POST(req: NextRequest) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Numele firmei este obligatoriu" }, { status: 400 });
  }
  try {
    const company = await createCompany(name);
    return NextResponse.json(company, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Există deja o firmă cu acest nume" }, { status: 409 });
    }
    throw e;
  }
}
