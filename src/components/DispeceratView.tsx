"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DispatchMonth, DispatchVehicle, DispatchPeriod } from "@/lib/dispatch";

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

const inputCls = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand bg-white";
const btnPrimary =
  "rounded-lg bg-brand text-white font-medium px-3.5 py-1.5 text-sm hover:bg-brand-dark transition disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand hover:border-brand transition disabled:opacity-50";

function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function money(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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

async function call(method: "POST" | "PATCH" | "DELETE" | "PUT", body?: unknown, query = ""): Promise<string | null> {
  try {
    const res = await fetch(`/api/dispatch${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return null;
    const j = await res.json().catch(() => null);
    return (j && typeof j.error === "string" && j.error) || `Nu s-a putut salva (cod ${res.status}). Încearcă din nou.`;
  } catch {
    return "Nu s-a putut salva. Verifică conexiunea și încearcă din nou.";
  }
}

export function DispeceratView({ data }: { data: DispatchMonth }) {
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
  const [y, mo] = data.month.split("-").map(Number);
  const monthLabel = `${MONTHS[mo - 1]} ${y}`;
  const [priceError, setPriceError] = useState<string | null>(null);

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
        if (start.slice(0, 7) > data.month || (end && end.slice(0, 7) < data.month)) {
          setNotice(`Perioada a fost salvată, dar nu atinge luna ${monthLabel}. O vezi când schimbi luna.`);
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

  async function savePrice(v: DispatchVehicle, text: string) {
    const t = text.trim().replace(",", ".");
    const next = t === "" ? null : Number(t);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setPriceError(`Prețul pentru ${v.plate} nu este valid.`);
      router.refresh();
      return;
    }
    if (next === v.price) {
      setPriceError(null);
      return;
    }
    setPriceError(null);
    const err = await call("PUT", { vehicleId: v.id, month: data.month, amount: next });
    if (err) setPriceError(err);
    router.refresh();
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
            Perioadele mașinilor la dispecerat, pe firme, cu zile și preț. Prețul îl scrii tu, pe lună.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 bg-white">
            <Link
              href={`/dispecerat?m=${shiftMonth(data.month, -1)}`}
              className="px-2.5 py-1.5 text-sm text-slate-600 hover:text-brand"
              aria-label="Luna precedentă"
            >
              ◀
            </Link>
            <span className="px-2 min-w-[130px] text-center text-sm font-semibold text-slate-900">{monthLabel}</span>
            <Link
              href={`/dispecerat?m=${shiftMonth(data.month, 1)}`}
              className="px-2.5 py-1.5 text-sm text-slate-600 hover:text-brand"
              aria-label="Luna următoare"
            >
              ▶
            </Link>
          </div>
          <button type="button" className={btnPrimary} onClick={() => openPanel("")}>
            + Adaugă perioadă
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">TOTAL EURO {MONTHS[mo - 1]}</div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{money(data.totalEuro)} €</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">Mașini la dispecerat</div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{data.vehiclesWorking}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">Zile lucrate</div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{data.totalDays}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">În curs acum</div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{data.openCount}</div>
        </div>
      </div>

      {priceError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{priceError}</div>
      )}

      {data.firms.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nu există mașini. Adaugă mai întâi mașinile în secțiunea Mașini.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
        {data.firms.map((firm) => (
          <section key={firm.id ?? "none"} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-brand text-white px-4 py-2.5 font-semibold text-sm">{firm.name}</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="text-left font-semibold px-3 py-1.5">Mașină</th>
                  <th className="text-left font-semibold px-2 py-1.5">In</th>
                  <th className="text-left font-semibold px-2 py-1.5">Out</th>
                  <th className="text-right font-semibold px-2 py-1.5">Zile</th>
                  <th className="text-right font-semibold px-3 py-1.5">Preț €</th>
                </tr>
              </thead>
              <tbody>
                {firm.vehicles.map((v) => {
                  const rows = v.periods.length > 0 ? v.periods : [null];
                  return rows.map((p, i) => (
                    <tr
                      key={`${v.id}-${p ? p.id : "x"}`}
                      onClick={() => openPanel(v.id)}
                      className={`${i === 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 cursor-pointer`}
                    >
                      <td className="px-3 py-1.5 font-semibold text-slate-900 whitespace-nowrap">{i === 0 ? v.plate : ""}</td>
                      <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{p ? fmtShort(p.start) : ""}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {p ? (
                          p.end ? (
                            <span className="text-slate-700">{fmtShort(p.end)}</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                              în curs
                            </span>
                          )
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{p ? p.days : ""}</td>
                      <td className="px-3 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                        {i === 0 && (
                          <input
                            key={`${v.id}-${data.month}-${v.price ?? ""}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={v.price === null ? "" : money(v.price)}
                            placeholder="–"
                            aria-label={`Preț ${v.plate}`}
                            className="w-[68px] rounded-md border border-transparent hover:border-slate-300 focus:border-brand bg-transparent px-1.5 py-0.5 text-right text-xs tabular-nums outline-none"
                            onBlur={(e) => savePrice(v, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <span>
                {pluralZile(firm.days)} · TOTAL:
              </span>
              <b className="text-sm text-brand-dark tabular-nums">{money(firm.total)} €</b>
            </div>
          </section>
        ))}
      </div>

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
                  <div className="text-xs font-semibold text-slate-600 mb-2">Perioade în {monthLabel}</div>
                  {selected.periods.length === 0 && (
                    <p className="text-sm text-slate-500">Nu există nicio perioadă în {monthLabel}.</p>
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
