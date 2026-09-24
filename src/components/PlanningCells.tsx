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
}: {
  vehicleId: string;
  drivers: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <select
      className="rounded-lg border border-slate-200 px-2 py-1 text-sm bg-white max-w-[150px] disabled:opacity-50"
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
 * Câmp de locație: dacă dispecerul n-a pus nimic manual, se completează
 * automat cu locul ultimei descărcări a vehiculului (fallback), dar
 * rămâne editabil — la prima modificare se salvează valoarea nouă.
 */
export function LocationInput({
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
  const [val, setVal] = useState(initial);

  return (
    <input
      type="text"
      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      value={val}
      placeholder="—"
      onChange={(e) => setVal(e.target.value)}
      onBlur={async () => {
        if (val === initial) return;
        await patchVehicle(vehicleId, { location: val || null });
        router.refresh();
      }}
    />
  );
}

function startPauseBody(hours: number): Record<string, unknown> {
  const now = new Date();
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
        className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${FLEET_STATE_STYLES[state]} ${
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit rounded-lg bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:bg-orange-200 transition"
        >
          {programStart} - {programEnd}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <span>—</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-base leading-none text-slate-500">
            +
          </span>
        </button>
      )}
      {subText && <div className="text-[11px] text-slate-400">{subText}</div>}

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

  async function start(hours: number) {
    setSaving(true);
    await patchVehicle(vehicleId, startPauseBody(hours));
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
            <span className="bg-red-500 px-2 py-1 text-white">{restStart}</span>
            <span className="bg-emerald-500 px-2 py-1 text-white">{restEnd}</span>
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
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-base leading-none text-slate-500">
            +
          </span>
        </button>
      )}
      {subText && <div className="text-[11px] text-slate-400">{subText}</div>}

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
