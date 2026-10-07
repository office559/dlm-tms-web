import { NextRequest, NextResponse, after } from "next/server";
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

  let cancelFee: number | null = null;
  if (status === "anulat" && body.cancelFee !== undefined && body.cancelFee !== null && body.cancelFee !== "") {
    const n = Number(body.cancelFee);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Sumă taxă de anulare invalidă" }, { status: 400 });
    }
    cancelFee = n;
  }

  const before = await getJob(id);
  const job = await patchJobStatus(id, status, cancelFee);
  if (!job) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  after(() => notifyJobChanges(before, job)); // rulează după răspuns, dar Vercel așteaptă să se termine

  return NextResponse.json(job);
}
