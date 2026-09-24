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

export function LocationInput({ vehicleId, value }: { vehicleId: string; value: string | null }) {
  const router = useRouter();
  const [val, setVal] = useState(value ?? "");

  return (
    <input
      type="text"
      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      value={val}
      placeholder="—"
      onChange={(e) => setVal(e.target.value)}
      onBlur={async () => {
        if (val === (value ?? "")) return;
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
 * Editor pentru programul vehiculului: ora de start + durata (13/15/21h).
 * Ora de final se calculează automat și se salvează pe vehicul.
 */
export function ProgramEditor({
  vehicleId,
  programStart,
  programEnd,
}: {
  vehicleId: string;
  programStart: string | null;
  programEnd: string | null;
}) {
  const router = useRouter();
  const [start, setStart] = useState(programStart ?? "");
  const [duration, setDuration] = useState<number | "">(() => {
    if (!programStart || !programEnd) return "";
    const guess = PROGRAM_DURATIONS.find((d) => addHoursToTime(programStart, d) === programEnd);
    return guess ?? "";
  });
  const [saving, setSaving] = useState(false);

  async function save(nextStart: string, nextDuration: number | "") {
    setSaving(true);
    const end = nextStart && nextDuration ? addHoursToTime(nextStart, Number(nextDuration)) : null;
    await patchVehicle(vehicleId, {
      programStart: nextStart || null,
      programEnd: end,
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="time"
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-24 disabled:opacity-50"
        value={start}
        disabled={saving}
        onChange={(e) => setStart(e.target.value)}
        onBlur={() => save(start, duration)}
      />
      <select
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-24 disabled:opacity-50"
        value={duration}
        disabled={saving}
        onChange={(e) => {
          const d = e.target.value ? Number(e.target.value) : "";
          setDuration(d);
          save(start, d);
        }}
      >
        <option value="">— ore</option>
        {PROGRAM_DURATIONS.map((d) => (
          <option key={d} value={d}>
            {d}h
          </option>
        ))}
      </select>
    </div>
  );
}

const PAUSE_DURATIONS = [9, 11, 24];

/**
 * Control pentru pauza vehiculului: bifă activare + durata (opțiuni rapide
 * 9/11/24h, sau o durată personalizată). La activare calculează automat ora
 * de start/final a pauzei (de la momentul curent) și le salvează pe
 * vehicul; la dezactivare le șterge.
 */
export function PauseControl({
  vehicleId,
  value,
  restDurH,
}: {
  vehicleId: string;
  value: boolean;
  restDurH: number | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [on, setOn] = useState(value);
  const isPreset = restDurH != null && PAUSE_DURATIONS.includes(restDurH);
  const [dur, setDur] = useState<number | "">(isPreset ? (restDurH as number) : "");
  const [custom, setCustom] = useState<string>(!isPreset && restDurH != null ? String(restDurH) : "");
  const [useCustom, setUseCustom] = useState(!isPreset && restDurH != null);

  async function applyPause(nextOn: boolean, nextDur: number | "") {
    setSaving(true);
    if (nextOn && nextDur) {
      await patchVehicle(vehicleId, startPauseBody(Number(nextDur)));
    } else {
      await patchVehicle(vehicleId, endPauseBody());
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          disabled={saving}
          onChange={(e) => {
            const checked = e.target.checked;
            setOn(checked);
            applyPause(checked, useCustom ? (custom ? Number(custom) : "") : dur);
          }}
        />
        Pauză
      </label>
      {on && (
        <>
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-24 disabled:opacity-50"
            value={useCustom ? "custom" : dur}
            disabled={saving}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setUseCustom(true);
                return;
              }
              const d = e.target.value ? Number(e.target.value) : "";
              setUseCustom(false);
              setDur(d);
              applyPause(true, d);
            }}
          >
            <option value="">— ore</option>
            {PAUSE_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d}h
              </option>
            ))}
            <option value="custom">Personalizat</option>
          </select>
          {useCustom && (
            <input
              type="number"
              min={1}
              placeholder="ore"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-24 disabled:opacity-50"
              value={custom}
              disabled={saving}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => custom && applyPause(true, Number(custom))}
            />
          )}
        </>
      )}
    </div>
  );
}
