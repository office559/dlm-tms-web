"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Buton „Șterge" pentru un dispecer, cu confirmare într-un mic popup (ca să
 * nu se șteargă din greșeală un cont din listă) — șterge definitiv contul
 * de login al dispecerului.
 */
export function DeleteDispatcherButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/dispatchers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "A apărut o eroare.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-700 text-sm font-medium"
      >
        Șterge
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-dark">Șterge dispecer</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="text-lg leading-none text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Sigur vrei să ștergi contul lui <b>{name}</b>? Nu se mai poate loga după asta.
              Acțiunea nu poate fi anulată.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Renunță
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saving ? "Se șterge..." : "Șterge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
