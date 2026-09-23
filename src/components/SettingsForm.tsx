"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SettingsFormValues = {
  company: string;
  depot: string;
  currency: string;
  cpm: string;
  alertDays: string;
  waCountry: string;
  themeColor: string;
  bgColor: string;
};

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<SettingsFormValues>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      company: values.company || null,
      depot: values.depot || null,
      currency: values.currency || null,
      cpm: values.cpm ? Number(values.cpm) : null,
      alertDays: values.alertDays ? Number(values.alertDays) : null,
      waCountry: values.waCountry || null,
      themeColor: values.themeColor || null,
      bgColor: values.bgColor || null,
    };
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "A apărut o eroare.");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Nume companie</label>
          <input
            type="text"
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Depou / bază</label>
          <input
            type="text"
            value={values.depot}
            onChange={(e) => set("depot", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Monedă implicită</label>
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="€">€ (EUR)</option>
            <option value="$">$ (USD)</option>
            <option value="£">£ (GBP)</option>
            <option value="RON">RON</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Cost pe milă/km (CPM)</label>
          <input
            type="number"
            step="0.01"
            value={values.cpm}
            onChange={(e) => set("cpm", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Alertă expirare documente (zile înainte)</label>
          <input
            type="number"
            value={values.alertDays}
            onChange={(e) => set("alertDays", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Prefix țară WhatsApp</label>
          <input
            type="text"
            placeholder="ex: 40"
            value={values.waCountry}
            onChange={(e) => set("waCountry", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Culoare temă</label>
          <input
            type="color"
            value={values.themeColor || "#2f6fed"}
            onChange={(e) => set("themeColor", e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-300 px-1 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Culoare fundal</label>
          <input
            type="color"
            value={values.bgColor || "#e8f0fb"}
            onChange={(e) => set("bgColor", e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-300 px-1 outline-none focus:border-brand"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-emerald-700">Salvat cu succes.</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "Se salvează..." : "Salvează setările"}
        </button>
      </div>
    </form>
  );
}
