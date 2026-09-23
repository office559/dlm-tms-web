
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BrokerageFormValues = {
  client: string;
  ref: string;
  route: string;
  collectDate: string;
  deliverDate: string;
  clientPrice: string;
  sub: string;
  subPrice: string;
  status: string;
  paidClient: boolean;
  paidSub: boolean;
};

const EMPTY: BrokerageFormValues = {
  client: "",
  ref: "",
  route: "",
  collectDate: "",
  deliverDate: "",
  clientPrice: "",
  sub: "",
  subPrice: "",
  status: "În curs",
  paidClient: false,
  paidSub: false,
};

export function BrokerageForm({
  initial,
}: {
  initial?: Partial<BrokerageFormValues> & { id: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<BrokerageFormValues>({ ...EMPTY, ...initial });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof BrokerageFormValues>(key: K, value: BrokerageFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      client: values.client,
      ref: values.ref || null,
      route: values.route || null,
      collectDate: values.collectDate || null,
      deliverDate: values.deliverDate || null,
      clientPrice: values.clientPrice ? Number(values.clientPrice) : null,
      sub: values.sub || null,
      subPrice: values.subPrice ? Number(values.subPrice) : null,
      status: values.status,
      paidClient: values.paidClient,
      paidSub: values.paidSub,
    };
    const res = await fetch(isEdit ? `/api/brokerage/${initial!.id}` : "/api/brokerage", {
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
    router.push("/brokerage");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Client</label>
          <input
            required
            type="text"
            value={values.client}
            onChange={(e) => set("client", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Referință</label>
          <input
            type="text"
            value={values.ref}
            onChange={(e) => set("ref", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Rută</label>
          <input
            type="text"
            placeholder="Loc încărcare → Loc descărcare"
            value={values.route}
            onChange={(e) => set("route", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Data încărcare</label>
          <input
            type="date"
            value={values.collectDate}
            onChange={(e) => set("collectDate", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Data descărcare</label>
          <input
            type="date"
            value={values.deliverDate}
            onChange={(e) => set("deliverDate", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Preț client</label>
          <input
            type="number"
            step="0.01"
            value={values.clientPrice}
            onChange={(e) => set("clientPrice", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Status</label>
          <select
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="În curs">În curs</option>
            <option value="Finalizat">Finalizat</option>
            <option value="Anulat">Anulat</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Subcontractor</label>
          <input
            type="text"
            value={values.sub}
            onChange={(e) => set("sub", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Preț subcontractor</label>
          <input
            type="number"
            step="0.01"
            value={values.subPrice}
            onChange={(e) => set("subPrice", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            id="paidClient"
            type="checkbox"
            checked={values.paidClient}
            onChange={(e) => set("paidClient", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="paidClient" className="text-sm text-slate-600">Client a plătit</label>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            id="paidSub"
            type="checkbox"
            checked={values.paidSub}
            onChange={(e) => set("paidSub", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="paidSub" className="text-sm text-slate-600">Subcontractor plătit</label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă înregistrare"}
        </button>
        <a href="/brokerage" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
