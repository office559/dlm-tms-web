"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** Citește un fișier imagine ca base64 (fără prefixul "data:...;base64,") + tipul MIME. */
function readImageAsBase64(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nu am putut citi imaginea."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const match = result.match(/^data:([^;]+);base64,(.*)$/s);
      if (!match) {
        reject(new Error("Format de imagine necunoscut."));
        return;
      }
      resolve({ mediaType: match[1], data: match[2] });
    };
    reader.readAsDataURL(file);
  });
}

type JobFormValues = {
  clientId: string;
  ref: string;
  loadPlace: string;
  unloadPlace: string;
  startAt: string;
  endAt: string;
  miles: string;
  currency: string;
  rate: string;
  extra: string;
  driverId: string;
  vehicleId: string;
  trailerId: string;
  dispatcherId: string;
  status: string;
  invoice: string;
  paidAt: string;
  notes: string;
};

const EMPTY: JobFormValues = {
  clientId: "",
  ref: "",
  loadPlace: "",
  unloadPlace: "",
  startAt: "",
  endAt: "",
  miles: "",
  currency: "€",
  rate: "",
  extra: "",
  driverId: "",
  vehicleId: "",
  trailerId: "",
  dispatcherId: "",
  status: "planificare",
  invoice: "none",
  paidAt: "",
  notes: "",
};

export function JobForm({
  initial,
  presetVehicleId,
  customers,
  drivers,
  vehicles,
  trailers,
  dispatchers,
}: {
  initial?: Partial<JobFormValues> & { id: string };
  /** Vehicul preselectat (ex. venind din butonul „+” de pe Planificare) — se completează automat șoferul/remorca lui, dacă are. */
  presetVehicleId?: string;
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
  vehicles: { id: string; plate: string; driverId: string | null; trailerId: string | null }[];
  trailers: { id: string; plate: string }[];
  dispatchers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<JobFormValues>(() => {
    if (initial) return { ...EMPTY, ...initial };
    if (presetVehicleId) {
      const match = vehicles.find((v) => v.id === presetVehicleId);
      return {
        ...EMPTY,
        vehicleId: presetVehicleId,
        driverId: match?.driverId ?? "",
        trailerId: match?.trailerId ?? "",
      };
    }
    return EMPTY;
  });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  const [aiText, setAiText] = useState("");
  const [aiImage, setAiImage] = useState<{ mediaType: string; data: string; previewUrl: string } | null>(
    null
  );
  const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMatchNotice, setAiMatchNotice] = useState<string | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAiImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAiError(null);
    if (!file.type.startsWith("image/")) {
      setAiError("Fișierul ales nu este o imagine.");
      return;
    }
    if (file.size > MAX_AI_IMAGE_BYTES) {
      setAiError("Poza e prea mare (max 5MB).");
      return;
    }
    try {
      const { mediaType, data } = await readImageAsBase64(file);
      setAiImage({ mediaType, data, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      console.error(err);
      setAiError("Nu am putut citi imaginea.");
    }
  }

  function removeAiImage() {
    if (aiImage) URL.revokeObjectURL(aiImage.previewUrl);
    setAiImage(null);
  }

  function set<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  /** Alege șoferul și, dacă are un tractor/remorcă alocate, le completează automat. */
  function selectDriver(driverId: string) {
    const match = vehicles.find((v) => v.driverId === driverId);
    setValues((v) => ({
      ...v,
      driverId,
      vehicleId: match ? match.id : v.vehicleId,
      trailerId: match && match.trailerId ? match.trailerId : v.trailerId,
    }));
  }

  /** Alege tractorul și, dacă are o remorcă alocată, o completează automat. */
  function selectVehicle(vehicleId: string) {
    const match = vehicles.find((v) => v.id === vehicleId);
    setValues((v) => ({
      ...v,
      vehicleId,
      trailerId: match && match.trailerId ? match.trailerId : v.trailerId,
    }));
  }

  /** Trimite textul comenzii (email/WhatsApp) la asistentul AI și pre-completează formularul cu ce a extras — dispecerul revede și corectează înainte de a salva. */
  async function handleAiExtract() {
    if (!aiText.trim() && !aiImage) return;
    setAiStatus("loading");
    setAiError(null);
    setAiMatchNotice(null);
    try {
      const res = await fetch("/api/jobs/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          customers,
          image: aiImage ? { mediaType: aiImage.mediaType, data: aiImage.data } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data.error ?? "A apărut o eroare la extragerea AI.");
        setAiStatus("idle");
        return;
      }
      setValues((v) => ({
        ...v,
        clientId: data.clientId || v.clientId,
        ref: data.ref || v.ref,
        loadPlace: data.loadPlace || v.loadPlace,
        unloadPlace: data.unloadPlace || v.unloadPlace,
        startAt: data.startAt || v.startAt,
        endAt: data.endAt || v.endAt,
        miles: data.miles || v.miles,
        currency: data.currency || v.currency,
        rate: data.rate || v.rate,
        extra: data.extra || v.extra,
        notes: data.notes || v.notes,
      }));
      if (data.clientName && !data.clientId) {
        setAiMatchNotice(
          `Clientul „${data.clientName}” a fost identificat în text, dar nu am găsit un client existent cu acest nume — selectează-l manual sau adaugă-l la Clienți.`
        );
      }
      setAiStatus("idle");
    } catch (err) {
      console.error(err);
      setAiError("Extragerea AI a eșuat neașteptat.");
      setAiStatus("idle");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const payload = {
      clientId: values.clientId || null,
      ref: values.ref || null,
      loadPlace: values.loadPlace || null,
      unloadPlace: values.unloadPlace || null,
      startAt: values.startAt || null,
      endAt: values.endAt || null,
      miles: values.miles ? Number(values.miles) : null,
      currency: values.currency || null,
      rate: values.rate ? Number(values.rate) : null,
      extra: values.extra ? Number(values.extra) : null,
      driverId: values.driverId || null,
      vehicleId: values.vehicleId || null,
      trailerId: values.trailerId || null,
      dispatcherId: values.dispatcherId || null,
      status: values.status,
      invoice: values.invoice,
      paidAt: values.paidAt || null,
      notes: values.notes || null,
    };
    const res = await fetch(isEdit ? `/api/jobs/${initial!.id}` : "/api/jobs", {
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
    router.push("/jobs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      {!isEdit && (
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 space-y-2">
          <label className="text-sm font-medium text-brand-dark">
            Creează cu AI — lipește textul comenzii (email / WhatsApp) și/sau atașează o poză
          </label>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={4}
            placeholder="Ex: Bună ziua, avem o cursă de la Ploiești la Berlin, încărcare 28.09 dimineața, descărcare 30.09, tarif 1500 EUR, ref. comandă 4521..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand bg-white"
          />

          <input
            ref={aiFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAiImageSelect}
            className="hidden"
          />

          {aiImage ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={aiImage.previewUrl}
                alt="Poză comandă"
                className="h-16 w-16 rounded-lg border border-slate-300 object-cover"
              />
              <button
                type="button"
                onClick={removeAiImage}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-red-300 hover:text-red-600 transition"
              >
                Șterge poza
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => aiFileInputRef.current?.click()}
              className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-brand hover:text-brand transition"
            >
              📎 Atașează o poză (comandă pe hârtie, captură de ecran)
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAiExtract}
              disabled={aiStatus === "loading" || (!aiText.trim() && !aiImage)}
              className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
            >
              {aiStatus === "loading" ? "Se completează..." : "Completează formularul cu AI"}
            </button>
            <p className="text-xs text-slate-500">
              Câmpurile de mai jos se pre-completează — verifică și corectează înainte de a salva.
            </p>
          </div>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
          {aiMatchNotice && <p className="text-sm text-amber-700">{aiMatchNotice}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Client</label>
          <select
            value={values.clientId}
            onChange={(e) => set("clientId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— Niciunul —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Referință / nr. comandă</label>
          <input
            value={values.ref}
            onChange={(e) => set("ref", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Loc încărcare</label>
          <input
            value={values.loadPlace}
            onChange={(e) => set("loadPlace", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Loc descărcare</label>
          <input
            value={values.unloadPlace}
            onChange={(e) => set("unloadPlace", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Start</label>
          <input
            type="datetime-local"
            value={values.startAt}
            onChange={(e) => set("startAt", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Sfârșit</label>
          <input
            type="datetime-local"
            value={values.endAt}
            onChange={(e) => set("endAt", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Mile / km</label>
          <input
            type="number"
            step="0.01"
            value={values.miles}
            onChange={(e) => set("miles", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Monedă</label>
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="€">EUR (€)</option>
            <option value="$">USD ($)</option>
            <option value="£">GBP (£)</option>
            <option value="RON">RON</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Tarif (rate)</label>
          <input
            type="number"
            step="0.01"
            value={values.rate}
            onChange={(e) => set("rate", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Extra</label>
          <input
            type="number"
            step="0.01"
            value={values.extra}
            onChange={(e) => set("extra", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Șofer</label>
          <select
            value={values.driverId}
            onChange={(e) => selectDriver(e.target.value)}
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
          <label className="text-sm text-slate-600">Vehicul</label>
          <select
            value={values.vehicleId}
            onChange={(e) => selectVehicle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— Niciunul —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Selectând șoferul sau tractorul, remorca alocată se completează automat — poți totuși
            s-o schimbi mai jos.
          </p>
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
          <label className="text-sm text-slate-600">Dispecer</label>
          <select
            value={values.dispatcherId}
            onChange={(e) => set("dispatcherId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— Niciunul —</option>
            {dispatchers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Status</label>
          <select
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="planificare">Planificare</option>
            <option value="activ">Activ</option>
            <option value="finalizat">Finalizat</option>
            <option value="anulat">Anulat</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Facturare</label>
          <select
            value={values.invoice}
            onChange={(e) => set("invoice", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          >
            <option value="none">Nefacturat</option>
            <option value="emisă">Factură emisă</option>
            <option value="plătită">Factură plătită</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Data plății</label>
          <input
            type="date"
            value={values.paidAt}
            onChange={(e) => set("paidAt", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-sm text-slate-600">Observații</label>
          <textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
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
          {status === "loading" ? "Se salvează..." : isEdit ? "Salvează modificările" : "Adaugă cursă"}
        </button>
        <a href="/jobs" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 transition">
          Anulează
        </a>
      </div>
    </form>
  );
}
