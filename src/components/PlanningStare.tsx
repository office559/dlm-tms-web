"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_LABELS } from "@/lib/fleet-labels";
import { useTimezone } from "@/components/TimezoneProvider";
import { endPauseBody, patchVehicle, startPauseBody } from "@/lib/planning-helpers";

async function patchJobStatus(jobId: string, status: string, cancelFee?: number | null) {
  await fetch(`/api/jobs/${jobId}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, cancelFee: cancelFee ?? null }),
  });
}

/** Schimbă statusul cursei cu kilometraj; întoarce un mesaj de eroare sau null dacă a mers. */
async function patchJobWithKm(
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

type JobKmInfo = {
  kmStart: number | null;
  kmEnd: number | null;
  price: number | null;
  currency: string | null;
};

async function fetchJobKmInfo(jobId: string): Promise<JobKmInfo | null> {
  try {
    const res = await fetch(`/api/jobs/${jobId}/quick`);
    if (!res.ok) return null;
    return (await res.json()) as JobKmInfo;
  } catch {
    return null;
  }
}

/** Număr dintr-un câmp text; null dacă e gol sau invalid. */
function parseKm(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Km parcurși și preț pe km, din km start / final și prețul total al cursei. */
function calcKm(startStr: string, endStr: string, price: number | null) {
  const s = parseKm(startStr);
  const e = parseKm(endStr);
  const driven = s !== null && e !== null && e >= s ? e - s : null;
  const perKm = driven !== null && driven > 0 && price !== null ? price / driven : null;
  return { s, e, driven, perKm };
}

const CANCEL_FEE_PRESETS = [220, 320];

type StareOption = {
  label: string;
  style: string;
  run: () => Promise<void>;
};

type StareStep = "status" | "cancelFee" | "kmStart" | "kmEnd" | "done";

/** Culorile badge-ului de Stare din tabel: text închis, fundal mai intens, ca să se vadă bine. */
const STARE_BADGE_STYLES: Record<FleetState, string> = {
  disponibil: "text-green-800 bg-green-200",
  indisponibil: "text-red-800 bg-red-200",
  pauza: "text-sky-800 bg-sky-200",
  alocat: "text-amber-800 bg-amber-200",
  tranzit: "text-orange-800 bg-orange-200",
  stationare: "text-red-800 bg-red-200",
  pending: "text-violet-800 bg-violet-200",
};

/**
 * Control unic pentru Stare: apasă pe badge-ul curent și se deschide un
 * popup „Schimbă status" cu stările posibile următoare.
 *
 * La trecerea în Tranzit se cere kilometrajul de start de pe bord, iar la
 * finalizarea cursei kilometrajul final; aplicația calculează km parcurși
 * și prețul pe km (tarif + extra, împărțit la km). Kilometrajul se poate
 * și omite. O
