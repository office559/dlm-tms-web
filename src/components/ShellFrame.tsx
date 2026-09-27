"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactElement } from "react";
import { signOut } from "@/lib/auth-client";

export type NavItem = { key: string; href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Casă — Dashboard. */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

/** Traseu/rută — Curse. */
function CurseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h7a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3H9a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3h1" />
    </svg>
  );
}

/** Calendar — Planificare. */
function PlanningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

/** Persoană — Șoferi. */
function DriversIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}

/** Camion — Vehicule. */
function VehiclesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 17h1a1 1 0 0 0 1-1v-2.5a1 1 0 0 0-.29-.7l-2.5-2.5a1 1 0 0 0-.71-.3H10" />
      <path d="M3 6h9v10H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

/** Remorcă pe roți — Remorci. */
function TrailersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="9" rx="1" />
      <path d="M3 10h18" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

/** Clădire — Clienți. */
function CustomersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}

/** Grafic cu bare — Rapoarte & Profituri. */
function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  );
}

/** Servietă — Brokeraj. */
function BrokerageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

/** Pompă de combustibil — Cheltuieli flotă. */
function CostsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M4 21h10" />
      <path d="M14 10h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-2-2" />
      <path d="M7 6h4" />
    </svg>
  );
}

/** Card — Plăți. */
function PaymentsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

/** Clopoțel — Alerte documente. */
function AlertsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** Dispecer cu headset — Gestionează dispecerii. */
function DispatchersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.5a3 3 0 0 1 0 6" />
      <path d="M15 20c.3-2.6 1.7-4.6 4-5.5" />
    </svg>
  );
}

/** Ușă cu săgeată — Deconectare. */
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/** Rotiță — Setări. */
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.97 7.97 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.9 3h-4l-.4 2.9a8 8 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.97 7.97 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a8 8 0 0 0 1.7 1L11 21h4l.4-2.9a8 8 0 0 0 1.7-1l2.5 1 2-3.4Z" />
    </svg>
  );
}

/** Fiecare iconiță de mai sus, după cheia (key) itemului de meniu din AppShell.tsx. */
const NAV_ICONS: Record<string, () => ReactElement> = {
  dashboard: DashboardIcon,
  jobs: CurseIcon,
  planning: PlanningIcon,
  drivers: DriversIcon,
  vehicles: VehiclesIcon,
  trailers: TrailersIcon,
  customers: CustomersIcon,
  reports: ReportsIcon,
  brokerage: BrokerageIcon,
  costs: CostsIcon,
  payments: PaymentsIcon,
  alerts: AlertsIcon,
  dispatchers: DispatchersIcon,
  settings: SettingsIcon,
};

function NavIcon({ navKey }: { navKey: string }) {
  const Icon = NAV_ICONS[navKey];
  if (!Icon) return null;
  return <Icon />;
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
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 h-full w-60 bg-[var(--sidebar-bg,#ffffff)] border-r border-slate-200 flex flex-col transition-transform duration-200 ${
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
                    <NavIcon navKey={item.key} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-2.5 py-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <LogoutIcon />
            <span>{loggingOut ? "Se deconectează..." : "Deconectare"}</span>
          </button>
        </div>
        <div className="px-3.5 py-2 border-t border-slate-200 text-[11px] text-slate-400">
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
