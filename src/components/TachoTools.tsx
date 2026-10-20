"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Încărcare fișiere DDD                                               */
/* ------------------------------------------------------------------ */

type UploadLine = {
  name: string;
  state: "wait" | "busy" | "ok" | "dup" | "err";
  text: string;
};

function fmtDay(d?: string) {
  return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "";
}

export function TachoUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<UploadLine[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setBusy(true);
    setLines(list.map((f) => ({ name: f.name, state: "wait", text: "în așteptare" })));
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setLines((l) => l.map((x, j) => (j === i ? { ...x, state: "busy", text: "se citește…" } : x)));
      try {
        const res = await fetch("/api/tacho/upload", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(f.name) },
          body: f,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLines((l) => l.map((x, j) => (j === i ? { ...x, state: "err", text: data.error || "eroare" } : x)));
          continue;
        }
        if (data.status === "duplicate") {
          setLines((l) => l.map((x, j) => (j === i ? { ...x, state: "dup", text: "deja încărcat" } : x)));
          continue;
        }
        changed = true;
        const who = data.kind === "card" ? `card ${data.holder ?? ""}` : `camion ${data.plate ?? ""}`;
        const drivers = data.kind === "vu" && data.drivers?.length ? ` · șoferi: ${data.drivers.join(", ")}` : "";
        const period = data.days ? ` · ${data.days} zile (${fmtDay(data.firstDay)} – ${fmtDay(data.lastDay)})` : " · nicio activitate";
        const warn = data.warnings?.length ? ` · ⚠ ${data.warnings.join(" ")}` : "";
        setLines((l) => l.map((x, j) => (j === i ? { ...x, state: "ok", text: `${who}${period}${drivers}${warn}` } : x)));
      } catch {
        setLines((l) => l.map((x, j) => (j === i ? { ...x, state: "err", text: "conexiune întreruptă" } : x)));
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (changed) router.refresh();
  }

  const color: Record<UploadLine["state"], string> = {
    wait: "text-slate-400",
    busy: "text-blue-600",
    ok: "text-emerald-700",
    dup: "text-amber-700",
    err: "text-red-600",
  };
  const icon: Record<UploadLine["state"], string> = { wait: "•", busy: "⏳", ok: "✔", dup: "↺", err: "✖" };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 print:hidden"
      >
        ⬆ Încarcă fișiere DDD
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-brand-dark">Încarcă fișiere de tahograf</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fișiere de camion (<b>M_…DDD</b>) și de card de șofer (<b>C_…DDD</b>). Poți alege mai multe deodată.
                  Cardul șoferului dă pontajul complet (toate camioanele); fișierul de camion arată doar ce s-a lucrat pe acel camion.
                </p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>

            <label
              className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) upload(e.dataTransfer.files);
              }}
            >
              <span className="text-3xl">📂</span>
              <span className="mt-2 font-semibold text-slate-800">Trage fișierele aici sau apasă pentru a le alege</span>
              <span className="mt-1 text-xs text-slate-500">.DDD, .ESM, .TGD, .C1B, .V1B</span>
              <input
                ref={input}
                type="file"
                multiple
                accept=".ddd,.DDD,.esm,.ESM,.tgd,.TGD,.c1b,.C1B,.v1b,.V1B"
                className="hidden"
                disabled={busy}
                onChange={(e) => upload(e.target.files)}
              />
            </label>

            {lines.length > 0 && (
              <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto text-sm">
                {lines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`w-4 shrink-0 ${color[l.state]}`}>{icon[l.state]}</span>
                    <span className="min-w-0">
                      <b className="text-slate-800">{l.name}</b> <span className={color[l.state]}>— {l.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? "Se încarcă…" : "Închide"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Setări pe firmă (doar admin)                                        */
/* ------------------------------------------------------------------ */

export type TachoFirmRow = {
  id: string;
  name: string;
  tacho_enabled: boolean;
  diurna_abroad: number;
  diurna_ro: number;
  diurna_currency: string;
};

function FirmRow({ firm }: { firm: TachoFirmRow }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(firm.tacho_enabled);
  const [abroad, setAbroad] = useState(String(firm.diurna_abroad ?? 0));
  const [ro, setRo] = useState(String(firm.diurna_ro ?? 0));
  const [currency, setCurrency] = useState(firm.diurna_currency || "EUR");
  const [state, setState] = useState<"" | "busy" | "ok" | "err">("");
  const [msg, setMsg] = useState("");

  async function save(next?: { enabled?: boolean }) {
    setState("busy");
    setMsg("");
    const res = await fetch("/api/tacho/firms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: firm.id, enabled: next?.enabled ?? enabled, abroad, ro, currency }),
    });
    if (res.ok) {
      setState("ok");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setState("err");
      setMsg(d.error || "Nu s-a putut salva.");
    }
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2.5">
        <label className="flex items-center gap-2 font-semibold text-slate-900">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              save({ enabled: e.target.checked });
            }}
          />
          {firm.name}
        </label>
      </td>
      <td className="px-4 py-2.5">
        <input value={abroad} onChange={(e) => setAbroad(e.target.value)} inputMode="decimal" className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right" />
      </td>
      <td className="px-4 py-2.5">
        <input value={ro} onChange={(e) => setRo(e.target.value)} inputMode="decimal" className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right" />
      </td>
      <td className="px-4 py-2.5">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1">
          <option>EUR</option>
          <option>RON</option>
          <option>GBP</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={() => save()}
          disabled={state === "busy"}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Salvează
        </button>
        <span className={`ml-2 text-sm ${state === "err" ? "text-red-600" : "text-emerald-700"}`}>
          {state === "ok" ? "✔ salvat" : state === "busy" ? "…" : msg}
        </span>
      </td>
    </tr>
  );
}

export function TachoFirmSettings({ firms, startOpen }: { firms: TachoFirmRow[]; startOpen?: boolean }) {
  return (
    <details open={startOpen} className="rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
      <summary className="cursor-pointer px-5 py-3 text-base font-semibold text-brand-dark">
        ⚙ Setări pontaj — firme și diurnă
      </summary>
      <div className="border-t border-slate-100 px-5 pb-4 pt-2 text-sm text-slate-600">
        Bifează firmele pentru care se face pontajul. Diurna se dă pe zi: suma „în străinătate" pentru orice zi în care
        șoferul a fost (măcar o parte din zi) în afara României — inclusiv zilele libere petrecute afară — și suma „în
        România" pentru zilele lucrate doar în țară.
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-2">Firmă (bifată = pontaj activ)</th>
            <th className="px-4 py-2">Diurnă străinătate / zi</th>
            <th className="px-4 py-2">Diurnă România / zi</th>
            <th className="px-4 py-2">Moneda</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {firms.map((f) => (
            <FirmRow key={f.id} firm={f} />
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Tipărire / PDF                                                      */
/* ------------------------------------------------------------------ */

export function TachoPrint() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden"
    >
      🖨 PDF
    </button>
  );
}
