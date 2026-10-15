"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_ROW_STYLES } from "@/lib/fleet-labels";
import {
  CazuriControl,
  DriverSelect,
  LocationControl,
  PauseBadgeControl,
  ProgramControl,
  StareControl,
  WeeklyRestControl,
} from "@/components/PlanningCells";
import { CrewSelect, NoteControl } from "@/components/PlanningExtras";

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
  crewType: string | null;
  note: string | null;
  programStart: string | null;
  programEnd: string | null;
  programStartAt: string | null;
  programEndAt: string | null;
  pause: boolean;
  restStart: string | null;
  restEnd: string | null;
  restStartAt: string | null;
  restEndAt: string | null;
  weeklyRest: boolean;
  weeklyRestType: string | null;
  weeklyRestStart: string | null;
  weeklyRestEnd: string | null;
  weeklyRestStartAt: string | null;
  weeklyRestEndAt: string | null;
  weeklyRestSuggested: "45" | "24";
  location: string | null;
  fallbackLocation: string | null;
  loadPlace: string | null;
  unloadPlace: string | null;
  loadDateLabel: string;
  unloadDateLabel: string;
  waState: "none" | "pending" | "confirmed";
  waRead: boolean;
  cases: string[];
};

type ColumnKey =
  | "vehicul"
  | "vrid"
  | "data"
  | "stare"
  | "sofer"
  | "echipaj"
  | "program"
  | "pauza"
  | "pauzaSapt"
  | "locatie"
  | "traseu"
  | "cazuri"
  | "whatsapp"
  | "notita";

const DEFAULT_ORDER: ColumnKey[] = [
  "vehicul",
  "vrid",
  "data",
  "stare",
  "sofer",
  "echipaj",
  "program",
  "pauza",
  "pauzaSapt",
  "locatie",
  "traseu",
  "cazuri",
  "whatsapp",
  "notita",
];

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  vehicul: 260,
  vrid: 110,
  data: 110,
  stare: 150,
  sofer: 230,
  echipaj: 160,
  program: 210,
  pauza: 200,
  pauzaSapt: 200,
  locatie: 130,
  traseu: 240,
  cazuri: 170,
  whatsapp: 130,
  notita: 240,
};

const MIN_WIDTH = 60;

/** La câte secunde se reîmprospătează automat datele tabelului. */
const AUTO_REFRESH_SECONDS = 10;

const STORAGE_KEY = "dlm-planning-columns-v2";

type StoredState = {
  order: ColumnKey[];
  widths: Partial<Record<ColumnKey, number>>;
};

function loadState(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: DEFAULT_ORDER, widths: {} };
    const parsed = JSON.parse(raw) as { order?: unknown; widths?: unknown };
    const rawOrder = Array.isArray(parsed.order) ? (parsed.order as string[]) : [];
    const valid = rawOrder.filter((k): k is ColumnKey => (DEFAULT_ORDER as string[]).includes(k));
    const missing = DEFAULT_ORDER.filter((k) => !valid.includes(k));
    const order = [...valid, ...missing];

    const widths: Partial<Record<ColumnKey, number>> = {};
    if (parsed.widths && typeof parsed.widths === "object") {
      for (const [k, v] of Object.entries(parsed.widths as Record<string, unknown>)) {
        if ((DEFAULT_ORDER as string[]).includes(k) && typeof v === "number" && v >= MIN_WIDTH) {
          widths[k as ColumnKey] = v;
        }
      }
    }
    return { order, widths };
  } catch {
    return { order: DEFAULT_ORDER, widths: {} };
  }
}

/** "15.10.2026 14:00" → "15.10 · 14:00" (fără an, ca să încapă în coloană). */
function shortDateTime(label: string): string {
  if (!label) return "—";
  return label.replace(/^(\d{2}\.\d{2})\.\d{4}\s+/, "$1 · ");
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

/** Iconiță de resetare (săgeți circulare), pentru butonul „Resetează coloanele". */
function ResetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 21v-6h6" />
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
          <span className="whitespace-nowrap text-sm font-semibold">
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
    render: (r) => <span className="text-sm font-semibold">{r.jobDateLabel}</span>,
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
      <DriverSelect vehicleId={r.vehicleId} drivers={drivers} value={r.driverId} state={r.state} />
    ),
  },
  {
    key: "echipaj",
    label: "Echipaj",
    render: (r) => <CrewSelect vehicleId={r.vehicleId} value={r.crewType} />,
  },
  {
    key: "program",
    label: "Program",
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
        restStartAt={r.restStartAt}
        restEndAt={r.restEndAt}
      />
    ),
  },
  {
    key: "pauzaSapt",
    label: "Pauză Săpt.",
    render: (r) => (
      <WeeklyRestControl
        vehicleId={r.vehicleId}
        weeklyRest={r.weeklyRest}
        weeklyRestType={r.weeklyRestType}
        weeklyRestStart={r.weeklyRestStart}
        weeklyRestEnd={r.weeklyRestEnd}
        weeklyRestStartAt={r.weeklyRestStartAt}
        weeklyRestEndAt={r.weeklyRestEndAt}
        suggestedType={r.weeklyRestSuggested}
      />
    ),
  },
  {
    key: "locatie",
    label: "Locație",
    render: (r) => (
      <LocationControl vehicleId={r.vehicleId} value={r.location} fallback={r.fallbackLocation} />
    ),
  },
  {
    key: "traseu",
    label: "ÎNC - DSC",
    render: (r) =>
      r.jobId ? (
        <div className="relative pl-5 text-[13px] leading-6">
          <span className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-slate-300" />
          <div className="relative whitespace-nowrap">
            <span className="absolute -left-[19px] top-[7px] h-2.5 w-2.5 rounded-full border-2 border-green-600 bg-white" />
            <span className="mr-1.5 font-extrabold text-blue-700">{r.loadPlace || "—"}</span>
            <span className="text-slate-600">{shortDateTime(r.loadDateLabel)}</span>
          </div>
          <div className="relative whitespace-nowrap">
            <span className="absolute -left-[19px] top-[7px] h-2.5 w-2.5 rounded-full border-2 border-red-600 bg-white" />
            <span className="mr-1.5 font-extrabold text-blue-700">{r.unloadPlace || "—"}</span>
            <span className="text-slate-600">{shortDateTime(r.unloadDateLabel)}</span>
          </div>
        </div>
      ) : (
        <a href={"/jobs/new?vehicleId=" + r.vehicleId} title="Creează cursă pentru acest vehicul" className="inline-grid h-6 w-6 place-items-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-brand hover:text-brand transition">+</a>
      ),
  },
  {
    key: "cazuri",
    label: "Cazuri",
    render: (r) => <CazuriControl vehicleId={r.vehicleId} cases={r.cases} />,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    render: (r) => waBadge(r.waState, r.waRead),
  },
  {
    key: "notita",
    label: "Notiță",
    render: (r) => <NoteControl vehicleId={r.vehicleId} value={r.note} />,
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
 * Tabelul Planificare: antetul coloanelor se poate reordona prin tragerea
 * mânerului (⠿), și fiecare coloană se poate lărgi/îngusta trăgând de
 * marginea din dreapta a antetului (▐). Ordinea și lățimile alese se
 * salvează în browser (localStorage), per dispozitiv.
 *
 * Datele se reîmprospătează automat la câteva secunde (router.refresh),
 * ca să apară singure confirmările WhatsApp și celelalte schimbări.
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
  const router = useRouter();
  const [order, setOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
  const [widths, setWidths] = useState<Partial<Record<ColumnKey, number>>>({});
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const [resizingKey, setResizingKey] = useState<ColumnKey | null>(null);
  const widthsRef = useRef<Partial<Record<ColumnKey, number>>>({});

  useEffect(() => {
    const stored = loadState();
    setOrder(stored.order);
    setWidths(stored.widths);
    widthsRef.current = stored.widths;
  }, []);

  // Reîmprospătare automată: doar când fila e vizibilă și nu scrii într-un
  // câmp (text / oră / număr / notiță) dintr-o fereastră de editare deschisă.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      router.refresh();
    };
    const id = setInterval(tick, AUTO_REFRESH_SECONDS * 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [router]);

  function persistOrder(next: ColumnKey[]) {
    setOrder(next);
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order: next, widths: widthsRef.current })
      );
    } catch {
      // ordinea rămâne schimbată doar pentru sesiunea curentă
    }
  }

  function persistWidths(next: Partial<Record<ColumnKey, number>>) {
    widthsRef.current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, widths: next }));
    } catch {
      // lățimile rămân schimbate doar pentru sesiunea curentă
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
    persistOrder(next);
  }

  function startResize(key: ColumnKey, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest("th");
    const startWidth = th ? th.getBoundingClientRect().width : DEFAULT_WIDTHS[key];
    const startX = e.clientX;
    setResizingKey(key);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function onMove(ev: MouseEvent) {
      const next = Math.max(MIN_WIDTH, Math.round(startWidth + (ev.clientX - startX)));
      widthsRef.current = { ...widthsRef.current, [key]: next };
      setWidths(widthsRef.current);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setResizingKey(null);
      persistWidths(widthsRef.current);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resetLayout() {
    persistOrder(DEFAULT_ORDER);
    setWidths({});
    persistWidths({});
  }

  const orderedColumns = order.map((k) => COLUMN_MAP[k]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <div className="flex items-center justify-end px-2 py-1">
        <button
          type="button"
          onClick={resetLayout}
          title="Resetează coloanele"
          aria-label="Resetează coloanele"
          className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand"
        >
          <ResetIcon />
        </button>
      </div>
      <table className="w-full text-sm">
        <colgroup>
          {orderedColumns.map((col, i) => {
            const isLast = i === orderedColumns.length - 1;
            return (
              <col
                key={col.key}
                style={isLast ? undefined : { width: `${widths[col.key] ?? DEFAULT_WIDTHS[col.key]}px` }}
              />
            );
          })}
        </colgroup>
        <thead className="bg-orange-50 text-orange-800 text-left">
          <tr>
            {orderedColumns.map((col) => {
              const thClass = `relative px-4 py-3 whitespace-nowrap select-none ${
                dragKey === col.key ? "opacity-40" : ""
              }`;
              return (
                <th
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragKey) moveColumn(dragKey, col.key);
                    setDragKey(null);
                  }}
                  className={thClass}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      draggable
                      onDragStart={() => setDragKey(col.key)}
                      onDragEnd={() => setDragKey(null)}
                      className="cursor-move"
                      title="Trage ca să muți coloana"
                    >
                      <DragHandleIcon />
                    </span>
                    {col.label}
                  </span>
                  <span
                    onMouseDown={(e) => startResize(col.key, e)}
                    title="Trage ca să lărgești / îngustezi coloana"
                    className={`absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand/30 ${
                      resizingKey === col.key ? "bg-brand/40" : ""
                    }`}
                  />
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
                  <td
                    key={col.key}
                    className={`px-4 py-3 overflow-hidden ${col.cellClassName ?? ""}`}
                  >
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
