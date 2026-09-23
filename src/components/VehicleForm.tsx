"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VehicleFormValues = {
  plate: string;
  type: string;
  price: string;
  location: string;
  itpExp: string;
  rcaExp: string;
  cascoExp: string;
  insuranceExp: string;
  tachoExp: string;
  driverId: string;
  trailerId: string;
  active: boolean;
};

const EMPTY: VehicleFormValues = {
  plate: "",
  type: "TRACTOR",
  price: "",
  location: "",
  itpExp: "",
  rcaExp: "",
  cascoExp: "",
  insuranceExp: "",
  tachoExp: "",
  driverId: "",
  trailerId: "",
  active: true,
};

export function VehicleForm({
  initial,
  drivers,
  trailers,
}: {
  initial?: Partial<VehicleFormValues> & { id: string };
  drivers: { id: string; name: string }[];
  trailers: { id: string; plate: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<VehicleFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      plate: values.plate,
      type: values.type || null,
      price: values.price ? Number(values.price) : null,
      location: values.location || null,
      itpExp: values.itpExp || null,
      rcaExp: values.rcaExp || null,
      cascoExp: values.cascoExp || null,
      insuranceExp: values.insuranceExp || null,
      tachoExp: values.tachoExp || null,
      driverId: values.driverId || null,
      trailerId: values.trailerId || null,
      active: values.active,
    };
    const res = await fetch(isEdit ? `/api/vehicles/${initial!.id}` : "/api/vehicles", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "A apărut o eroare.");
      setStatus("idle");
      return;
    }
    router.push("/vehicles");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Număr de înmatriculare</label>
          <input
            required
            value={values.plate}
            onChange={(e) => set("plate", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Tip vehicul</label>
          <select
            value={values.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="TRACTOR">Tractor</option>
            <option value="RIGID">Rigid</option>
            <option value="VAN">Van</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Preț / zi</label>
          <input
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Locație curentă</label>
          <input
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Șofer</label>
          <select
            value={values.driverId}
            onChange={(e) => set("driverId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— Niciunul —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Remorcă</label>
          <select
            value={values.trailerId}
            onChange={(e) => set("trailerId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— Niciuna —</option>
            {trailers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">ITP — expiră</label>
          <input
            type="date"
            value={values.itpExp}
            onChange={(e) => set("itpExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">RCA — expiră</label>
          <input
            type="date"
            value={values.rcaExp}
            onChange={(e) => set("rcaExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">CASCO — expiră</label>
          <input
            type="date"
            value={values.cascoExp}
            onChange={(e) => set("cascoExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Asigurare marfă — expiră</label>
          <input
            type="date"
            value={values.insuranceExp}
            onChange={(e) => set("insuranceExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Verificare tahograf — expiră</label>
          <input
            type="date"
            value={values.tachoExp}
            onChange={(e) => set("tachoExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Vehicul activ
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă vehicul"}
        </button>
        <a href="/vehicles" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
