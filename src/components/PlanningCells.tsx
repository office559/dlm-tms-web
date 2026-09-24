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

export function PauseToggle({ vehicleId, value }: { vehicleId: string; value: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={value}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true);
          await patchVehicle(vehicleId, { pause: e.target.checked });
          setSaving(false);
          router.refresh();
        }}
      />
      Pauză
    </label>
  );
}
