"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_LABELS } from "@/lib/fleet-labels";
import { useTimezone } from "@/components/TimezoneProvider";
import { endPauseBody, patchVehicle, startPauseBody } from "@/lib/planning-helpers";
import {
  calcKm,
  fetchJobKmInfo,
  parseKm,
  patchJobStatus,
  patchJobWithKm,
} from "@/lib/stare-helpers";
import type { JobKmInfo } from "@/lib/stare-helpers";
import {
  CancelFeeStep,
  DialogHeader,
  DoneStep,
  KmEndStep,
  KmStartStep,
} from "@/components/StareDialogs";

type StareOption = {
  label: string;
  style: string;
  run: () => Promise<void>;
};

type StareStep = "status" | "cancelFee" | "kmStart" | "kmEnd" | "done";

/** Culorile badge-ului de Stare din tabel: text negru, fundal mai intens, ca să se vadă bine. */
const STARE_BADGE_STYLES: Record<FleetState, string> = {
  disponibil: "text-slate-900 bg-green-300",
  indisponibil: "text-slate-900 bg-red-300",
  pauza: "text-slate-900 bg-blue-300",
  alocat: "text-slate-900 bg-yellow-300",
  tranzit: "text-slate-900 bg-orange-300",
  stationare: "text-slate-900 bg-red-300",
  pending: "text-slate-900 bg-violet-300",
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
                <DialogHeader title="Schimbă status" onClose={closeAll} />
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
              <CancelFeeStep
                saving={saving}
                customFee={customFee}
                setCustomFee={setCustomFee}
                confirmCancel={confirmCancel}
                onBack={() => setStep("status")}
                onClose={closeAll}
              />
            )}

            {step === "kmStart" && (
              <KmStartStep
                saving={saving}
                error={error}
                value={kmStartInput}
                setValue={setKmStartInput}
                onConfirm={confirmTransit}
                onBack={() => {
                  setError(null);
                  setStep("status");
                }}
                onClose={closeAll}
              />
            )}

            {step === "kmEnd" && (
              <KmEndStep
                saving={saving}
                error={error}
                jobInfo={jobInfo}
                kmStartInput={kmStartInput}
                setKmStartInput={setKmStartInput}
                kmEndInput={kmEndInput}
                setKmEndInput={setKmEndInput}
                calc={finishCalc}
                currencyLabel={currencyLabel}
                onConfirm={confirmFinish}
                onBack={() => {
                  setError(null);
                  setStep("status");
                }}
                onClose={closeAll}
              />
            )}

            {step === "done" && result && <DoneStep result={result} onClose={closeAll} />}
          </div>
        </div>
      )}
    </>
  );
}
