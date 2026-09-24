"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TrailerFormValues = {
  plate: string;
  type: string;
  itpExp: string;
  rcaExp: string;
  cascoExp: string;
  active: boolean;
};

const EMPTY: TrailerFormValues = {
  plate: "",
  type: "Box",
  itpExp: "",
  rcaExp: "",
  cascoExp: "",
  active: true,
};

export function TrailerForm({
  initial,
}: {
  initial?: Partial<TrailerFormValues> & { id: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<TrailerFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof TrailerFormValues>(key: K, value: TrailerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      plate: values.plate,
      type: values.type || null,
      itpExp: values.itpExp || null,
      rcaExp: values.rcaExp || null,
      cascoExp: values.cascoExp || null,
      active: values.active,
    };
    const res = await fetch(isEdit ? `/api/trailers/${initial!.id}` : "/api/trailers", {
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
    router.push("/trailers");
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

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Tip remorcă</label>
          <select
            value={values.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="Box">Box</option>
            <option value="Prelată">Prelată</option>
            <option value="Frigo">Frigo</option>
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

        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Remorcă activă
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă remorcă"}
        </button>
        <a href="/trailers" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
