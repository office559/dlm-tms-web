import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getJob, updateJob, deleteJob } from "@/lib/jobs";
import { notifyJobChanges } from "@/lib/job-notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const before = await getJob(id);
  const body = await req.json();
  const job = await updateJob(id, body);
  if (!job) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  notifyJobChanges(before, job).catch((err) =>
    console.error("WhatsApp notify (update job) failed:", err)
  );

  return NextResponse.json(job);
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
  await deleteJob(id);
  return NextResponse.json({ ok: true });
}
