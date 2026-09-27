"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_LABELS, FLEET_STATE_STYLES } from "@/lib/fleet-labels";

async function patchVehicle(id: string, body: Record<string, unknown>) {
  await fetch(`/api/vehicles/${id}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchJobStatus(jobId: string, status: string) {
  await fetch(`/api/jobs/${jobId}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function DriverSelect({
  vehicleId,
  drivers,
  value,
  state,
}: {
  vehicleId: string;
  drivers: { id: string; name: string }[];
  value: string | null;
  state: FleetState;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <select
      className={`w-full min-w-[140px] rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold disabled:opacity-50 ${FLEET_STATE_STYLES[state]}`}
      defaultValue={value ?? ""}
      disabled={saving}
      onChange={async (e) => {
        setSaving(true);
        await patchVehicle(vehicleId, { driverId: e.target.value || null });
        setSaving(false);
        router.refresh();
      }}
    >
      <option value="">— fără șofer</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Locație vehicul: dacă dispecerul n-a pus nimic manual, se completează
 * automat cu locul ultimei descărcări a vehiculului (fallback). Se afișează
 * ca o pastilă albastră (ca la Pauză) cu creion de editare alături.
 */
export function LocationControl({
  vehicleId,
  value,
  fallback,
}: {
  vehicleId: string;
  value: string | null;
  fallback?: string | null;
}) {
  const router = useRouter();
  const initial = value ?? fallback ?? "";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [val, setVal] = useState(initial);

  async function save() {
    setSaving(true);
    await patchVehicle(vehicleId, { location: val || null });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-0.5">
      {initial ? (
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap rounded-lg bg-blue-500 px-2.5 py-1 text-sm font-semibold text-white">
            {initial}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Editează locația"
            className="text-slate-400 hover:text-slate-600"
          >
            ✎
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <span>—</span>
          <span aria-hidden="true">✎</span>
        </button>
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
              <h3 className="text-sm font-semibold text-brand-dark">Locație vehicul</h3>
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
                type="text"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                placeholder="Ex: DTM1"
                value={val}
                disabled={saving}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
              >
                Salvează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function startPauseBody(hours: number, startTime?: string): Record<string, unknown> {
  const now = startTime ? combineDateTime(startTime) : new Date();
  const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  return {
    pause: true,
    restDurH: hours,
    restStart: fmt(now),
    restEnd: fmt(end),
    restStartAt: now.toISOString(),
    restEndAt: end.toISOString(),
    stateOverride: null,
  };
}

function endPauseBody(): Record<string, unknown> {
  return {
    pause: false,
    restDurH: null,
    restStart: null,
    restEnd: null,
    restStartAt: null,
    restEndAt: null,
  };
}

/** Ora "HH:MM" combinată cu data de azi. */
function combineDateTime(time: string, base: Date = new Date()): Date {
  const [h, m] = time.split(":").map((n) => Number(n) || 0);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "3h 42m" / "42m" dintr-o durată în milisecunde (minim 0). */
function fmtCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type StareOption = {
  label: string;
  style: string;
  run: () => Promise<void>;
};

/**
 * Control unic pentru Stare: apasă pe badge-ul curent și se deschide un
 * popup „Schimbă status" cu stările posibile următoare, exact ca în
 * aplicația de referință (TruckTMS) — pentru fiecare stare (Disponibil,
 * Indisponibil, Pauză, Viitor, Tranzit).
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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const options: StareOption[] = [];

  if (state === "alocat" && jobId) {
    options.push({
      label: "Tranzit",
      style: "text-orange-700 bg-orange-50 hover:bg-orange-100",
      run: () => patchJobStatus(jobId, "activ"),
    });
    options.push({
      label: "Anulează cursa",
      style: "text-red-700 bg-red-50 hover:bg-red-100",
      run: () => patchJobStatus(jobId, "anulat"),
    });
  } else if (state === "tranzit" && jobId) {
    options.push({
      label: "Finalizează cursa",
      style: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
      run: () => patchJobStatus(jobId, "finalizat"),
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
      run: () => patchVehicle(vehicleId, startPauseBody(9)),
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
      run: () => patchVehicle(vehicleId, startPauseBody(9)),
    });
  }

  const clickable = options.length > 0;

  async function choose(opt: StareOption) {
    setSaving(true);
    setOpen(false);
    await opt.run();
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={saving || !clickable}
        onClick={() => setOpen(true)}
        className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${FLEET_STATE_STYLES[state]} ${
          clickable ? "cursor-pointer hover:opacity-75" : "cursor-default"
        } disabled:opacity-50`}
      >
        {FLEET_STATE_LABELS[state]}
      </button>

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
              <h3 className="text-sm font-semibold text-brand-dark">Schimbă status</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
          </div>
        </div>
      )}
    </>
  );
}

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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState(programStart ?? "");
  const [duration, setDuration] = useState<number | "">(() => {
    if (!programStart || !programEnd) return "";
    const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(programStart, d) === programEnd);
    return guess ?? "";
  });

  async function save() {
    if (!start || !duration) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const end = addHoursToTime(start, Number(duration));
    const startAt = combineDateTime(start);
    let endAt = combineDateTime(end);
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
      {programStart && programEnd ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex overflow-hidden rounded-lg text-sm font-semibold">
            <span className="whitespace-nowrap bg-green-700 px-2 py-1 text-white">{programStart}</span>
            <span className="whitespace-nowrap bg-red-500 px-2 py-1 text-white">{programEnd}</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Editează programul"
            className="text-slate-400 hover:text-slate-600"
          >
            ✎
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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
              {programStart && programEnd && (
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
  restEndAt,
}: {
  vehicleId: string;
  pause: boolean;
  restStart: string | null;
  restEnd: string | null;
  restEndAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  async function start(hours: number) {
    setSaving(true);
    await patchVehicle(vehicleId, startPauseBody(hours, startTime));
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
      {pause && restStart && restEnd ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex overflow-hidden rounded-lg text-sm font-semibold">
            <span className="whitespace-nowrap bg-red-500 px-2 py-1 text-white">{restStart}</span>
            <span className="whitespace-nowrap bg-emerald-500 px-2 py-1 text-white">{restEnd}</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Editează pauza"
            className="text-slate-400 hover:text-slate-600"
          >
            ✎
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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
  weeklyRestEndAt,
  suggestedType,
}: {
  vehicleId: string;
  weeklyRest: boolean;
  weeklyRestType: string | null;
  weeklyRestStart: string | null;
  weeklyRestEnd: string | null;
  weeklyRestEndAt: string | null;
  suggestedType: "45" | "24";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  async function start(type: "45" | "24") {
    setSaving(true);
    const hours = WEEKLY_REST_HOURS[type];
    const now = combineDateTime(startTime);
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
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
      {weeklyRest && weeklyRestStart && weeklyRestEnd ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`whitespace-nowrap rounded-lg ${pillColor} px-2 py-1 text-sm font-semibold text-white`}
          >
            {weeklyRestStart} – {weeklyRestEnd}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Editează pauza săptămânală"
            className="text-slate-400 hover:text-slate-600"
          >
            ✎
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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

/**
 * Cazuri: fiecare vehicul poate avea mai multe numere de caz atașate —
 * afișate ca etichete mici, cu buton [+] pentru adăugare rapidă (popup cu
 * un singur câmp text) și „×" pe fiecare etichetă pentru ștergere.
 */
export function CazuriControl({
  vehicleId,
  cases,
}: {
  vehicleId: string;
  cases: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");

  async function add() {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    await patchVehicle(vehicleId, { casesAdd: v });
    setSaving(false);
    setValue("");
    setOpen(false);
    router.refresh();
  }

  async function remove(c: string) {
    setSaving(true);
    await patchVehicle(vehicleId, { casesRemove: c });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {cases.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
          >
            {c}
            <button
              type="button"
              onClick={() => remove(c)}
              disabled={saving}
              aria-label={`Șterge cazul ${c}`}
              className="text-slate-400 hover:text-red-500 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={saving}
          aria-label="Adaugă caz"
          title="Adaugă număr de caz"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          +
        </button>
      </div>

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
              <h3 className="text-sm font-semibold text-brand-dark">Adaugă caz</h3>
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
                type="text"
                autoFocus
                placeholder="Număr de CAZ"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                value={value}
                disabled={saving}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
              />
              <button
                type="button"
                disabled={saving || !value.trim()}
                onClick={add}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
              >
                Adaugă
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
