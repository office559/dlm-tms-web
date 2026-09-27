
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { AppShell } from "@/components/AppShell";
import {
  fleetState,
  currentJobsByVehicle,
  lastUnloadPlaceByVehicle,
} from "@/lib/fleet";
import { PlanningTable } from "@/components/PlanningTable";
import type { PlanningRow } from "@/components/PlanningTable";

function fmtDate(s: string | Date | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ro-RO");
}

function fmtTime(s: string | Date | null) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listExpiryAlerts } from "@/lib/alerts";
import { ShellFrame, type NavGroup } from "@/components/ShellFrame";

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operațiuni",
    items: [
      { key: "dashboard", href: "/dashboard", label: "Command Center" },
      { key: "jobs", href: "/jobs", label: "Job Center" },
      { key: "planning", href: "/planning", label: "Planificare" },
    ],
  },
  {
    title: "Resurse",
    items: [
      { key: "drivers", href: "/drivers", label: "Șoferi" },
      { key: "vehicles", href: "/vehicles", label: "Vehicule" },
      { key: "trailers", href: "/trailers", label: "Remorci" },
      { key: "customers", href: "/customers", label: "Clienți" },
    ],
  },
  {
    title: "Business",
    items: [
      { key: "reports", href: "/reports", label: "Rapoarte & Profituri" },
      { key: "brokerage", href: "/brokerage", label: "Brokeraj" },
      { key: "costs", href: "/costs", label: "Cheltuieli flotă" },
      { key: "payments", href: "/payments", label: "Plăți" },
      { key: "alerts", href: "/alerts", label: "Alerte documente" },
    ],
  },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

export async function AppShell({
  active,
  crumb,
  wide,
  children,
}: {
  active: string;
  crumb: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userName = session?.user.name || session?.user.email || "Utilizator";
  const isAdmin = session?.user.role === "admin";

  const groups: NavGroup[] = isAdmin
    ? [
        ...NAV_GROUPS,
        {
          title: "Administrare",
          items: [
            { key: "dispatchers", href: "/dispatchers", label: "Gestionează dispecerii" },
            { key: "settings", href: "/settings", label: "Setări" },
          ],
        },
      ]
    : NAV_GROUPS;

  let alertCount = 0;
  try {
    const settings = await getSettings();
    const alerts = await listExpiryAlerts(settings?.alert_days ?? 30);
    alertCount = alerts.length;
  } catch {
    alertCount = 0;
  }

  return (
    <ShellFrame
      navGroups={groups}
      activeKey={active}
      crumb={crumb}
      userInitials={initialsOf(userName)}
      userName={userName}
      alertCount={alertCount}
      wide={wide}
    >
      {children}
    </ShellFrame>
  );
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { AppShell } from "@/components/AppShell";
import {
  fleetState,
  currentJobsByVehicle,
  lastUnloadPlaceByVehicle,
} from "@/lib/fleet";
import { PlanningTable } from "@/components/PlanningTable";
import type { PlanningRow } from "@/components/PlanningTable";

function fmtDate(s: string | Date | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ro-RO");
}

function fmtTime(s: string | Date | null) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

const STATE_ORDER: Record<string, number> = {
  pauza: 0,
  disponibil: 1,
  indisponibil: 2,
  alocat: 3,
  tranzit: 4,
  stationare: 5,
};

const STATE_TABS: { key: string; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "disponibil", label: "Disponibil" },
  { key: "alocat", label: "Viitor" },
  { key: "tranzit", label: "Tranzit" },
  { key: "pauza", label: "Pauză" },
  { key: "indisponibil", label: "Indisponibil" },
  { key: "stationare", label: "Staționare" },
];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const activeFilter =
    params.stare && STATE_TABS.some((t) => t.key === params.stare) ? params.stare : "toate";

  const [vehicles, drivers, trailers] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
  ]);

  const trailerById = new Map(trailers.map((t) => [t.id, t]));
  const vehicleIds = vehicles.map((v) => v.id);
  const [jobsByVehicle, lastUnloadByVehicle] = await Promise.all([
    currentJobsByVehicle(vehicleIds),
    lastUnloadPlaceByVehicle(vehicleIds),
  ]);

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job) }))
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const filteredRows =
    activeFilter === "toate" ? allRows : allRows.filter((r) => r.state === activeFilter);

  const rows: PlanningRow[] = filteredRows.map(({ v, job, state }) => {
    const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;

    let loadingPct: number | null = null;
    if (job && job.status === "activ" && job.start_at && job.end_at) {
      const st = new Date(job.start_at).getTime();
      const en = new Date(job.end_at).getTime();
      const now = Date.now();
      loadingPct =
        en > st ? Math.min(100, Math.max(0, Math.round(((now - st) / (en - st)) * 100))) : 0;
    }

    let waState: "none" | "pending" | "confirmed" = "none";
    let waRead = false;
    if (job?.wa_message_sid) {
      waState = job.wa_confirmed_at ? "confirmed" : "pending";
      waRead = Boolean(job.wa_read_at);
    }

    return {
      vehicleId: v.id,
      plate: v.plate,
      trailerPlate: trailer?.plate ?? null,
      trailerType: trailer?.type ?? null,
      state,
      jobId: job ? job.id : null,
      jobRef: job?.ref ?? null,
      jobDateLabel: job?.start_at ? fmtDate(job.start_at) : "—",
      driverId: v.driver_id,
      programStart: v.program_start,
      programEnd: v.program_end,
      programStartAt: v.program_start_at ? v.program_start_at.toString() : null,
      programEndAt: v.program_end_at ? v.program_end_at.toString() : null,
      pause: v.pause,
      restStart: v.rest_start,
      restEnd: v.rest_end,
      restEndAt: v.rest_end_at ? v.rest_end_at.toString() : null,
      location: v.location,
      fallbackLocation: lastUnloadByVehicle.get(v.id) ?? null,
      loadPlace: job?.load_place ?? null,
      unloadPlace: job?.unload_place ?? null,
      traseuDateLabel: job
        ? `ÎNC ${fmtDate(job.start_at)} ${fmtTime(job.start_at)} · DESC ${fmtDate(job.end_at)} ${fmtTime(job.end_at)}`
        : "",
      loadingPct,
      waState,
      waRead,
    };
  });

  const emptyMessage =
    activeFilter === "toate"
      ? "Niciun vehicul găsit. Adaugă vehicule în secțiunea Vehicule."
      : "Niciun vehicul în această categorie.";

  return (
    <AppShell active="planning" crumb="Planificare" wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Planificare</h1>
          <p className="text-slate-600 mt-1">
            Stare live a flotei — vehicul, șofer, program, pauză, locație și cursa curentă.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((t) => {
            const tabClass = activeFilter === t.key
              ? "rounded-full px-3 py-1.5 text-sm font-medium transition bg-brand text-white"
              : "rounded-full px-3 py-1.5 text-sm font-medium transition bg-white border border-slate-200 text-slate-600 hover:border-brand";
            const tabHref = t.key === "toate" ? "/planning" : `/planning?stare=${t.key}`;
            return (
              <a key={t.key} href={tabHref} className={tabClass}>
                {t.label} ({counts[t.key] ?? 0})
              </a>
            );
          })}
        </div>

        <PlanningTable
          rows={rows}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          emptyMessage={emptyMessage}
        />

        <p className="text-xs text-slate-400">
          Notele de tip „Cazuri" vor fi adăugate într-un pas următor.
        </p>
      </div>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type NavItem = { key: string; href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  return (
    <span className="hidden lg:inline text-xs font-mono text-slate-500 whitespace-nowrap">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())} · {now.getDate()}{" "}
      {MONTHS[now.getMonth()]} {now.getFullYear()}
    </span>
  );
}

export function ShellFrame({
  navGroups,
  activeKey,
  crumb,
  userInitials,
  userName,
  alertCount,
  wide,
  children,
}: {
  navGroups: NavGroup[];
  activeKey: string;
  crumb: string;
  userInitials: string;
  userName: string;
  alertCount: number;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 h-full w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-3.5 pb-2">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DLM" className="w-full h-auto block" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-2.5">
          {navGroups.map((g) => (
            <div key={g.title}>
              <h4 className="mt-3.5 mb-1 px-2 text-[10.5px] tracking-wider uppercase text-slate-400 font-semibold">
                {g.title}
              </h4>
              {g.items.map((item) => {
                const on = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 mb-0.5 rounded-lg text-sm border-l-[3px] transition ${
                      on
                        ? "bg-orange-50 text-brand-dark border-orange-500 font-semibold"
                        : "text-slate-600 border-transparent font-medium hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="px-3.5 py-2.5 border-t border-slate-200 text-[11px] text-slate-400">
          DLM Trans
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 md:px-5 py-2.5 bg-white border-b border-slate-200 flex-none">
          <button
            type="button"
            className="md:hidden rounded-lg border border-slate-300 w-8 h-8 grid place-items-center text-slate-600 flex-none"
            aria-label="Meniu"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
          <div className="text-xs text-slate-500 whitespace-nowrap hidden sm:block">
            DLM &rsaquo; <b className="text-slate-800">{crumb}</b>
          </div>
          <form action="/jobs" method="GET" className="hidden md:block flex-1 max-w-xs">
            <input
              type="text"
              name="q"
              placeholder="Caută curse, șoferi, vehicule..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
          </form>
          <div className="flex-1" />
          <Link
            href="/jobs/new"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-sm font-medium px-3.5 py-1.5 hover:bg-brand-dark transition whitespace-nowrap"
          >
            ✦ Creează cursă
          </Link>
          <LiveClock />
          <Link
            href="/alerts"
            className="relative rounded-lg border border-slate-200 w-8 h-8 grid place-items-center text-slate-500 hover:bg-slate-50 flex-none"
            aria-label="Alerte"
          >
            🔔
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1.5 leading-[15px]">
                {alertCount}
              </span>
            )}
          </Link>
          <div
            className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center text-[11.5px] font-semibold flex-none"
            title={userName}
          >
            {userInitials}
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className={wide ? "px-3 py-5 md:px-4 md:py-6" : "max-w-[1500px] mx-auto p-5 md:p-6"}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

}

const STATE_ORDER: Record<string, number> = {
  pauza: 0,
  disponibil: 1,
  indisponibil: 2,
  alocat: 3,
  tranzit: 4,
  stationare: 5,
};

const STATE_TABS: { key: string; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "disponibil", label: "Disponibil" },
  { key: "alocat", label: "Viitor" },
  { key: "tranzit", label: "Tranzit" },
  { key: "pauza", label: "Pauză" },
  { key: "indisponibil", label: "Indisponibil" },
  { key: "stationare", label: "Staționare" },
];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const activeFilter =
    params.stare && STATE_TABS.some((t) => t.key === params.stare) ? params.stare : "toate";

  const [vehicles, drivers, trailers] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
  ]);

  const trailerById = new Map(trailers.map((t) => [t.id, t]));
  const vehicleIds = vehicles.map((v) => v.id);
  const [jobsByVehicle, lastUnloadByVehicle] = await Promise.all([
    currentJobsByVehicle(vehicleIds),
    lastUnloadPlaceByVehicle(vehicleIds),
  ]);

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job) }))
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const filteredRows =
    activeFilter === "toate" ? allRows : allRows.filter((r) => r.state === activeFilter);

  const rows: PlanningRow[] = filteredRows.map(({ v, job, state }) => {
    const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;

    let loadingPct: number | null = null;
    if (job && job.status === "activ" && job.start_at && job.end_at) {
      const st = new Date(job.start_at).getTime();
      const en = new Date(job.end_at).getTime();
      const now = Date.now();
      loadingPct =
        en > st ? Math.min(100, Math.max(0, Math.round(((now - st) / (en - st)) * 100))) : 0;
    }

    let waState: "none" | "pending" | "confirmed" = "none";
    let waRead = false;
    if (job?.wa_message_sid) {
      waState = job.wa_confirmed_at ? "confirmed" : "pending";
      waRead = Boolean(job.wa_read_at);
    }

    return {
      vehicleId: v.id,
      plate: v.plate,
      trailerPlate: trailer?.plate ?? null,
      trailerType: trailer?.type ?? null,
      state,
      jobId: job ? job.id : null,
      jobRef: job?.ref ?? null,
      jobDateLabel: job?.start_at ? fmtDate(job.start_at) : "—",
      driverId: v.driver_id,
      programStart: v.program_start,
      programEnd: v.program_end,
      programStartAt: v.program_start_at ? v.program_start_at.toString() : null,
      programEndAt: v.program_end_at ? v.program_end_at.toString() : null,
      pause: v.pause,
      restStart: v.rest_start,
      restEnd: v.rest_end,
      restEndAt: v.rest_end_at ? v.rest_end_at.toString() : null,
      location: v.location,
      fallbackLocation: lastUnloadByVehicle.get(v.id) ?? null,
      loadPlace: job?.load_place ?? null,
      unloadPlace: job?.unload_place ?? null,
      traseuDateLabel: job
        ? `ÎNC ${fmtDate(job.start_at)} ${fmtTime(job.start_at)} · DESC ${fmtDate(job.end_at)} ${fmtTime(job.end_at)}`
        : "",
      loadingPct,
      waState,
      waRead,
    };
  });

  const emptyMessage =
    activeFilter === "toate"
      ? "Niciun vehicul găsit. Adaugă vehicule în secțiunea Vehicule."
      : "Niciun vehicul în această categorie.";

  return (
    <AppShell active="planning" crumb="Planificare">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Planificare</h1>
          <p className="text-slate-600 mt-1">
            Stare live a flotei — vehicul, șofer, program, pauză, locație și cursa curentă.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((t) => {
            const tabClass = activeFilter === t.key
              ? "rounded-full px-3 py-1.5 text-sm font-medium transition bg-brand text-white"
              : "rounded-full px-3 py-1.5 text-sm font-medium transition bg-white border border-slate-200 text-slate-600 hover:border-brand";
            const tabHref = t.key === "toate" ? "/planning" : `/planning?stare=${t.key}`;
            return (
              <a key={t.key} href={tabHref} className={tabClass}>
                {t.label} ({counts[t.key] ?? 0})
              </a>
            );
          })}
        </div>

        <PlanningTable
          rows={rows}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          emptyMessage={emptyMessage}
        />

        <p className="text-xs text-slate-400">
          Notele de tip „Cazuri" vor fi adăugate într-un pas următor.
        </p>
      </div>
    </AppShell>
  );
}
