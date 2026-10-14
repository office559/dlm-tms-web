import { NextRequest, NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getJob, patchJobStatus } from "@/lib/jobs";
import { notifyJobChanges } from "@/lib/job-notifications";

const VALID_STATUSES = ["planificare", "activ", "finalizat", "anulat"];

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Kilometraj din cerere: null = lipsă, undefined = valoare invalidă. */
function readKm(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Date pentru fereastra de kilometraj din Planificare: km de start deja
 * salvat, prețul total al cursei (tarif + extra) și moneda.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  const rate = toNum(job.rate);
  const extra = toNum(job.extra) ?? 0;
  return NextResponse.json({
    kmStart: toNum(job.km_start),
    kmEnd: toNum(job.km_end),
    price: rate === null ? null : rate + extra,
    currency: job.currency,
  });
}

/**
 * Schimbare rapidă a stării unei curse din tabelul de Planificare (Alocat →
 * Tranzit / Anulare, apoi Tranzit → Finalizare), cu kilometraj opțional —
 * separat de PATCH /api/jobs/[id], care cere tot formularul complet al cursei.
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

  const kmStart = readKm(body.kmStart);
  const kmEnd = readKm(body.kmEnd);
  if (kmStart === undefined || kmEnd === undefined) {
    return NextResponse.json({ error: "Kilometraj invalid" }, { status: 400 });
  }

  const before = await getJob(id);
  if (!before) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  const startEffective = kmStart ?? toNum(before.km_start);
  if (kmEnd !== null && startEffective !== null && kmEnd < startEffective) {
    return NextResponse.json(
      { error: "Kilometrajul final nu poate fi mai mic decât cel de start" },
      { status: 400 }
    );
  }

  const job = await patchJobStatus(id, status, cancelFee, { start: kmStart, end: kmEnd });
  if (!job) {
    return NextResponse.json({ error: "Cursa nu a fost găsită" }, { status: 404 });
  }

  after(() => notifyJobChanges(before, job)); // rulează după răspuns, dar Vercel așteaptă să se termine

  return NextResponse.json(job);
}
