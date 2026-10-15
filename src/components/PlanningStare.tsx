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
 * și omite. O cursă se poate anula atât din Viitor, cât și din Tranzit.
 */
export function StareControl({
  vehicleId,
  jobId,
  state,
}: {
  vehicleId: string;
  jobId: string | null;
  state: FleetState;
}) {
  const router = useRouter();
  const tz = useTimezone();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StareStep>("status");
  const [customFee, setCustomFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [kmStartInput, setKmStartInput] = useState("");
  const [kmEndInput, setKmEndInput] = useState("");
  const [jobInfo, setJobInfo] = useState<JobKmInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ driven: number; perKm: number | null; currency: string } | null>(null);

  const options: StareOption[] = [];
  const CANCEL_LABEL = "Anulează cursa";
  const TRANSIT_LABEL = "Tranzit";
  const FINISH_LABEL = "Finalizează cursa";

  if (state === "alocat" && jobId) {
    options.push({
      label: TRANSIT_LABEL,
      style: "text-orange-700 bg-orange-50 hover:bg-orange-100",
      run: async () => {},
    });
    options.push({
      label: CANCEL_LABEL,
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: async () => {},
    });
  } else if (state === "tranzit" && jobId) {
    options.push({
      label: FINISH_LABEL,
      style: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
      run: async () => {},
    });
    options.push({
      label: CANCEL_LABEL,
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: async () => {},
    });
  } else if (state === "pending") {
    options.push({
      label: "Disponibil",
      style: "text-green-700 bg-green-50 hover:bg-green-100",
      run: () => patchVehicle(vehicleId, { stateOverride: null }),
    });
    options.push({
      label: "Pauză",
      style: "text-sky-700 bg-sky-50 hover:bg-sky-100",
      run: () => patchVehicle(vehicleId, startPauseBody(9, tz)),
    });
    options.push({
      label: "Indisponibil",
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: () => patchVehicle(vehicleId, { stateOverride: "indisponibil" }),
    });
  } else if (state === "pauza") {
    options.push({
      label: "Disponibil",
      style: "text-green-700 bg-green-50 hover:bg-green-100",
      run: () => patchVehicle(vehicleId, { ...endPauseBody(), stateOverride: null }),
    });
    options.push({
      label: "Indisponibil",
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: () => patchVehicle(vehicleId, { ...endPauseBody(), stateOverride: "indisponibil" }),
    });
  } else if (state === "disponibil") {
    options.push({
      label: "Indisponibil",
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: () => patchVehicle(vehicleId, { stateOverride: "indisponibil" }),
    });
    options.push({
      label: "Pauză",
      style: "text-sky-700 bg-sky-50 hover:bg-sky-100",
      run: () => patchVehicle(vehicleId, startPauseBody(9, tz)),
    });
  } else if (state === "indisponibil") {
    options.push({
      label: "Disponibil",
      style: "text-green-700 bg-green-50 hover:bg-green-100",
      run: () => patchVehicle(vehicleId, { stateOverride: null }),
    });
    options.push({
      label: "Pauză",
      style: "text-sky-700 bg-sky-50 hover:bg-sky-100",
      run: () => patchVehicle(vehicleId, startPauseBody(9, tz)),
    });
  }

  const clickable = options.length > 0;

  function closeAll() {
    const wasDone = step === "done";
    setOpen(false);
    setStep("status");
    setCustomFee("");
    setKmStartInput("");
    setKmEndInput("");
    setJobInfo(null);
    setError(null);
    setResult(null);
    if (wasDone) router.refresh();
  }

  async function openKmStep(next: "kmStart" | "kmEnd") {
    if (!jobId) return;
    setError(null);
    setStep(next);
    const info = await fetchJobKmInfo(jobId);
    setJobInfo(info);
    if (info?.kmStart != null) setKmStartInput(String(info.kmStart));
  }

  async function choose(opt: StareOption) {
    if (opt.label === CANCEL_LABEL) {
      setStep("cancelFee");
      return;
    }
    if (opt.label === TRANSIT_LABEL) {
      await openKmStep("kmStart");
      return;
    }
    if (opt.label === FINISH_LABEL) {
      await openKmStep("kmEnd");
      return;
    }
    setSaving(true);
    setOpen(false);
    await opt.run();
    setSaving(false);
    router.refresh();
  }

  async function confirmCancel(fee: number | null) {
    if (!jobId) return;
    setSaving(true);
    setOpen(false);
    await patchJobStatus(jobId, "anulat", fee);
    setSaving(false);
    setStep("status");
    setCustomFee("");
    router.refresh();
  }

  async function confirmTransit(withKm: boolean) {
    if (!jobId) return;
    const start = parseKm(kmStartInput);
    if (withKm && start === null) {
      setError("Introdu kilometrajul de pe bord.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await patchJobWithKm(jobId, "activ", { start: withKm ? start : null });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    closeAllAfterSave();
  }

  async function confirmFinish(withKm: boolean) {
    if (!jobId) return;
    const calc = calcKm(kmStartInput, kmEndInput, jobInfo?.price ?? null);
    if (withKm) {
      if (calc.e === null) {
        setError("Introdu kilometrajul final de pe bord.");
        return;
      }
      if (calc.s !== null && calc.e < calc.s) {
        setError("Kilometrajul final nu poate fi mai mic decât cel de start.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    const needStart = jobInfo?.kmStart == null;
    const err = await patchJobWithKm(jobId, "finalizat", {
      start: withKm && needStart ? calc.s : null,
      end: withKm ? calc.e : null,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (withKm && calc.driven !== null) {
      setResult({ driven: calc.driven, perKm: calc.perKm, currency: jobInfo?.currency || "€" });
      setStep("done");
      return;
    }
    closeAllAfterSave();
  }

  function closeAllAfterSave() {
    setOpen(false);
    setStep("status");
    setKmStartInput("");
    setKmEndInput("");
    setJobInfo(null);
    setError(null);
    router.refresh();
  }

  const finishCalc = calcKm(kmStartInput, kmEndInput, jobInfo?.price ?? null);
  const currencyLabel = jobInfo?.currency || "€";

  return (
    <>
      <button
        type="button"
        disabled={saving || !clickable}
        onClick={() => setOpen(true)}
        className={`whitespace-nowrap rounded-full px-3 py-1 text-[13.5px] font-extrabold transition ${STARE_BADGE_STYLES[state]} ${
          clickable ? "cursor-pointer hover:opacity-75" : "cursor-default"
        } disabled:opacity-50`}
      >
        {FLEET_STATE_LABELS[state]}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          onClick={closeAll}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "status" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Schimbă status</h3>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {options.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => choose(o)}
                      className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${o.style}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "cancelFee" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Taxă de anulare</h3>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Unele curse anulate se plătesc totuși. Alege o sumă sau anulează fără taxă.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {CANCEL_FEE_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={saving}
                        onClick={() => confirmCancel(amount)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                      >
                        {amount} €
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Sumă personalizată"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                      value={customFee}
                      disabled={saving}
                      onChange={(e) => setCustomFee(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customFee) confirmCancel(Number(customFee));
                      }}
                    />
                    <button
                      type="button"
                      disabled={saving || !customFee}
                      onClick={() => confirmCancel(Number(customFee))}
                      className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
                    >
                      OK
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => confirmCancel(null)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50 transition"
                  >
                    Anulează fără taxă
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setStep("status")}
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    ← Înapoi
                  </button>
                </div>
              </>
            )}

            {step === "kmStart" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Kilometraj start</h3>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Trece kilometrajul de pe bordul mașinii la plecare.
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    autoFocus
                    placeholder="Km bord (start)"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50"
                    value={kmStartInput}
                    disabled={saving}
                    onChange={(e) => setKmStartInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmTransit(true);
                    }}
                  />
                  {error && <div className="text-xs text-red-600">{error}</div>}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => confirmTransit(true)}
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
                  >
                    Pornește cursa
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => confirmTransit(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50 transition"
                  >
                    Pornește fără km
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setError(null);
                      setStep("status");
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    ← Înapoi
                  </button>
                </div>
              </>
            )}

            {step === "kmEnd" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Kilometraj final</h3>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Trece kilometrajul de pe bord la finalul cursei. Aplicația calculează km parcurși
                  și prețul pe km.
                </p>
                <div className="flex flex-col gap-2">
                  {jobInfo?.kmStart != null ? (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Km la start:{" "}
                      <span className="font-semibold">
                        {jobInfo.kmStart.toLocaleString("ro-RO")}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="Km bord (start)"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50"
                      value={kmStartInput}
                      disabled={saving}
                      onChange={(e) => setKmStartInput(e.target.value)}
                    />
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    autoFocus
                    placeholder="Km bord (final)"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50"
                    value={kmEndInput}
                    disabled={saving}
                    onChange={(e) => setKmEndInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmFinish(true);
                    }}
                  />
                  {finishCalc.driven !== null && (
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <div>
                        Km parcurși:{" "}
                        <span className="font-semibold">
                          {finishCalc.driven.toLocaleString("ro-RO")}
                        </span>
                      </div>
                      {finishCalc.perKm !== null && (
                        <div>
                          Preț pe km:{" "}
                          <span className="font-semibold">
                            {finishCalc.perKm.toFixed(2)} {currencyLabel}/km
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {finishCalc.s !== null && finishCalc.e !== null && finishCalc.e < finishCalc.s && (
                    <div className="text-xs text-red-600">
                      Kilometrajul final nu poate fi mai mic decât cel de start.
                    </div>
                  )}
                  {error && <div className="text-xs text-red-600">{error}</div>}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => confirmFinish(true)}
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
                  >
                    Finalizează cursa
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => confirmFinish(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50 transition"
                  >
                    Finalizează fără km
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setError(null);
                      setStep("status");
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    ← Înapoi
                  </button>
                </div>
              </>
            )}

            {step === "done" && result && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Cursă finalizată</h3>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
                <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  <div>
                    Km parcurși:{" "}
                    <span className="font-semibold">{result.driven.toLocaleString("ro-RO")}</span>
                  </div>
                  <div>
                    Preț pe km:{" "}
                    <span className="font-semibold">
                      {result.perKm !== null
                        ? `${result.perKm.toFixed(2)} ${result.currency}/km`
                        : "— (cursa nu are preț setat)"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAll}
                  className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
                >
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
