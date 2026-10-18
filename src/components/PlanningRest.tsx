"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Time24Input } from "@/components/Time24Input";
import { useTimezone } from "@/components/TimezoneProvider";
import { formatDateInTz, formatTimeInTz, nowTimeInTz, zonedParts, zonedTimeToDate } from "@/lib/tz";
import { endPauseBody, fmtCountdown, patchVehicle, startPauseBody } from "@/lib/planning-helpers";

// Pauza săptămânală stă în fișierul ei (PlanningWeekly.tsx); se exportă de aici
// ca să rămână neschimbate importurile din PlanningCells.tsx.
export { WeeklyRestControl } from "@/components/PlanningWeekly";

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

/** Data „AAAA-LL-ZZ" a unui moment, în fusul ales (pentru câmpul de dată). */
function dateInputValue(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Momentul exact pentru ora „HH:MM" din ziua „AAAA-LL-ZZ" (în fusul ales). */
function startMoment(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  // amiază UTC: în orice fus din listă cade în aceeași zi calendaristică
  return zonedTimeToDate(time, tz, new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)));
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
  const [startDate, setStartDate] = useState(() =>
    dateInputValue(programStartAt ? new Date(programStartAt) : new Date(), tz)
  );
  const [duration, setDuration] = useState<number | "">(() => {
    if (!shownStart || !shownEnd) return "";
    const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(shownStart, d) === shownEnd);
    return guess ?? "";
  });

  function openEditor() {
    setStart(shownStart ?? "");
    setStartDate(dateInputValue(programStartAt ? new Date(programStartAt) : new Date(), tz));
    if (shownStart && shownEnd) {
      const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(shownStart, d) === shownEnd);
      setDuration(guess ?? "");
    }
    setOpen(true);
  }

  async function save() {
    if (!start || !duration || !startDate) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const startAt = startMoment(startDate, start, tz);
    const endAt = new Date(startAt.getTime() + Number(duration) * 60 * 60 * 1000);
    await patchVehicle(vehicleId, {
      programStart: start,
      programEnd: formatTimeInTz(endAt, tz),
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

  // Previzualizare în fereastră: când se termină programul ales.
  const previewEnd =
    start && duration && startDate
      ? new Date(startMoment(startDate, start, tz).getTime() + Number(duration) * 60 * 60 * 1000)
      : null;

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
              <div className="flex gap-2">
                <input
                  type="date"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={startDate}
                  disabled={saving}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Time24Input
                  className="!w-24 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm disabled:opacity-50"
                  value={start}
                  disabled={saving}
                  onChange={setStart}
                />
              </div>
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
              {previewEnd && (
                <div className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700">
                  Se termină: {formatDateInTz(previewEnd, tz)}, {formatTimeInTz(previewEnd, tz)}
                </div>
              )}
              <button
                type="button"
                disabled={saving || !start || !duration || !startDate}
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
                <Time24Input
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                  value={startTime}
                  disabled={saving}
                  onChange={setStartTime}
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
