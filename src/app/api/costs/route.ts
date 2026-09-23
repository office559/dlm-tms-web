import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createCost } from "@/lib/costs";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.date || !body.category || body.amount === undefined || body.amount === null) {
    return NextResponse.json({ error: "Data, categoria și suma sunt obligatorii" }, { status: 400 });
  }

  const cost = await createCost(body);
  return NextResponse.json(cost, { status: 201 });
}
