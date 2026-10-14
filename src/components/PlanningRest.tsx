"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTimezone } from "@/components/TimezoneProvider";
import { formatTimeInTz, nowTimeInTz, zonedTimeToDate } from "@/lib/tz";
import { endPauseBody, fmtCountdown, patchVehicle, startPauseBody } from "@/lib/planning-helpers";

const PROGRAM_DURATIONS = [13, 15, 21];

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map((n) => Number(n) || 0);
  const total = (h * 60 + m + hours * 60) % (24 * 60);
  const normalized = total < 0 ? total + 24 * 60 : total;
  const hh = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const mm = (normalized % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Program vehicul: dacă nu e setat, arată „— [+]" (apasă ca să adaugi);
 * dacă e setat, arată o pastilă cu ora de start-final și, dedesubt,
 * „începe în Xh Ym" sau „Mai are Xh Ym", calculate din data+ora exactă
 * salvată la ultima setare.
 */
export function ProgramControl({
  vehicleId,
  programStart,
  programEnd,
  programStartAt,
  programEndAt,
}: {
  vehicleId: string;
  programStart: string | null;
  programEnd: string | null;
  programStartAt: string | null;
  programEndAt: string | null;
}) {
  const router = useRouter();
  const tz = useTimezone();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Orele afișate, în fusul orar ales (cu rezervă pe textul salvat).
  const shownStart = (programStartAt && formatTimeInTz(programStartAt, tz)) || programStart;
  const shownEnd = (programEndAt && formatTimeInTz(programEndAt, tz)) || programEnd;

  const [start, setStart] = useState(shownStart ?? "");
  const [duration, setDuration] = useState<number | "">(() => {
    if (!shownStart || !shownEnd) return "";
    const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(shownStart, d) === shownEnd);
    return guess ?? "";
  });

  function openEditor() {
    setStart(shownStart ?? "");
    if (shownStart && shownEnd) {
      const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(shownStart, d) === shownEnd);
      setDuration(guess ?? "");
    }
    setOpen(true);
  }

  async function save() {
    if (!start || !duration) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const end = addHoursToTime(start, Number(duration));
    const startAt = zonedTimeToDate(start, tz);
    let endAt = zonedTimeToDate(end, tz);
    if (endAt.getTime() <= startAt.getTime()) {
      endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
    }
    await patchVehicle(vehicleId, {
      programStart: start,
      programEnd: end,
      programStartAt: startAt.toISOString(),
      programEndAt: endAt.toISOString(),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  /** Anulează programul (de ex. cursa s-a anulat, șoferul nu mai pornește). */
  async function cancel() {
    setSaving(true);
    await patchVehicle(vehicleId, {
      programStart: null,
      programEnd: null,
      programStartAt: null,
      programEndAt: null,
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const startAtDate = programStartAt ? new Date(programStartAt) : null;
  const endAtDate = programEndAt ? new Date(programEndAt) : null;
  const now = Date.now();

  let subText: string | null = null;
  if (startAtDate && endAtDate) {
    if (now < startAtDate.getTime()) {
      subText = `începe în ${fmtCountdown(startAtDate.getTime() - now)}`;
    } else if (now < endAtDate.getTime()) {
      subText = `Mai are ${fmtCountdown(endAtDate.getTime() - now)}`;
    } else {
      subText = "Program încheiat";
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      {shownStart && shownEnd ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex overflow-hidden rounded-lg text-sm font-semibold">
            <span className="whitespace-nowrap bg-green-700 px-2 py-1 text-white">{shownStart}</span>
            <span className="whitespace-nowrap bg-red-500 px-2 py-1 text-white">{shownEnd}</span>
          </span>
          <button
            type="button"
            onClick={openEditor}
            aria-label="Editează programul"
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
              <h3 className="text-sm font-semibold text-brand-dark">Program vehicul</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="time"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                value={start}
                disabled={saving}
                onChange={(e) => setStart(e.target.value)}
              />
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                value={duration}
                disabled={saving}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— ore</option>
                {PROGRAM_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}h
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving || !start || !duration}
                onClick={save}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
              >
                Salvează
              </button>
              {shownStart && shownEnd && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancel}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  Anulează programul
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAUSE_DURATIONS = [9, 11, 24];

/**
 * Pauză vehicul: dacă nu e activă, arată „— [+]"; dacă e activă, arată o
 * pastilă roșu (start) / verde (final) cu creion de editare, și dedesubt
 * „Mai are Xh Ym" calculat din ora exactă de final a pauzei.
 */
export function PauseBadgeControl({
  vehicleId,
  pause,
  restStart,
  restEnd,
  restStartAt,
  restEndAt,
}: {
  vehicleId: string;
  pause: boolean;
  restStart: string | null;
  restEnd: string | null;
  restStartAt: string | null;
  restEndAt: string | null;
}) {
  const router = useRouter();
  const tz = useTimezone();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState("");
  const [startTime, setStartTime] = useState(() => nowTimeInTz(tz));

  // Orele afișate, în fusul orar ales (cu rezervă pe textul salvat).
  const shownRestStart = (restStartAt && formatTimeInTz(restStartAt, tz)) || restStart;
  const shownRestEnd = (restEndAt && formatTimeInTz(restEndAt, tz)) || restEnd;

  function openEditor() {
    setStartTime(nowTimeInTz(tz));
    setOpen(true);
  }

  async function start(hours: number) {
    setSaving(true);
    await patchVehicle(vehicleId, startPauseBody(hours, tz, startTime));
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function end() {
    setSaving(true);
    await patchVehicle(vehicleId, endPauseBody());
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const endAtDate = restEndAt ? new Date(restEndAt) : null;
  const now = Date.now();
  let subText: string | null = null;
  if (pause && endAtDate) {
    subText =
      now < endAtDate.getTime() ? `Mai are ${fmtCountdown(endAtDate.getTime() - now)}` : "Pauză încheiată";
  }

  return (
    <div className="flex flex-col gap-0.5">
      {pause && shownRestStart && shownRestEnd ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex overflow-hidden rounded-lg text-sm font-semibold">
            <span className="whitespace-nowrap bg-red-500 px-2 py-1 text-white">{shownRestStart}</span>
            <span className="whitespace-nowrap bg-emerald-500 px-2 py-1 text-white">{shownRestEnd}</span>
          </span>
          <button
            type="button"
            onClick={openEditor}
            aria-label="Editează pauza"
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
              <h3 className="text-sm font-semibold text-brand-dark">Pauză vehicul</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Ora de început a pauzei</label>
                <input
                  type="time"
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={startTime}
                  disabled={saving}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              {PAUSE_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={saving}
                  onClick={() => start(d)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {d}h
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="ore personalizat"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={custom}
                  disabled={saving}
                  onChange={(e) => setCustom(e.target.value)}
                />
                <button
                  type="button"
                  disabled={saving || !custom}
                  onClick={() => start(Number(custom))}
                  className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
                >
                  OK
                </button>
              </div>
              {pause && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={end}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  Finalizează pauza
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
        <div className="text-xs font-medium text-purple-500">
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
                <input
                  type="time"
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={startTime}
                  disabled={saving}
                  onChange={(e) => setStartTime(e.target.value)}
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
