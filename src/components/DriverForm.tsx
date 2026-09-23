"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DriverFormValues = {
  name: string;
  fictiveName: string;
  salary: string;
  tm: string;
  card: string;
  permisExp: string;
  cpcExp: string;
  cardExp: string;
  medicalExp: string;
  phone: string;
  active: boolean;
};

const EMPTY: DriverFormValues = {
  name: "",
  fictiveName: "",
  salary: "",
  tm: "",
  card: "",
  permisExp: "",
  cpcExp: "",
  cardExp: "",
  medicalExp: "",
  phone: "",
  active: true,
};

export function DriverForm({
  initial,
}: {
  initial?: Partial<DriverFormValues> & { id: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<DriverFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof DriverFormValues>(key: K, value: DriverFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      name: values.name,
      fictiveName: values.fictiveName || null,
      salary: values.salary ? Number(values.salary) : null,
      tm: values.tm || null,
      card: values.card || null,
      permisExp: values.permisExp || null,
      cpcExp: values.cpcExp || null,
      cardExp: values.cardExp || null,
      medicalExp: values.medicalExp || null,
      phone: values.phone || null,
      active: values.active,
    };
    const res = await fetch(isEdit ? `/api/drivers/${initial!.id}` : "/api/drivers", {
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
    router.push("/drivers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Nume</label>
          <input
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Șofer fictiv (opțional)</label>
          <input
            value={values.fictiveName}
            onChange={(e) => set("fictiveName", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Salariu / tură</label>
          <input
            type="number"
            step="0.01"
            value={values.salary}
            onChange={(e) => set("salary", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Nr. contract</label>
          <input
            value={values.tm}
            onChange={(e) => set("tm", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Card tahograf (nr.)</label>
          <input
            value={values.card}
            onChange={(e) => set("card", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Permis — expiră</label>
          <input
            type="date"
            value={values.permisExp}
            onChange={(e) => set("permisExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">CPC — expiră</label>
          <input
            type="date"
            value={values.cpcExp}
            onChange={(e) => set("cpcExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Card tahograf — expiră</label>
          <input
            type="date"
            value={values.cardExp}
            onChange={(e) => set("cardExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Aviz medical — expiră</label>
          <input
            type="date"
            value={values.medicalExp}
            onChange={(e) => set("medicalExp", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Telefon (WhatsApp)</label>
          <input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+40712345678"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Șofer activ
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă șofer"}
        </button>
        
          href="/drivers"
          className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition"
        >
          Anulează
        </a>
      </div>
    </form>
  );
}
