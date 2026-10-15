export async function patchJobStatus(jobId: string, status: string, cancelFee?: number | null) {
  await fetch(`/api/jobs/${jobId}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, cancelFee: cancelFee ?? null }),
  });
}

/** Schimbă statusul cursei cu kilometraj; întoarce un mesaj de eroare sau null dacă a mers. */
export async function patchJobWithKm(
  jobId: string,
  status: string,
  km: { start?: number | null; end?: number | null }
): Promise<string | null> {
  try {
    const res = await fetch(`/api/jobs/${jobId}/quick`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, kmStart: km.start ?? null, kmEnd: km.end ?? null }),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error || "Nu s-a putut salva.";
  } catch {
    return "Nu s-a putut salva.";
  }
}

export type JobKmInfo = {
  kmStart: number | null;
  kmEnd: number | null;
  price: number | null;
  currency: string | null;
};

export async function fetchJobKmInfo(jobId: string): Promise<JobKmInfo | null> {
  try {
    const res = await fetch(`/api/jobs/${jobId}/quick`);
    if (!res.ok) return null;
    return (await res.json()) as JobKmInfo;
  } catch {
    return null;
  }
}

/** Număr dintr-un câmp text; null dacă e gol sau invalid. */
export function parseKm(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Km parcurși și preț pe km, din km start / final și prețul total al cursei. */
export function calcKm(startStr: string, endStr: string, price: number | null) {
  const s = parseKm(startStr);
  const e = parseKm(endStr);
  const driven = s !== null && e !== null && e >= s ? e - s : null;
  const perKm = driven !== null && driven > 0 && price !== null ? price / driven : null;
  return { s, e, driven, perKm };
}

export type KmCalc = ReturnType<typeof calcKm>;

export const CANCEL_FEE_PRESETS = [220, 320];
