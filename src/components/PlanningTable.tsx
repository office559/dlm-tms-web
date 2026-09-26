"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_ROW_STYLES } from "@/lib/fleet-labels";
import {
  DriverSelect,
  LocationInput,
  PauseBadgeControl,
  ProgramControl,
  StareControl,
} from "@/components/PlanningCells";

export type PlanningRow = {
  vehicleId: string;
  plate: string;
  trailerPlate: string | null;
  trailerType: string | null;
  state: FleetState;
  jobId: string | null;
  jobRef: string | null;
  jobDateLabel: string;
  driverId: string | null;
  programStart: string | null;
  programEnd: string | null;
  programStartAt: string | null;
  programEndAt: string | null;
  pause: boolean;
  restStart: string | null;
  restEnd: string | null;
  restEndAt: string | null;
  location: string | null;
  fallbackLocation: string | null;
  loadPlace: string | null;
  unloadPlace: string | null;
  traseuDateLabel: string;
  loadingPct: number | null;
  waState: "none" | "pending" | "confirmed";
  waRead: boolean;
};

type ColumnKey =
  | "vehicul"
  | "vrid"
  | "data"
  | "stare"
  | "sofer"
  | "program"
  | "pauza"
  | "locatie"
  | "traseu"
  | "loading"
  | "cazuri"
  | "whatsapp";

const DEFAULT_ORDER: ColumnKey[] = [
  "vehicul",
  "vrid",
  "data",
  "stare",
  "sofer",
  "program",
  "pauza",
  "locatie",
  "traseu",
  "loading",
  "cazuri",
  "whatsapp",
];

const STORAGE_KEY = "dlm-planning-column-order-v1";

function loadOrder(): ColumnKey[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is ColumnKey =>
      (DEFAULT_ORDER as string[]).includes(k)
    );
    const missing = DEFAULT_ORDER.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

/** Iconiță simplă de camion, pentru coloana Vehicul. */
function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 17h1a1 1 0 0 0 1-1v-2.5a1 1 0 0 0-.29-.7l-2.5-2.5a1 1 0 0 0-.71-.3H10" />
      <path d="M3 6h9v10H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

/** Săgeată mică (chevron) decorativă, lângă numărul de înmatriculare. */
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Iconiță „ochi", pentru pastilele de traseu (loc încărcare → loc descărcare). */
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Iconiță „mâner de tragere" (⠿), arată că antetul coloanei se poate muta. */
function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="currentColor">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function waBadge(state: "none" | "pending" | "confirmed", read: boolean) {
  if (state === "none") return <span className="text-slate-300 text-xs">—</span>;
  if (state === "confirmed") {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs text-green-700 bg-green-50">Confirmat</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full px-2 py-0.5 text-xs text-amber-700 bg-amber-50">Pending</span>
      {read && <span className="text-slate-400 text-xs">(citit)</span>}
    </span>
  );
}

type ColumnDef = {
  key: ColumnKey;
  label: string;
  cellClassName?: string;
  render: (row: PlanningRow, drivers: { id: string; name: string }[]) => ReactNode;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "vehicul",
    label: "Vehicul",
    render: (r) => (
      <>
        <div className="flex items-center gap-1.5">
          <TruckIcon />
          <span className="font-medium">
            {r.plate}
            {r.trailerPlate ? ` / ${r.trailerPlate}` : ""}
          </span>
          <ChevronIcon />
        </div>
        {r.trailerType && (
          <div className="pl-[22px] text-xs text-slate-400">({r.trailerType})</div>
        )}
      </>
    ),
  },
  {
    key: "vrid",
    label: "VRID",
    cellClassName: "font-mono text-sm font-semibold",
    render: (r) =>
      r.jobId ? (
        <a href={`/jobs/${r.jobId}`} className="text-brand hover:text-brand-dark">
          {r.jobRef || r.jobId}
        </a>
      ) : (
        "—"
      ),
  },
  {
    key: "data",
    label: "Dată",
    cellClassName: "whitespace-nowrap",
    render: (r) => r.jobDateLabel,
  },
  {
    key: "stare",
    label: "Stare",
    render: (r) => <StareControl vehicleId={r.vehicleId} jobId={r.jobId} state={r.state} />,
  },
  {
    key: "sofer",
    label: "Șofer",
    render: (r, drivers) => (
      <DriverSelect vehicleId={r.vehicleId} drivers={drivers} value={r.driverId} />
    ),
  },
  {
    key: "program",
    label: "Program",
    cellClassName: "whitespace-nowrap",
    render: (r) => (
      <ProgramControl
        vehicleId={r.vehicleId}
        programStart={r.programStart}
        programEnd={r.programEnd}
        programStartAt={r.programStartAt}
        programEndAt={r.programEndAt}
      />
    ),
  },
  {
    key: "pauza",
    label: "Pauză",
    render: (r) => (
      <PauseBadgeControl
        vehicleId={r.vehicleId}
        pause={r.pause}
        restStart={r.restStart}
        restEnd={r.restEnd}
        restEndAt={r.restEndAt}
      />
    ),
  },
  {
    key: "locatie",
    label: "Locație",
    render: (r) => (
      <LocationInput vehicleId={r.vehicleId} value={r.location} fallback={r.fallbackLocation} />
    ),
  },
  {
    key: "traseu",
    label: "ÎNC - DSC",
    cellClassName: "min-w-[180px]",
    render: (r) =>
      r.jobId ? (
        <>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <EyeIcon />
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
              {r.loadPlace || "—"}
            </span>
            <span className="text-slate-400">→</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
              {r.unloadPlace || "—"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">{r.traseuDateLabel}</div>
        </>
      ) : (
        <span className="text-slate-300 text-xs">—</span>
      ),
  },
  {
    key: "loading",
    label: "Loading",
    render: (r) =>
      r.loadingPct === null ? (
        <span className="text-slate-300 text-xs">—</span>
      ) : (
        <div className="w-16">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${r.loadingPct}%` }} />
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{r.loadingPct}%</div>
        </div>
      ),
  },
  {
    key: "cazuri",
    label: "Cazuri",
    render: () => (
      <span className="text-slate-300 text-xs" title="În curând">
        —
      </span>
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    render: (r) => waBadge(r.waState, r.waRead),
  },
];

const COLUMN_MAP: Record<ColumnKey, ColumnDef> = COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = col;
    return acc;
  },
  {} as Record<ColumnKey, ColumnDef>
);

/**
 * Tabelul Planificare: antetul coloanelor se poate reordona prin
 * tragere (drag & drop) — ordinea aleasă se salvează în browser
 * (localStorage), per dispozitiv, ca să rămână așa data viitoare.
 */
export function PlanningTable({
  rows,
  drivers,
  emptyMessage,
}: {
  rows: PlanningRow[];
  drivers: { id: string; name: string }[];
  emptyMessage: string;
}) {
  const [order, setOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  useEffect(() => {
    setOrder(loadOrder());
  }, []);

  function persist(next: ColumnKey[]) {
    setOrder(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ordinea rămâne schimbată doar pentru sesiunea curentă
    }
  }

  function moveColumn(from: ColumnKey, to: ColumnKey) {
    if (from === to) return;
    const next = [...order];
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    persist(next);
  }

  const orderedColumns = order.map((k) => COLUMN_MAP[k]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <p className="text-xs text-slate-400">
          Trage antetul unei coloane (⠿) ca s-o muți în altă parte.
        </p>
        <button
          type="button"
          onClick={() => persist(DEFAULT_ORDER)}
          className="text-xs text-slate-400 hover:text-brand"
        >
          Resetează ordinea
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            {orderedColumns.map((col) => {
              const thClass = `px-4 py-3 whitespace-nowrap select-none cursor-move ${
                dragKey === col.key ? "opacity-40" : ""
              }`;
              return (
                <th
                  key={col.key}
                  draggable
                  onDragStart={() => setDragKey(col.key)}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragKey) moveColumn(dragKey, col.key);
                    setDragKey(null);
                  }}
                  className={thClass}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <DragHandleIcon />
                    {col.label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowClass = `border-t border-slate-100 align-top ${FLEET_ROW_STYLES[r.state]}`;
            return (
              <tr key={r.vehicleId} className={rowClass}>
                {orderedColumns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.cellClassName ?? ""}`}>
                    {col.render(r, drivers)}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={orderedColumns.length} className="px-4 py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
