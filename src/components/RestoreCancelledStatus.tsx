"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJobKmInfo, parseKm, patchJobWithKm } from "@/lib/stare-helpers";
import { DialogHeader, KmStartStep } from "@/components/StareDialogs";

type Step = "status" | "kmStart";

/**
 * Insigna „Anulat" din Job Center, pe care se poate apăsa: deschide fereastra
 * „Schimbă status" cu stările în care poți readuce cursa — Viitor (Planificare)
 * sau Tranzit (cu kilometraj de start, care se poate omite).
 * Starea mașinii se recalculează singură din status; taxa de anulare se șterge.
 */
export function RestoreCancelledStatus({
  jobId,
  badgeClassName,
}: {
  jobId: string;
  badgeClassName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("status");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kmStartInput, setKmStartInput] = useState("");

  function close() {
    setOpen(false);
    setStep("status");
    setKmStartInput("");
    setError(null);
  }

  async function restoreToFuture() {
    setSaving(true);
    setError(null);
    const err = await patchJobWithKm(jobId, "planificare", {});
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    close();
    router.refresh();
  }

  async function openTransit() {
    setError(null);
    setStep("kmStart");
    const info = await fetchJobKmInfo(jobId);
    if (info?.kmStart != null) setKmStartInput(String(info.kmStart));
  }

  async function confirmTransit(withKm: boolean) {
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
    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Schimbă statusul cursei anulate"
        className={`${badgeClassName} cursor-pointer hover:opacity-75`}
      >
        Anulat ▾
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "status" && (
              <>
                <DialogHeader title="Schimbă status" onClose={close} />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={restoreToFuture}
                    className="rounded-lg bg-yellow-50 px-3 py-2 text-left text-sm font-medium text-yellow-700 transition hover:bg-yellow-100 disabled:opacity-50"
                  >
                    Viitor (Planificare)
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={openTransit}
                    className="rounded-lg bg-orange-50 px-3 py-2 text-left text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
                  >
                    Tranzit
                  </button>
                </div>
                {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
                <p className="mt-3 text-xs text-slate-500">Taxa de anulare se șterge la restabilire.</p>
              </>
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
                onClose={close}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
