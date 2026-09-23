
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createBrokerage } from "@/lib/brokerage";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.client || String(body.client).trim() === "") {
    return NextResponse.json({ error: "Clientul este obligatoriu" }, { status: 400 });
  }

  const brokerage = await createBrokerage(body);
  return NextResponse.json(brokerage, { status: 201 });
}
