"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CustomerFormValues = {
  name: string;
  type: string;
  code: string;
  termDays: string;
  commission: string;
  terms: string;
  email: string;
};

const EMPTY: CustomerFormValues = {
  name: "",
  type: "",
  code: "",
  termDays: "",
  commission: "",
  terms: "",
  email: "",
};

export function CustomerForm({
  initial,
}: {
  initial?: Partial<CustomerFormValues> & { id: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      name: values.name,
      type: values.type || null,
      code: values.code || null,
      termDays: values.termDays ? Number(values.termDays) : null,
      commission: values.commission ? Number(values.commission) : null,
      terms: values.terms || null,
      email: values.email || null,
    };
    const res = await fetch(isEdit ? `/api/customers/${initial!.id}` : "/api/customers", {
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
    router.push("/customers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Nume client</label>
          <input
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Tip</label>
          <input
            value={values.type}
            onChange={(e) => set("type", e.target.value)}
            placeholder="ex: Broker, Direct"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Cod</label>
          <input
            value={values.code}
            onChange={(e) => set("code", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Termen plată (zile)</label>
          <input
            type="number"
            value={values.termDays}
            onChange={(e) => set("termDays", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Comision (%)</label>
          <input
            type="number"
            step="0.01"
            value={values.commission}
            onChange={(e) => set("commission", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Condiții / observații</label>
          <textarea
            value={values.terms}
            onChange={(e) => set("terms", e.target.value)}
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
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă client"}
        </button>
        <a href="/customers" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
