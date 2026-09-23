"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CostFormValues = {
  date: string;
  category: string;
  vehicleId: string;
  amount: string;
  note: string;
};

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY: CostFormValues = {
  date: today(),
  category: "Combustibil",
  vehicleId: "",
  amount: "",
  note: "",
};

export function CostForm({
  initial,
  vehicles,
}: {
  initial?: Partial<CostFormValues> & { id: string };
  vehicles: { id: string; plate: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<CostFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof CostFormValues>(key: K, value: CostFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      date: values.date,
      category: values.category,
      vehicleId: values.vehicleId || null,
      amount: values.amount ? Number(values.amount) : 0,
      note: values.note || null,
    };
    const res = await fetch(isEdit ? `/api/costs/${initial!.id}` : "/api/costs", {
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
    router.push("/costs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Data</label>
          <input
            required
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Categorie</label>
          <select
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="Combustibil">Combustibil</option>
            <option value="Întreținere">Întreținere</option>
            <option value="Anvelope">Anvelope</option>
            <option value="Taxe drum">Taxe drum</option>
            <option value="Asigurare">Asigurare</option>
            <option value="Amenzi">Amenzi</option>
            <option value="Altele">Altele</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Vehicul</label>
          <select
            value={values.vehicleId}
            onChange={(e) => set("vehicleId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— General (fără vehicul) —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Sumă</label>
          <input
            required
            type="number"
            step="0.01"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Observații</label>
          <textarea
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă cheltuială"}
        </button>
        <a href="/costs" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
