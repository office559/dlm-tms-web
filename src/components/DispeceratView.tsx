"use client";

import { useState, type ReactNode } from "react";
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

const FIRM_COLORS = ["#2563eb", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

/** „01–30 noi" când e în aceeași lună, altfel „28 oct – 03 noi". */
function periodLabel(p: DispatchPeriod): string {
  if (!p.end) return fmtShort(p.start);
  if (p.start.slice(0, 7) === p.end.slice(0, 7)) {
    const [, m, d1] = p.start.split("-").map(Number);
    const d2 = Number(p.end.slice(8, 10));
    return `${String(d1).padStart(2, "0")}–${String(d2).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
  }
  return `${fmtShort(p.start)} – ${fmtShort(p.end)}`;
}

function pluralZile(n: number): string {
  return n === 1 ? "1 zi" : `${n} zile`;
}

async function callJson(
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
  query = ""
): Promise<{ error: string | null; json: { id?: string } | null }> {
  try {
    const res = await fetch(`/api/dispatch${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => null);
    if (res.ok) return { error: null, json: j };
    return {
      error: (j && typeof j.error === "string" && j.error) || `Nu s-a putut salva (cod ${res.status}). Încearcă din nou.`,
      json: null,
    };
  } catch {
    return { error: "Nu s-a putut salva. Verifică conexiunea și încearcă din nou.", json: null };
  }
}

async function call(method: "POST" | "PATCH" | "DELETE" | "PUT", body?: unknown, query = ""): Promise<string | null> {
  return (await callJson(method, body, query)).error;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Închide" className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" className="text-lg leading-none text-slate-500 hover:text-slate-900" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
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

  // meniul „+ Adaugă", ferestrele „Mașină nouă" / „Client nou" / „Gestionează firme"
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<null | "vehicle" | "client" | "firms">(null);
  const [plate, setPlate] = useState("");
  const [firmId, setFirmId] = useState("");
  const [clientName, setClientName] = useState("");
  const [vehMode, setVehMode] = useState<"new" | "existing">("new");
  const [pickId, setPickId] = useState("");
  const [pickFilter, setPickFilter] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const hiddenFirms = data.allFirms.filter((f) => f.hidden);
  const [expanded, setExpanded] = useState<string[]>([]);
  const hasPeriods = (f: DispatchMonth["firms"][number]) => f.vehicles.some((v) => v.periods.length > 0);
  const shownFirms = data.firms.filter((f) => hasPeriods(f) || expanded.includes(f.id ?? "none"));
  const emptyFirms = data.firms.filter((f) => !hasPeriods(f) && !expanded.includes(f.id ?? "none"));

  function openModal(kind: "vehicle" | "client" | "firms", presetFirm = "") {
    setMenuOpen(false);
    setModalError(null);
    setPlate("");
    setClientName("");
    setVehMode("new");
    setPickId("");
    setPickFilter("");
    setFirmId(presetFirm);
    setModal(kind);
  }

  async function submitVehicle() {
    setBusy(true);
    setModalError(null);
    const r = await callJson("POST", { plate, companyId: firmId || null }, "?t=vehicle");
    setBusy(false);
    if (r.error) return setModalError(r.error);
    setModal(null);
    setFlash(`Mașina ${plate.trim().toUpperCase()} a fost adăugată. Adaugă-i o perioadă din „+ Adaugă → Perioadă".`);
    router.refresh();
  }

  async function submitExisting() {
    if (!pickId) return setModalError("Alege o mașină din listă.");
    if (!firmId) return setModalError("Alege firma.");
    const veh = data.vehicleOptions.find((o) => o.id === pickId);
    setBusy(true);
    setModalError(null);
    const err = await call("PATCH", { vehicleId: pickId, companyId: firmId }, "?t=vehicle");
    setBusy(false);
    if (err) return setModalError(err);
    setModal(null);
    setFlash(`Mașina ${veh?.plate ?? ""} a fost pusă la firma aleasă. Adaugă-i o perioadă din „+ Adaugă → Perioadă".`);
    router.refresh();
  }

  async function submitClient() {
    setBusy(true);
    setModalError(null);
    const r = await callJson("POST", { name: clientName }, "?t=company");
    setBusy(false);
    if (r.error) return setModalError(r.error);
    setModal(null);
    setFlash(`Clientul ${clientName.trim()} a fost adăugat. Adaugă-i mașini cu „+ Mașină în această firmă".`);
    router.refresh();
  }

  async function toggleFirm(id: string, hidden: boolean) {
    setBusy(true);
    setModalError(null);
    const err = await call("PATCH", { id, hidden }, "?t=firm");
    setBusy(false);
    if (err) return setModalError(err);
    router.refresh();
  }

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

  async function saveRate(v: DispatchVehicle, text: string) {
    const t = text.trim().replace(",", ".");
    const next = t === "" ? null : Number(t);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setPriceError(`Prețul pe zi pentru ${v.plate} nu este valid.`);
      router.refresh();
      return;
    }
    if (next === v.rate) {
      setPriceError(null);
      return;
    }
    setPriceError(null);
    const err = await call("PUT", { vehicleId: v.id, month: data.month, rate: next });
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
            Perioadele mașinilor la dispecerat, pe firme. Scrii prețul pe zi, iar totalul lunii = zile × preț pe zi.
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
          <div className="relative">
            <button type="button" className={btnPrimary} onClick={() => setMenuOpen((o) => !o)}>
              + Adaugă ▾
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Închide meniul"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setMenuOpen(false);
                      openPanel("");
                    }}
                  >
                    Perioadă la dispecerat
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    onClick={() => openModal("vehicle")}
                  >
                    Mașină (nouă sau din Vehicule)
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    onClick={() => openModal("client")}
                  >
                    Client nou
                  </button>
                </div>
              </>
            )}
          </div>
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

      {flash && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{flash}</span>
          <button type="button" className="text-emerald-700 hover:text-emerald-900" onClick={() => setFlash(null)}>
            ✕
          </button>
        </div>
      )}

      {priceError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{priceError}</div>
      )}

      {data.firms.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nu ai nicio firmă sau mașină în Dispecerat. Adaugă un client din „+ Adaugă".
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {shownFirms.map((firm) => {
          const idx = data.firms.indexOf(firm);
          const color = FIRM_COLORS[idx % FIRM_COLORS.length];
          const share = data.totalEuro > 0 ? Math.min(100, (firm.total / data.totalEuro) * 100) : 0;
          return (
            <section
              key={firm.id ?? "none"}
              className="rounded-xl border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm"
              style={{ borderTop: `4px solid ${color}` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-[15px] font-extrabold text-slate-900">{firm.name}</h2>
                <b className="shrink-0 text-[15px] tabular-nums" style={{ color }}>
                  {money(firm.total)} €
                </b>
              </div>
              <div className="mb-1 mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>
                  {firm.vehicles.length} {firm.vehicles.length === 1 ? "mașină" : "mașini"} · {pluralZile(firm.days)}
                </span>
                <span>{Math.round(share)}% din total</span>
              </div>
              <div className="mb-2 h-1 rounded-full bg-slate-100">
                <div className="h-1 rounded-full" style={{ width: `${share}%`, background: color }} />
              </div>

              {firm.vehicles.length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400">Nicio mașină la această firmă.</p>
              )}

              {firm.vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => openPanel(v.id)}
                  className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1.5 py-1.5 text-[13px] hover:bg-slate-50"
                >
                  <div className="w-[92px] shrink-0 font-bold text-slate-900">{v.plate}</div>
                  <div className="min-w-[110px] flex-1 text-slate-400">
                    {v.periods.length === 0 && <span className="text-slate-300">fără perioadă</span>}
                    {v.periods.map((p, i) => (
                      <span key={p.id} className="whitespace-nowrap">
                        {i > 0 && ", "}
                        {periodLabel(p)}
                        {!p.end && (
                          <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            în curs
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="w-10 text-right tabular-nums text-slate-600">{v.days > 0 ? `${v.days} z` : ""}</div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      key={`${v.id}-${data.month}-${v.rate ?? ""}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={v.rate === null ? "" : money(v.rate)}
                      placeholder="preț/zi"
                      aria-label={`Preț pe zi ${v.plate}`}
                      className="w-[68px] rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-brand"
                      onBlur={(e) => saveRate(v, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <span className="ml-1 text-xs text-slate-400">€</span>
                  </div>
                  <div className="w-[76px] text-right font-bold tabular-nums text-slate-900">
                    {v.rate === null ? <span className="font-normal text-slate-300">–</span> : `${money(v.total)} €`}
                  </div>
                </div>
              ))}

              {firm.id && (
                <button
                  type="button"
                  className="mt-1 px-1.5 py-1 text-xs font-bold text-brand hover:underline"
                  onClick={() => openModal("vehicle", firm.id as string)}
                >
                  + Mașină în această firmă
                </button>
              )}
            </section>
          );
        })}
      </div>

      {emptyFirms.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Fără perioade în {MONTHS[mo - 1]}:</span>{" "}
          {emptyFirms.map((f, i) => (
            <span key={f.id ?? "none"}>
              {i > 0 && " · "}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                title="Arată firma"
                onClick={() => setExpanded((prev) => [...prev, f.id ?? "none"])}
              >
                {f.name} ({f.vehicles.length})
              </button>
            </span>
          ))}
          <span className="ml-1 text-xs text-slate-400">— apasă pe o firmă ca să o deschizi</span>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-600">
        {hiddenFirms.length > 0 ? (
          <>
            Firme ascunse din Dispecerat ({hiddenFirms.length}):{" "}
            <b className="text-brand-dark">{hiddenFirms.map((f) => f.name).join(", ")}</b>
          </>
        ) : (
          <>Nicio firmă ascunsă din Dispecerat.</>
        )}
        {" · "}
        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => openModal("firms")}>
          Gestionează firme
        </button>
      </div>

      {modal === "vehicle" && (
        <Modal title="Adaugă mașină" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 ${vehMode === "new" ? "bg-white text-brand shadow-sm" : "text-slate-500"}`}
                onClick={() => {
                  setVehMode("new");
                  setModalError(null);
                }}
              >
                Mașină nouă
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 ${vehMode === "existing" ? "bg-white text-brand shadow-sm" : "text-slate-500"}`}
                onClick={() => {
                  setVehMode("existing");
                  setModalError(null);
                }}
              >
                Din Vehicule
              </button>
            </div>

            {vehMode === "new" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Număr de înmatriculare</label>
                <input
                  className={inputCls}
                  value={plate}
                  autoFocus
                  placeholder="ex. SV 99 ABC"
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) submitVehicle();
                  }}
                />
              </div>
            )}

            {vehMode === "existing" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mașina din Vehicule</label>
                <input
                  className={`${inputCls} mb-1.5`}
                  value={pickFilter}
                  autoFocus
                  placeholder="Caută după număr…"
                  onChange={(e) => setPickFilter(e.target.value)}
                />
                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 bg-white">
                  {data.vehicleOptions
                    .filter((o) => o.firmId !== firmId || firmId === "")
                    .filter((o) =>
                      o.plate.replace(/[\s-]/g, "").toUpperCase().includes(pickFilter.replace(/[\s-]/g, "").toUpperCase())
                    )
                    .map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setPickId(o.id)}
                        className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-slate-50 ${
                          pickId === o.id ? "bg-brand/10 font-semibold text-brand-dark" : "text-slate-800"
                        }`}
                      >
                        <span>{o.plate}</span>
                        <span className="truncate text-xs text-slate-400">
                          {o.firmName ? `${o.firmName}${o.firmHidden ? " (ascunsă)" : ""}` : "fără firmă"}
                        </span>
                      </button>
                    ))}
                  {data.vehicleOptions.filter((o) => o.firmId !== firmId || firmId === "").length === 0 && (
                    <p className="px-2.5 py-3 text-sm text-slate-500">Nu există alte mașini.</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Firma (clientul)</label>
              <select
                className={inputCls}
                value={firmId}
                onChange={(e) => {
                  setFirmId(e.target.value);
                  setPickId("");
                }}
              >
                <option value="">{vehMode === "new" ? "Fără firmă" : "Alege firma…"}</option>
                {data.allFirms
                  .filter((f) => !f.hidden)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
              {vehMode === "new" ? (
                <p className="mt-1 text-xs text-slate-500">Mașina apare și în Flotă și Planificare. Restul datelor le completezi acolo.</p>
              ) : (
                (() => {
                  const sel = data.vehicleOptions.find((o) => o.id === pickId);
                  return sel && sel.firmId && sel.firmId !== firmId ? (
                    <p className="mt-1 text-xs text-amber-700">
                      {sel.plate} e acum la firma {sel.firmName}. Va fi mutată la firma aleasă și în Flotă și Planificare.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Firma mașinii se setează și în Flotă și Planificare.</p>
                  );
                })()
              )}
            </div>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</div>}
            <div className="flex gap-2">
              {vehMode === "new" ? (
                <button type="button" className={btnPrimary} disabled={busy || plate.trim() === ""} onClick={submitVehicle}>
                  Adaugă mașina
                </button>
              ) : (
                <button type="button" className={btnPrimary} disabled={busy || !pickId || !firmId} onClick={submitExisting}>
                  Pune la firmă
                </button>
              )}
              <button type="button" className={btnGhost} disabled={busy} onClick={() => setModal(null)}>
                Anulează
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "client" && (
        <Modal title="Client nou" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nume firmă</label>
              <input
                className={inputCls}
                value={clientName}
                autoFocus
                placeholder="ex. TRANSPORT EXPRES SRL"
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) submitClient();
                }}
              />
            </div>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</div>}
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy || clientName.trim() === ""} onClick={submitClient}>
                Adaugă clientul
              </button>
              <button type="button" className={btnGhost} disabled={busy} onClick={() => setModal(null)}>
                Anulează
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "firms" && (
        <Modal title="Firme în Dispecerat" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Debifează firmele care nu sunt dispecerat (ex. mașinile tale). Ele dispar doar din această pagină; mașinile
            rămân în Flotă, Planificare și Tacho.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.allFirms.length === 0 && <p className="text-sm text-slate-500">Nu există firme.</p>}
            {data.allFirms.map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!f.hidden}
                    disabled={busy}
                    onChange={(e) => toggleFirm(f.id, !e.target.checked)}
                  />
                  <span className={f.hidden ? "text-slate-400" : "font-medium text-slate-900"}>{f.name}</span>
                </span>
                <span className="text-xs text-slate-400">{f.vehicleCount} mașini</span>
              </label>
            ))}
          </div>
          {modalError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</div>}
          <div className="mt-4">
            <button type="button" className={btnPrimary} onClick={() => setModal(null)}>
              Gata
            </button>
          </div>
        </Modal>
      )}

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
