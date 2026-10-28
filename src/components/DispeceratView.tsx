"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DispatchYear, DispatchVehicle, DispatchPeriod } from "@/lib/dispatch";

const MONTHS_SHORT = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];

const inputCls = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand bg-white";
const btnPrimary =
  "rounded-lg bg-brand text-white font-medium px-3.5 py-1.5 text-sm hover:bg-brand-dark transition disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand hover:border-brand transition disabled:opacity-50";

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function dayNum(iso: string): number {
  return Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
}

/** Zilele dintre două date, ambele incluse. */
function spanDays(start: string, end: string): number {
  return dayNum(end) - dayNum(start) + 1;
}

function pluralZile(n: number): string {
  return n === 1 ? "1 zi" : `${n} zile`;
}

function pluralMasini(n: number): string {
  return n === 1 ? "1 mașină" : `${n} mașini`;
}

async function call(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = ""): Promise<string | null> {
  try {
    const res = await fetch(`/api/dispatch${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return null;
    const j = await res.json().catch(() => null);
    return (j && typeof j.error === "string" && j.error) || "Nu s-a putut salva. Încearcă din nou.";
  } catch {
    return "Nu s-a putut salva. Verifică conexiunea și încearcă din nou.";
  }
}

export function DispeceratView({ data }: { data: DispatchYear }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, { start: string; end: string }>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const all = data.firms.flatMap((f) => f.vehicles.map((v) => ({ v, firm: f.name })));
  const selected: DispatchVehicle | null = all.find((x) => x.v.id === vehicleId)?.v ?? null;
  const totalVehicles = all.length;
  const totalDays = data.firms.reduce((a, f) => a + f.total, 0);

  function resetForm() {
    setEdits({});
    setConfirmDel(null);
    setNewStart("");
    setNewEnd("");
    setError(null);
    setNotice(null);
  }

  function openPanel(id: string) {
    resetForm();
    setVehicleId(id);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    resetForm();
  }

  function pickVehicle(id: string) {
    resetForm();
    setVehicleId(id);
  }

  async function run(fn: () => Promise<string | null>, onOk?: () => void) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const err = await fn();
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onOk?.();
    router.refresh();
  }

  function addPeriod() {
    if (!vehicleId) return setError("Alege o mașină.");
    if (!newStart) return setError("Alege data venirii.");
    const start = newStart;
    const end = newEnd;
    run(
      () => call("POST", { vehicleId, start, end: end || null }),
      () => {
        setNewStart("");
        setNewEnd("");
        const endYear = end ? Number(end.slice(0, 4)) : data.year;
        if (Number(start.slice(0, 4)) > data.year || endYear < data.year) {
          setNotice(`Perioada a fost salvată, dar nu atinge anul ${data.year}.`);
        }
      }
    );
  }

  function savePeriod(p: DispatchPeriod) {
    const e = edits[p.id];
    if (!e) return;
    if (!e.start) return setError("Alege data venirii.");
    run(
      () => call("PATCH", { id: p.id, start: e.start, end: e.end || null }),
      () => {
        setEdits((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
      }
    );
  }

  function removePeriod(p: DispatchPeriod) {
    run(
      () => call("DELETE", undefined, `?id=${encodeURIComponent(p.id)}`),
      () => setConfirmDel(null)
    );
  }

  function setEdit(p: DispatchPeriod, patch: Partial<{ start: string; end: string }>) {
    setEdits((prev) => {
      const cur = prev[p.id] ?? { start: p.start, end: p.end ?? "" };
      return { ...prev, [p.id]: { ...cur, ...patch } };
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dispecerat</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Zilele lucrate de fiecare mașină, pe luni. Introduci data venirii și data plecării, iar aplicația numără zilele.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 bg-white">
            <Link
              href={`/dispecerat?y=${data.year - 1}`}
              className="px-2.5 py-1.5 text-sm text-slate-600 hover:text-brand"
              aria-label="Anul precedent"
            >
              ◀
            </Link>
            <span className="px-2 text-sm font-semibold text-slate-900 tabular-nums">{data.year}</span>
            <Link
              href={`/dispecerat?y=${data.year + 1}`}
              className="px-2.5 py-1.5 text-sm text-slate-600 hover:text-brand"
              aria-label="Anul următor"
            >
              ▶
            </Link>
          </div>
          <button type="button" className={btnPrimary} onClick={() => openPanel("")}>
            + Adaugă perioadă
          </button>
        </div>
      </div>

      {data.firms.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nu există mașini. Adaugă mai întâi mașinile în secțiunea Mașini.
        </div>
      )}

      {data.firms.length > 0 && (
        <p className="text-xs text-slate-500">
          Total {data.year}: {pluralMasini(totalVehicles)} · {pluralZile(totalDays)} lucrate
        </p>
      )}

      {data.firms.map((firm) => (
        <section key={firm.id ?? "none"} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-900">{firm.name}</h2>
            <span className="text-xs text-slate-500">
              {pluralMasini(firm.vehicles.length)} · {firm.total} zile lucrate în {data.year}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="text-left font-semibold px-4 py-2">Mașină</th>
                  {MONTHS_SHORT.map((m) => (
                    <th key={m} className="text-center font-semibold px-1 py-2 w-[52px]">
                      {m}
                    </th>
                  ))}
                  <th className="text-right font-semibold px-4 py-2 w-[72px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {firm.vehicles.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => openPanel(v.id)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 whitespace-nowrap">{v.plate}</td>
                    {v.months.map((n, i) => (
                      <td key={i} className="px-1 py-2 text-center">
                        {n > 0 ? (
                          <span className="inline-block min-w-[30px] rounded-md bg-[#34a56f]/15 px-1.5 py-0.5 text-xs font-semibold text-[#1f7a4d] tabular-nums whitespace-nowrap">
                            {n}
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-slate-900 tabular-nums">{v.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Închide"
            className="absolute inset-0 bg-slate-900/30"
            onClick={closePanel}
          />
          <aside className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {selected ? `Perioade — ${selected.plate}` : "Adaugă perioadă"}
              </h2>
              <button type="button" className="text-slate-500 hover:text-slate-900 text-lg leading-none" onClick={closePanel}>
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mașina</label>
                <select className={inputCls} value={vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
                  <option value="">Alege mașina…</option>
                  {data.firms.map((f) => (
                    <optgroup key={f.id ?? "none"} label={f.name}>
                      {f.vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {selected && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Perioade în {data.year}</div>
                  {selected.periods.length === 0 && (
                    <p className="text-sm text-slate-500">Nu există nicio perioadă în {data.year}.</p>
                  )}
                  <div className="space-y-3">
                    {selected.periods.map((p) => {
                      const e = edits[p.id];
                      const start = e ? e.start : p.start;
                      const end = e ? e.end : p.end ?? "";
                      const days = start && (end || data.today >= start) ? spanDays(start, end || data.today) : 0;
                      return (
                        <div key={p.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Data venirii</label>
                              <input
                                type="date"
                                className={inputCls}
                                value={start}
                                onChange={(ev) => setEdit(p, { start: ev.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Data plecării</label>
                              <input
                                type="date"
                                className={inputCls}
                                value={end}
                                onChange={(ev) => setEdit(p, { end: ev.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-slate-500">
                              {!end && (
                                <span className="mr-1.5 rounded bg-[#34a56f]/15 px-1.5 py-0.5 font-semibold text-[#1f7a4d]">
                                  în curs
                                </span>
                              )}
                              {days > 0 ? `${pluralZile(days)}${end ? "" : " până azi"}` : ""}
                            </div>
                            <div className="flex items-center gap-2">
                              {e && (
                                <button type="button" className={btnPrimary} disabled={busy} onClick={() => savePeriod(p)}>
                                  Salvează
                                </button>
                              )}
                              {confirmDel === p.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-lg bg-red-600 text-white font-medium px-3 py-1.5 text-sm hover:bg-red-700 transition disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => removePeriod(p)}
                                  >
                                    Sigur, șterge
                                  </button>
                                  <button type="button" className={btnGhost} disabled={busy} onClick={() => setConfirmDel(null)}>
                                    Nu
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => setConfirmDel(p.id)}
                                >
                                  Șterge
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {vehicleId && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Perioadă nouă</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Data venirii</label>
                      <input type="date" className={inputCls} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Data plecării</label>
                      <input type="date" className={inputCls} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Lasă data plecării goală dacă mașina e încă la dispecerat. Se numără ambele zile.
                  </p>
                  <button type="button" className={btnPrimary} disabled={busy} onClick={addPeriod}>
                    Adaugă perioada
                  </button>
                </div>
              )}

              {!vehicleId && <p className="text-sm text-slate-500">Alege mașina pentru care vrei să introduci perioada.</p>}

              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              {notice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
