"use client";

import { useRef, useState } from "react";

const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** Citește un fișier imagine ca base64 (fără prefixul "data:...;base64,") + tipul MIME. */
function readImageAsBase64(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nu am putut citi imaginea."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const match = result.match(/^data:([^;]+);base64,([\s\S]*)$/);
      if (!match) {
        reject(new Error("Format de imagine necunoscut."));
        return;
      }
      resolve({ mediaType: match[1], data: match[2] });
    };
    reader.readAsDataURL(file);
  });
}

/** Ce poate întoarce asistentul AI din textul / poza comenzii. */
export type AiExtracted = {
  clientId?: string;
  clientName?: string;
  ref?: string;
  loadPlace?: string;
  unloadPlace?: string;
  startAt?: string;
  endAt?: string;
  miles?: string | number;
  currency?: string;
  rate?: string | number;
  extra?: string | number;
  notes?: string;
};

/**
 * Zona „Creează cu AI” din formularul de cursă: lipești textul comenzii sau o
 * poză, iar ce extrage asistentul se trimite formularului prin `onFill`.
 */
export function JobAiBox({
  customers,
  onFill,
}: {
  customers: { id: string; name: string }[];
  onFill: (data: AiExtracted) => void;
}) {
  const [aiText, setAiText] = useState("");
  const [aiImage, setAiImage] = useState<{ mediaType: string; data: string; previewUrl: string } | null>(
    null
  );
  const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMatchNotice, setAiMatchNotice] = useState<string | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);

  /** Validează și încarcă un fișier imagine în starea AI — folosit atât la alegerea din disc, cât și la lipire (Ctrl+V). */
  async function processAiImageFile(file: File) {
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
      setAiImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { mediaType, data, previewUrl: URL.createObjectURL(file) };
      });
    } catch (err) {
      console.error(err);
      setAiError("Nu am putut citi imaginea.");
    }
  }

  function handleAiImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processAiImageFile(file);
  }

  /** Ctrl+V direct în zona "Creează cu AI" — dacă în clipboard e o captură de ecran, o atașează automat. */
  function handleAiPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void processAiImageFile(file);
        }
        return;
      }
    }
  }

  function removeAiImage() {
    if (aiImage) URL.revokeObjectURL(aiImage.previewUrl);
    setAiImage(null);
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
      const data = (await res.json().catch(() => ({}))) as AiExtracted & { error?: string };
      if (!res.ok) {
        setAiError(data.error ?? "A apărut o eroare la extragerea AI.");
        setAiStatus("idle");
        return;
      }
      onFill(data);
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

  return (
    <div
      onPaste={handleAiPaste}
      className="rounded-2xl border border-brand/30 bg-brand/5 p-4 space-y-2"
    >
      <label className="text-sm font-medium text-brand-dark">
        Creează cu AI — lipește textul comenzii (email / WhatsApp), atașează o poză sau lipește o captură de ecran (Ctrl+V)
      </label>
      <textarea
        value={aiText}
        onChange={(e) => setAiText(e.target.value)}
        onPaste={handleAiPaste}
        rows={4}
        placeholder="Ex: Bună ziua, avem o cursă de la Ploiești la Berlin, încărcare 28.09 dimineața, descărcare 30.09, tarif 1500 EUR, ref. comandă 4521... (sau apasă Ctrl+V ca să lipești o captură de ecran)"
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
  );
}
