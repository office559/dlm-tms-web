"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function patchVehicle(id: string, body: Record<string, unknown>) {
  await fetch(`/api/vehicles/${id}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

async function patchJobStatus(jobId: string, status: string) {
  await fetch(`/api/jobs/${jobId}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

/**
 * Butoane pentru schimbarea manuală a stării cursei direct din Planificare:
 * Alocat (planificare) → Tranzit (activ) sau Anulează; Tranzit (activ) →
 * Finalizează. Nu apare pentru curse deja finalizate/anulate.
 */
export function JobStatusControl({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function setStatus(next: string) {
    setSaving(true);
    await patchJobStatus(jobId, next);
    setSaving(false);
    router.refresh();
  }

  if (status === "planificare") {
    return (
      <div className="flex flex-col gap-1 mt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => setStatus("activ")}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition"
        >
          → Tranzit
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setStatus("anulat")}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
        >
          Anulează
        </button>
      </div>
    );
  }

  if (status === "activ") {
    return (
      <div className="mt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => setStatus("finalizat")}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition"
        >
          Finalizează
        </button>
      </div>
    );
  }

  return null;
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

const PAUSE_DURATIONS = [9, 11, 21, 45];

/**
 * Control pentru pauza vehiculului: bifă activare + durata (9/11/21/45h).
 * La activare calculează automat ora de start/final a pauzei (de la
 * momentul curent) și le salvează pe vehicul; la dezactivare le șterge.
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
  const [dur, setDur] = useState<number | "">(restDurH ?? "");

  async function applyPause(nextOn: boolean, nextDur: number | "") {
    setSaving(true);
    if (nextOn && nextDur) {
      const now = new Date();
      const end = new Date(now.getTime() + Number(nextDur) * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
      await patchVehicle(vehicleId, {
        pause: true,
        restDurH: Number(nextDur),
        restStart: fmt(now),
        restEnd: fmt(end),
        restStartAt: now.toISOString(),
        restEndAt: end.toISOString(),
      });
    } else {
      await patchVehicle(vehicleId, {
        pause: false,
        restDurH: null,
        restStart: null,
        restEnd: null,
        restStartAt: null,
        restEndAt: null,
      });
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
            applyPause(checked, dur);
          }}
        />
        Pauză
      </label>
      {on && (
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-20 disabled:opacity-50"
          value={dur}
          disabled={saving}
          onChange={(e) => {
            const d = e.target.value ? Number(e.target.value) : "";
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
        </select>
      )}
    </div>
  );
}
