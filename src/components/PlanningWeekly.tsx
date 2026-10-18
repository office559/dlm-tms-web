"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Time24Input } from "@/components/Time24Input";
import { useTimezone } from "@/components/TimezoneProvider";
import { formatTimeInTz, nowTimeInTz, zonedTimeToDate } from "@/lib/tz";
import { fmtCountdown, patchVehicle } from "@/lib/planning-helpers";

/** Iconiță de lună, pentru cardurile de repaus săptămânal (45h / 24h). */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 1 0 20.354 15.354Z" />
    </svg>
  );
}

const WEEKLY_REST_HOURS: Record<"45" | "24", number> = { "45": 45, "24": 24 };

/**
 * Pauză Săptămânală vehicul: dacă nu e activă, arată „— [+]"; dispecerul
 * alege repaus normal (45h) sau redus (24h), iar ora de final se calculează
 * automat (ora de start + 45/24h), la fel ca la Pauză (zilnică).
 */
export function WeeklyRestControl({
  vehicleId,
  weeklyRest,
  weeklyRestType,
  weeklyRestStart,
  weeklyRestEnd,
  weeklyRestStartAt,
  weeklyRestEndAt,
  suggestedType,
}: {
  vehicleId: string;
  weeklyRest: boolean;
  weeklyRestType: string | null;
  weeklyRestStart: string | null;
  weeklyRestEnd: string | null;
  weeklyRestStartAt: string | null;
  weeklyRestEndAt: string | null;
  suggestedType: "45" | "24";
}) {
  const router = useRouter();
  const tz = useTimezone();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState(() => nowTimeInTz(tz));

  // Orele afișate, în fusul orar ales (cu rezervă pe textul salvat).
  const shownWStart = (weeklyRestStartAt && formatTimeInTz(weeklyRestStartAt, tz)) || weeklyRestStart;
  const shownWEnd = (weeklyRestEndAt && formatTimeInTz(weeklyRestEndAt, tz)) || weeklyRestEnd;

  function openEditor() {
    setStartTime(nowTimeInTz(tz));
    setOpen(true);
  }

  async function start(type: "45" | "24") {
    setSaving(true);
    const hours = WEEKLY_REST_HOURS[type];
    const now = zonedTimeToDate(startTime, tz);
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const fmt = (d: Date) => formatTimeInTz(d, tz);
    await patchVehicle(vehicleId, {
      weeklyRest: true,
      weeklyRestType: type,
      weeklyRestStart: fmt(now),
      weeklyRestEnd: fmt(end),
      weeklyRestStartAt: now.toISOString(),
      weeklyRestEndAt: end.toISOString(),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function endRest() {
    setSaving(true);
    await patchVehicle(vehicleId, {
      weeklyRest: false,
      weeklyRestType: null,
      weeklyRestStart: null,
      weeklyRestEnd: null,
      weeklyRestStartAt: null,
      weeklyRestEndAt: null,
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const endAtDate = weeklyRestEndAt ? new Date(weeklyRestEndAt) : null;
  const now = Date.now();
  let subText: string | null = null;
  if (weeklyRest && endAtDate) {
    subText =
      now < endAtDate.getTime()
        ? `Mai are ${fmtCountdown(endAtDate.getTime() - now)}`
        : "Repaus încheiat";
  }

  const pillColor = weeklyRestType === "45" ? "bg-purple-500" : "bg-sky-500";

  return (
    <div className="flex flex-col gap-0.5">
      {weeklyRest && shownWStart && shownWEnd ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`whitespace-nowrap rounded-lg ${pillColor} px-2 py-1 text-sm font-semibold text-white`}
          >
            {shownWStart} – {shownWEnd}
          </span>
          <button
            type="button"
            onClick={openEditor}
            aria-label="Editează pauza săptămânală"
            className="text-slate-400 hover:text-slate-600"
          >
            ✎
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openEditor}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <span>—</span>
          <span aria-hidden="true">✎</span>
        </button>
      )}
      {subText && <div className="text-xs text-slate-400">{subText}</div>}
      {!weeklyRest && (
        <div className="text-sm font-semibold text-slate-900">
          Recomandat: {suggestedType}h
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-dark">Pauză Săptămânală</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Ora de început</label>
                <Time24Input
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={startTime}
                  disabled={saving}
                  onChange={setStartTime}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => start("45")}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white px-2 py-3 transition disabled:opacity-50 ${
                    suggestedType === "45"
                      ? "border-purple-400 bg-purple-50/50"
                      : "border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                  }`}
                >
                  {suggestedType === "45" && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Recomandat
                    </span>
                  )}
                  <MoonIcon className="h-6 w-6 text-purple-500" />
                  <span className="text-sm font-bold text-slate-700">45h</span>
                  <span className="text-[11px] text-center font-medium text-purple-600">
                    Repaus săptămânal
                  </span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => start("24")}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white px-2 py-3 transition disabled:opacity-50 ${
                    suggestedType === "24"
                      ? "border-sky-400 bg-sky-50/50"
                      : "border-sky-200 hover:border-sky-400 hover:bg-sky-50"
                  }`}
                >
                  {suggestedType === "24" && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Recomandat
                    </span>
                  )}
                  <MoonIcon className="h-6 w-6 text-sky-500" />
                  <span className="text-sm font-bold text-slate-700">24h</span>
                  <span className="text-[11px] text-center font-medium text-sky-600">
                    Repaus redus
                  </span>
                </button>
              </div>
              {weeklyRest && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={endRest}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  Finalizează pauza săptămânală
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
