import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getJob, patchJobStatus } from "@/lib/jobs";
import { notifyJobChanges } from "@/lib/job-notifications";

const VALID_STATUSES = ["planificare", "activ", "finalizat", "anulat"];

/**
 * Schimbare rapidă a stării unei curse din tabelul de Planificare (Alocat →
 * Tranzit / Anulare, apoi Tranzit → Finalizare) — separat de PATCH
 * /api/jobs/[id], care cere tot formularul complet al cursei.
 */
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
  const status = typeof body.status === "string" ? body.status : "";
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status invalid" }, { status: 400 });
  }

  const before = await getJob(id);
  const job = await patchJobStatus(id, status);
  if (!job) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  notifyJobChanges(before, job).catch((err) =>
    console.error("WhatsApp notify (quick status) failed:", err)
  );

  return NextResponse.json(job);
}
