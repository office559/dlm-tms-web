"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CompanyRow = {
  id: string;
  name: string;
  active: boolean;
  vehicle_count: number;
};

export function CompaniesManager({ companies }: { companies: CompanyRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Trimite cererea; întoarce true dacă a reușit, altfel setează mesajul de eroare. */
  async function request(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        let message = "Nu s-a putut salva. Încearcă din nou.";
        try {
          const data = await res.json();
          if (data?.error) message = String(data.error);
        } catch {
          // păstrăm mesajul implicit
        }
        setError(message);
        return false;
      }
      return true;
    } catch {
      setError("Nu s-a putut contacta serverul.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCompany() {
    const name = newName.trim();
    if (!name) return;
    if (await request("/api/companies", "POST", { name })) {
      setNewName("");
      router.refresh();
    }
  }

  async function saveName(id: string) {
    const name = editName.trim();
    if (!name) return;
    if (await request(`/api/companies/${id}`, "PATCH", { name })) {
      setEditId(null);
      router.refresh();
    }
  }

  async function toggleActive(c: CompanyRow) {
    if (await request(`/api/companies/${c.id}`, "PATCH", { active: !c.active })) {
      router.refresh();
    }
  }

  async function remove(c: CompanyRow) {
    if (!window.confirm(`Ștergi firma „${c.name}"?`)) return;
    if (await request(`/api/companies/${c.id}`, "DELETE")) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          disabled={busy}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCompany();
          }}
          placeholder="Numele firmei noi"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={addCompany}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
        >
          + Adaugă firmă
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Firmă</th>
              <th className="px-4 py-3">Vehicule</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  {editId === c.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      disabled={busy}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName(c.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.vehicle_count}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(c)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                    title="Apasă ca să schimbi statusul"
                  >
                    {c.active ? "Activă" : "Inactivă"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  {editId === c.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !editName.trim()}
                        onClick={() => saveName(c.id)}
                        className="mr-3 text-sm font-medium text-brand hover:text-brand-dark disabled:opacity-50"
                      >
                        Salvează
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Renunță
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(c.id);
                          setEditName(c.name);
                          setError(null);
                        }}
                        className="mr-3 text-sm text-slate-700 hover:text-slate-900"
                      >
                        Redenumește
                      </button>
                      <button
                        type="button"
                        disabled={busy || c.vehicle_count > 0}
                        onClick={() => remove(c)}
                        title={
                          c.vehicle_count > 0
                            ? "Mută mai întâi vehiculele la altă firmă"
                            : "Șterge firma"
                        }
                        className="text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Șterge
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nicio firmă încă. Adaugă prima firmă mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
