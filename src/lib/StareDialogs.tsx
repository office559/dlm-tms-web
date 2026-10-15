"use client";

import type { JobKmInfo, KmCalc } from "@/lib/stare-helpers";
import { CANCEL_FEE_PRESETS } from "@/lib/stare-helpers";

const LINK_BTN =
  "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50 transition";
const BACK_BTN =
  "rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50";
const MAIN_BTN =
  "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition";
const KM_INPUT =
  "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50";

export function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-brand-dark">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        className="text-lg leading-none text-slate-400 hover:text-slate-600"
      >
        ×
      </button>
    </div>
  );
}

export function CancelFeeStep({
  saving,
  customFee,
  setCustomFee,
  confirmCancel,
  onBack,
  onClose,
}: {
  saving: boolean;
  customFee: string;
  setCustomFee: (v: string) => void;
  confirmCancel: (fee: number | null) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader title="Taxă de anulare" onClose={onClose} />
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
            className={`shrink-0 ${MAIN_BTN}`}
          >
            OK
          </button>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => confirmCancel(null)}
          className={LINK_BTN}
        >
          Anulează fără taxă
        </button>
        <button type="button" disabled={saving} onClick={onBack} className={BACK_BTN}>
          ← Înapoi
        </button>
      </div>
    </>
  );
}

export function KmStartStep({
  saving,
  error,
  value,
  setValue,
  onConfirm,
  onBack,
  onClose,
}: {
  saving: boolean;
  error: string | null;
  value: string;
  setValue: (v: string) => void;
  onConfirm: (withKm: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader title="Kilometraj start" onClose={onClose} />
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
          className={KM_INPUT}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(true);
          }}
        />
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button type="button" disabled={saving} onClick={() => onConfirm(true)} className={MAIN_BTN}>
          Pornește cursa
        </button>
        <button type="button" disabled={saving} onClick={() => onConfirm(false)} className={LINK_BTN}>
          Pornește fără km
        </button>
        <button type="button" disabled={saving} onClick={onBack} className={BACK_BTN}>
          ← Înapoi
        </button>
      </div>
    </>
  );
}

export function KmEndStep({
  saving,
  error,
  jobInfo,
  kmStartInput,
  setKmStartInput,
  kmEndInput,
  setKmEndInput,
  calc,
  currencyLabel,
  onConfirm,
  onBack,
  onClose,
}: {
  saving: boolean;
  error: string | null;
  jobInfo: JobKmInfo | null;
  kmStartInput: string;
  setKmStartInput: (v: string) => void;
  kmEndInput: string;
  setKmEndInput: (v: string) => void;
  calc: KmCalc;
  currencyLabel: string;
  onConfirm: (withKm: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader title="Kilometraj final" onClose={onClose} />
      <p className="mb-3 text-xs text-slate-500">
        Trece kilometrajul de pe bord la finalul cursei. Aplicația calculează km parcurși și
        prețul pe km.
      </p>
      <div className="flex flex-col gap-2">
        {jobInfo?.kmStart != null ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Km la start:{" "}
            <span className="font-semibold">{jobInfo.kmStart.toLocaleString("ro-RO")}</span>
          </div>
        ) : (
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Km bord (start)"
            className={KM_INPUT}
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
          className={KM_INPUT}
          value={kmEndInput}
          disabled={saving}
          onChange={(e) => setKmEndInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(true);
          }}
        />
        {calc.driven !== null && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <div>
              Km parcurși:{" "}
              <span className="font-semibold">{calc.driven.toLocaleString("ro-RO")}</span>
            </div>
            {calc.perKm !== null && (
              <div>
                Preț pe km:{" "}
                <span className="font-semibold">
                  {calc.perKm.toFixed(2)} {currencyLabel}/km
                </span>
              </div>
            )}
          </div>
        )}
        {calc.s !== null && calc.e !== null && calc.e < calc.s && (
          <div className="text-xs text-red-600">
            Kilometrajul final nu poate fi mai mic decât cel de start.
          </div>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button type="button" disabled={saving} onClick={() => onConfirm(true)} className={MAIN_BTN}>
          Finalizează cursa
        </button>
        <button type="button" disabled={saving} onClick={() => onConfirm(false)} className={LINK_BTN}>
          Finalizează fără km
        </button>
        <button type="button" disabled={saving} onClick={onBack} className={BACK_BTN}>
          ← Înapoi
        </button>
      </div>
    </>
  );
}

export function DoneStep({
  result,
  onClose,
}: {
  result: { driven: number; perKm: number | null; currency: string };
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader title="Cursă finalizată" onClose={onClose} />
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
        onClick={onClose}
        className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
      >
        OK
      </button>
    </>
  );
}
