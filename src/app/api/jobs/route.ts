import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await req.json();
  const job = await createJob(body);
  return NextResponse.json(job, { status: 201 });
}
