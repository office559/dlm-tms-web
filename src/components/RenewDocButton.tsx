"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MONTH_CHOICES = [6, 12, 24] as const;

/** Adaugă luni la o dată „AAAA-LL-ZZ” (ex. 31 ian + 1 lună = 28/29 feb, nu 3 mar). */
function addMonths(iso: string, months: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const target = mo + months;
  const ty = y + Math.floor(target / 12);
  const tm = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** „AAAA-LL-ZZ” → „ZZ.LL.AAAA”. */
function fmt(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Butonul „Actualizează” din pagina Alerte documente: după ce reînnoiești
 * un document (ITP, RCA, CASCO, asigurare, tahograf), alegi data de început
 * a documentului nou și valabilitatea (6 / 12 / 24 luni), iar data de
 * expirare se calculează și se salvează.
 */
export function RenewDocButton({
  kind,
  id,
  plate,
  doc,
  expIso,
}: {
  kind: "vehicul" | "remorcă";
  id: string;
  plate: string;
  doc: string;
  /** data de expirare actuală, „AAAA-LL-ZZ” */
  expIso: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [months, setMonths] = useState<number>(12);

  const newExp = start ? addMonths(start, months) : "";

  function openDialog() {
    // Document încă valabil: noul document începe când expiră cel vechi.
    // Document deja expirat: propunem data de azi.
    const today = todayIso();
    setStart(expIso && expIso >= today ? expIso : today);
    setMonths(12);
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!newExp) {
      setError("Alege data de început.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, doc, expDate: newExp }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "Nu s-a putut salva. Încearcă din nou.");
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Nu s-a putut salva. Verifică conexiunea și încearcă din nou.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1 rounded-lg border border-brand px-2.5 py-1 text-sm font-semibold text-brand transition hover:bg-slate-50"
      >
        <span aria-hidden="true">↻</span> Actualizează
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-brand-dark">Actualizează documentul</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Închide"
                className="text-2xl leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {kind === "vehicul" ? "Vehicul" : "Remorcă"} <b className="text-slate-900">{plate}</b> · {doc} · expiră acum{" "}
              <b className="text-slate-900">{fmt(expIso)}</b>
            </p>

            <label className="mt-4 block text-xs font-semibold text-slate-500">
              Data de început a documentului nou
            </label>
            <input
              type="date"
              value={start}
              disabled={saving}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-50"
            />

            <div className="mt-4 text-xs font-semibold text-slate-500">Valabilitate</div>
            <div className="mt-1 flex gap-2">
              {MONTH_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={saving}
                  onClick={() => setMonths(m)}
                  aria-pressed={months === m}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    months === m
                      ? "border-brand bg-brand text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-brand"
                  }`}
                >
                  {m} luni
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Noua dată de expirare: <b>{newExp ? fmt(newExp) : "—"}</b>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Renunță
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !newExp}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? "Se salvează..." : "Actualizează"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
