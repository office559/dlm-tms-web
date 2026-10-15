"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_STYLES } from "@/lib/fleet-labels";
import { patchVehicle } from "@/lib/planning-helpers";

// Controalele din Planificare sunt împărțite în 3 fișiere (ca să nu fie prea lungi);
// le re-exportăm de aici, ca restul aplicației să le găsească în același loc.
export { StareControl } from "@/components/PlanningStare";
export { ProgramControl, PauseBadgeControl, WeeklyRestControl } from "@/components/PlanningRest";

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
      key={value ?? ""}
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
 * ca o pastilă gri-grafit, mai mare și îngroșată, cu creion de editare alături.
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
          <span className="whitespace-nowrap rounded-lg bg-slate-700 px-3.5 py-1 text-[15px] font-extrabold text-white">
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
