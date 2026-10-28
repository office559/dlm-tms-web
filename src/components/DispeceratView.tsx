"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AbsenceReason, DispatchMonth, DispatchVehicle, Stint } from "@/lib/dispatch";

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const REASONS: { value: AbsenceReason; label: string }[] = [
  { value: "concediu", label: "Concediu" },
  { value: "service", label: "Service" },
  { value: "stationare", label: "Staționare" },
];

const inputCls = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand bg-white";
const btnPrimary =
  "rounded-lg bg-brand text-white font-medium px-3.5 py-1.5 text-sm hover:bg-brand-dark transition disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand hover:border-brand transition disabled:opacity-50";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function spanDays(start: string, end: string): number {
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Math.round((b - a) / 86400000) + 1;
}

const CELL: Record<string, string> = {
  w: "bg-[#34a56f]",
  a: "bg-[#f5b53d]",
  h: "bg-slate-100",
};

export function DispeceratView({ data, canEdit }: { data: DispatchMonth; canEdit: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // corecții de perioade: cheia = „început_sfârșit" al perioadei afișate
  const [edits, setEdits] = useState<Record<string, { start: string; end: string }>>({});
  const [newStint, setNewStint] = useState<{ start: string; end: string } | null>(null);
  const [newAbs, setNewAbs] = useState<{ start: string; end: string; reason: AbsenceReason; note: string } | null>(null);

  const [y, m] = data.month.split("-").map(Number);
  const monthStart = `${data.month}-01`;
  const monthEnd = `${data.month}-${String(data.daysInMonth).padStart(2, "0")}`;
  const monthName = MONTHS[m - 1];

  const found =
    data.firms.flatMap((f) => f.vehicles.map((v) => ({ v, firm: f.name }))).find((x) => x.v.id === selectedId) ?? null;
  const selected: DispatchVehicle | null = found ? found.v : null;
  const selectedFirm = found ? found.firm : "";

  function openVehicle(id: string) {
    setSelectedId(id);
    setEdits({});
    setNewStint(null);
    setNewAbs(null);
    setError(null);
  }

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? "Nu s-a putut salva.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Nu s-a putut salva.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const post = (body: Record<string, unknown>) =>
    call("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function saveStintEdit(v: DispatchVehicle, s: Stint) {
    const key = `${s.start}_${s.end}`;
    const e = edits[key];
    if (!e) return;
    const ok = await post({ kind: "stint", vehicleId: v.id, start: e.start, end: e.end, replaceStart: s.start, replaceEnd: s.end });
    if (ok) setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function addStint(v: DispatchVehicle) {
    if (!newStint) return;
    const ok = await post({ kind: "stint", vehicleId: v.id, start: newStint.start, end: newStint.end });
    if (ok) setNewStint(null);
  }

  async function addAbsenceFor(v: DispatchVehicle) {
    if (!newAbs) return;
    const ok = await post({ kind: "absence", vehicleId: v.id, ...newAbs });
    if (ok) setNewAbs(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Dispecerat – pontaj vehicule</h1>
          <p className="mt-1 text-slate-600">
            Zilele în care fiecare mașină a fost la muncă, luate automat din curse. O pauză de cel mult 5 zile fără
            curse nu întrerupe perioada la muncă.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dispecerat?m=${shiftMonth(data.month, -1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-brand hover:border-brand" aria-label="Luna anterioară">
            ◀
          </Link>
          <div className="min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-center font-semibold text-brand">
            {monthName} {y}
          </div>
          <Link href={`/dispecerat?m=${shiftMonth(data.month, 1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-brand hover:border-brand" aria-label="Luna următoare">
            ▶
          </Link>
        </div>
      </div>

      {data.firms.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Nu există vehicule de afișat. Adaugă vehicule în pagina Vehicule și leagă-le de o firmă.
        </div>
      )}

      {data.firms.map((f) => (
        <div key={f.id ?? "fara-firma"} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="text-[15px] font-semibold text-brand-dark">{f.name}</div>
            <div className="text-sm text-slate-600">
              {f.vehicles.length} {f.vehicles.length === 1 ? "mașină" : "mașini"} · <b>{f.worked}</b> zile lucrate în total
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="flex h-10 items-center">
                <div className="w-[104px] shrink-0 pl-4 text-xs font-semibold text-slate-500">MAȘINĂ</div>
                <div className="flex flex-1">
                  {Array.from({ length: data.daysInMonth }, (_, i) => {
                    const dow = (data.firstDow + i) % 7;
                    return (
                      <div key={i} className={`mx-[0.5px] flex-1 text-center text-[10.5px] leading-tight ${dow >= 5 ? "text-amber-700" : "text-slate-500"}`}>
                        <b className="block text-[11px] text-slate-700">{i + 1}</b>
                        {DOW[dow]}
                      </div>
                    );
                  })}
                </div>
                <div className="w-[70px] shrink-0 pr-4 text-right text-xs font-semibold text-slate-500">ZILE</div>
              </div>
              {f.vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => openVehicle(v.id)}
                  className={`flex h-[34px] w-full items-center border-t border-slate-100 text-left hover:bg-sky-50 ${selectedId === v.id ? "bg-sky-50" : ""}`}
                >
                  <div className="w-[104px] shrink-0 truncate pl-4 text-sm font-semibold text-slate-900">{v.plate}</div>
                  <div className="flex flex-1">
                    {v.days.split("").map((c, i) => {
                      const dow = (data.firstDow + i) % 7;
                      return (
                        <div
                          key={i}
                          title={`${v.plate} · ${i + 1} ${MONTHS_SHORT[m - 1]}: ${c === "w" ? "la muncă" : c === "a" ? "absență" : "acasă"}`}
                          className={`mx-[0.5px] h-[22px] flex-1 rounded ${CELL[c]} ${c === "h" && dow >= 5 ? "ring-1 ring-inset ring-slate-300" : ""}`}
                        />
                      );
                    })}
                  </div>
                  <div className="w-[70px] shrink-0 pr-4 text-right text-sm font-bold text-brand-dark">{v.worked}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-4 text-[12.5px] text-slate-600">
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[3px] bg-[#34a56f] align-[-2px]" />La muncă</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[3px] bg-slate-100 align-[-2px] ring-1 ring-inset ring-slate-300" />Acasă / fără perioadă</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[3px] bg-[#f5b53d] align-[-2px]" />Concediu / service / staționare</span>
        <span className="ml-auto text-slate-500">Click pe o mașină pentru a corecta perioada</span>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 z-30 bg-slate-900/10" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 z-40 h-full w-full max-w-[350px] overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-brand-dark">{selected.plate}</div>
                <div className="text-sm text-slate-500">{selectedFirm} · {monthName} {y}</div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="px-1 text-lg text-slate-400 hover:text-slate-700" aria-label="Închide">
                ✕
              </button>
            </div>

            <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Perioade la muncă</div>
            <div className="mt-2 space-y-2">
              {selected.stints.length === 0 && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Nicio perioadă la muncă în această lună.</div>
              )}
              {selected.stints.map((s) => {
                const key = `${s.start}_${s.end}`;
                const e = edits[key] ?? { start: s.start, end: s.end };
                const changed = e.start !== s.start || e.end !== s.end;
                const inMonth = Math.min(spanDays(monthStart, monthEnd), spanDays(s.start > monthStart ? s.start : monthStart, s.end < monthEnd ? s.end : monthEnd));
                return (
                  <div key={key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <b className="text-sm">{fmtShort(s.start)} – {fmtShort(s.end)}</b>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.source === "auto" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                        {s.source === "auto" ? "automat" : "corectat"}
                      </span>
                    </div>
                    <div className="mb-2 mt-0.5 text-xs text-slate-500">
                      {s.start < monthStart ? `începută pe ${fmt(s.start)} · ` : ""}
                      {inMonth} zile în {monthName.toLowerCase()}
                      {s.end > monthEnd ? ` · continuă după ${fmt(monthEnd)}` : ""}
                    </div>
                    {canEdit && (
                      <>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Plecat la muncă</label>
                            <input type="date" className={inputCls} value={e.start} onChange={(ev) => setEdits({ ...edits, [key]: { ...e, start: ev.target.value } })} />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Venit acasă</label>
                            <input type="date" className={inputCls} value={e.end} onChange={(ev) => setEdits({ ...edits, [key]: { ...e, end: ev.target.value } })} />
                          </div>
                        </div>
                        {(changed || s.source === "manual") && (
                          <div className="mt-2 flex gap-2">
                            {changed && (
                              <button type="button" className={btnPrimary} disabled={busy} onClick={() => saveStintEdit(selected!, s)}>
                                Salvează
                              </button>
                            )}
                            {s.source === "manual" && s.id && (
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={busy}
                                onClick={() => call(`/api/dispatch?kind=stint&id=${s.id}`, { method: "DELETE" })}
                              >
                                Revino la automat
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {canEdit &&
                (newStint ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Plecat la muncă</label>
                        <input type="date" className={inputCls} value={newStint.start} onChange={(ev) => setNewStint({ ...newStint, start: ev.target.value })} />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Venit acasă</label>
                        <input type="date" className={inputCls} value={newStint.end} onChange={(ev) => setNewStint({ ...newStint, end: ev.target.value })} />
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className={btnPrimary} disabled={busy || !newStint.start || !newStint.end} onClick={() => addStint(selected!)}>
                        Adaugă
                      </button>
                      <button type="button" className={btnGhost} onClick={() => setNewStint(null)}>Anulează</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewStint({ start: monthStart, end: monthEnd })}
                    className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand"
                  >
                    + Adaugă perioadă la muncă
                  </button>
                ))}
            </div>

            <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Absențe (scad din zilele lucrate)</div>
            <div className="mt-2 space-y-2">
              {selected.absences.map((a) => (
                <div key={a.id} className="flex items-start justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <div>
                    <b className="text-sm">{fmtShort(a.start)} – {fmtShort(a.end)}</b>
                    <div className="text-xs text-amber-800">
                      {REASONS.find((r) => r.value === a.reason)?.label} · {spanDays(a.start, a.end)} zile{a.note ? ` · ${a.note}` : ""}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      className="px-1 text-slate-400 hover:text-red-600"
                      aria-label="Șterge absența"
                      onClick={() => call(`/api/dispatch?kind=absence&id=${a.id}`, { method: "DELETE" })}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {canEdit &&
                (newAbs ? (
                  <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">De la</label>
                        <input type="date" className={inputCls} value={newAbs.start} onChange={(ev) => setNewAbs({ ...newAbs, start: ev.target.value })} />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Până la</label>
                        <input type="date" className={inputCls} value={newAbs.end} onChange={(ev) => setNewAbs({ ...newAbs, end: ev.target.value })} />
                      </div>
                    </div>
                    <select className={inputCls} value={newAbs.reason} onChange={(ev) => setNewAbs({ ...newAbs, reason: ev.target.value as AbsenceReason })}>
                      {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <input className={inputCls} placeholder="Observație (opțional)" maxLength={200} value={newAbs.note} onChange={(ev) => setNewAbs({ ...newAbs, note: ev.target.value })} />
                    <div className="flex gap-2">
                      <button type="button" className={btnPrimary} disabled={busy || !newAbs.start || !newAbs.end} onClick={() => addAbsenceFor(selected!)}>
                        Adaugă
                      </button>
                      <button type="button" className={btnGhost} onClick={() => setNewAbs(null)}>Anulează</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewAbs({ start: monthStart, end: monthStart, reason: "concediu", note: "" })}
                    className="w-full rounded-xl border border-dashed border-slate-400 py-2 text-sm font-bold text-brand hover:border-brand"
                  >
                    + Adaugă absență
                  </button>
                ))}
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="text-sm text-slate-600">Zile lucrate în {monthName.toLowerCase()}</span>
              <b className="text-lg text-brand-dark">{selected.worked}</b>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
