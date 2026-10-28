"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactElement } from "react";
import { signOut } from "@/lib/auth-client";
import { DEFAULT_TIMEZONE, TIMEZONES, zonedParts } from "@/lib/tz";
import { TimezoneProvider } from "@/components/TimezoneProvider";
import { TmsLogo, TmsMark } from "@/components/TmsLogo";

export type NavItem = { key: string; href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

const COLLAPSE_KEY = "dlm-sidebar-collapsed";

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

/** Două clădiri — Firme. */
function CompaniesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17" />
      <path d="M14 9h4a1 1 0 0 1 1 1v11" />
      <path d="M8 7h3M8 11h3M8 15h3" />
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

/** Volan — Pontaj tahograf. */
function TachoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 14.5V21M9.6 11.2 3.3 9.5M14.4 11.2l6.3-1.7" />
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

/** Semn de interzis — Restricții circulație. */
function RestrictionsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

/** Clădiri cu săgeată — Firme clienți (panoul de platformă). */
function PlatformIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17.5h7M18 14l3 3.5-3 3.5" />
    </svg>
  );
}

/** Clipboard cu bifă — Dispecerat (pontaj vehicule). */
function DispecerateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

/** Săgeată stânga/dreapta — butonul de strâns/extins meniul. */
function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  );
}

/** Fiecare iconiță de mai sus, după cheia (key) itemului de meniu din AppShell.tsx. */
const NAV_ICONS: Record<string, () => ReactElement> = {
  dashboard: DashboardIcon,
  jobs: CurseIcon,
  planning: PlanningIcon,
  dispecerat: DispecerateIcon,
  drivers: DriversIcon,
  vehicles: VehiclesIcon,
  trailers: TrailersIcon,
  companies: CompaniesIcon,
  customers: CustomersIcon,
  reports: ReportsIcon,
  tacho: TachoIcon,
  brokerage: BrokerageIcon,
  costs: CostsIcon,
  payments: PaymentsIcon,
  alerts: AlertsIcon,
  dispatchers: DispatchersIcon,
  settings: SettingsIcon,
  restrictions: RestrictionsIcon,
  platform: PlatformIcon,
};

function NavIcon({ navKey }: { navKey: string }) {
  const Icon = NAV_ICONS[navKey];
  if (!Icon) return null;
  return <Icon />;
}

/** Ceasul din bara de sus, în fusul orar ales. */
function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const p = zonedParts(now, timezone);

  return (
    <span className="hidden lg:inline text-xs font-mono text-slate-500 whitespace-nowrap">
      {pad(p.hour)}:{pad(p.minute)}:{pad(p.second)} · {p.day} {MONTHS[p.month - 1]} {p.year}
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
  timezone,
  wide,
  orgName,
  showOrgPill,
  children,
}: {
  navGroups: NavGroup[];
  activeKey: string;
  crumb: string;
  userInitials: string;
  userName: string;
  alertCount: number;
  timezone?: string;
  wide?: boolean;
  /** Firma în care lucrează utilizatorul acum (se arată doar proprietarului platformei). */
  orgName?: string;
  showOrgPill?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tz, setTz] = useState(timezone ?? DEFAULT_TIMEZONE);
  const [tzSaving, setTzSaving] = useState(false);
  const [tzError, setTzError] = useState(false);
  const router = useRouter();

  // Fusul orar venit de pe server (după salvare / reîmprospătare).
  useEffect(() => {
    setTz(timezone ?? DEFAULT_TIMEZONE);
  }, [timezone]);

  // Meniul strâns/extins se păstrează în browser.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // ignorăm
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignorăm
      }
      return next;
    });
  }

  async function changeTimezone(next: string) {
    const prev = tz;
    setTz(next);
    setTzSaving(true);
    setTzError(false);
    try {
      const res = await fetch("/api/preferences/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) throw new Error("save failed");
      router.refresh();
    } catch {
      setTz(prev);
      setTzError(true);
    } finally {
      setTzSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  // Etichetele se ascund doar pe ecran mare (md+), când meniul e strâns.
  const hideWhenCollapsed = collapsed ? "md:hidden" : "";

  return (
    <TimezoneProvider value={tz}>
      <div className="h-screen flex overflow-hidden bg-slate-100">
        {open && (
          <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setOpen(false)} />
        )}

        <aside
          className={`fixed md:relative md:static inset-y-0 left-0 z-30 h-full w-60 ${
            collapsed ? "md:w-[68px]" : "md:w-60"
          } bg-[var(--sidebar-bg,#ffffff)] border-r border-slate-200 flex flex-col transition-[transform,width] duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
        >
          {/* Linia de pe marginea meniului: apasă ca să strângi / extinzi meniul. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            className="hidden md:block absolute top-0 -right-[3px] z-40 h-full w-[6px] cursor-pointer bg-transparent transition hover:bg-sky-400/60"
          />
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            className="hidden md:grid absolute top-1/2 -right-3 z-40 h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-sky-400 hover:text-sky-600"
          >
            <CollapseChevron collapsed={collapsed} />
          </button>

          <div className="p-3.5 pb-2">
            <div className={`tms-logo-box bg-white border border-slate-200 rounded-lg px-4 py-2.5 ${hideWhenCollapsed}`}>
              <TmsLogo />
            </div>
            {collapsed && (
              <div className="tms-logo-box hidden md:grid h-10 w-full place-items-center rounded-lg border border-slate-200 bg-white">
                <TmsMark />
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5">
            {navGroups.map((g) => (
              <div key={g.title}>
                <h4
                  className={`mt-3.5 mb-1 px-2 text-[10.5px] tracking-wider uppercase text-slate-500 font-bold ${hideWhenCollapsed}`}
                >
                  {g.title}
                </h4>
                {collapsed && <div className="hidden md:block mt-2.5 mb-1.5 mx-2 border-t border-slate-200" />}
                {g.items.map((item) => {
                  const on = activeKey === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 mb-0.5 rounded-lg text-sm border-l-[3px] transition ${
                        collapsed ? "md:justify-center md:px-0 md:gap-0" : ""
                      } ${
                        on
                          ? "bg-orange-50 text-brand-dark border-orange-500 font-bold"
                          : "text-slate-800 border-transparent font-semibold hover:bg-white/60 hover:text-slate-900"
                      }`}
                    >
                      <NavIcon navKey={item.key} />
                      <span className={hideWhenCollapsed}>{item.label}</span>
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
              title={collapsed ? "Deconectare" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${
                collapsed ? "md:justify-center md:px-0 md:gap-0" : ""
              }`}
            >
              <LogoutIcon />
              <span className={hideWhenCollapsed}>{loggingOut ? "Se deconectează..." : "Deconectare"}</span>
            </button>
          </div>
          <div className={`px-3.5 py-2 border-t border-slate-200 text-[11px] text-slate-500 ${hideWhenCollapsed}`}>
            TMS
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
              TMS &rsaquo; <b className="text-slate-800">{crumb}</b>
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
            {showOrgPill && orgName && (
              <Link
                href="/platform"
                title="Schimbă firma în care lucrezi"
                className="hidden sm:inline-flex max-w-[260px] items-center gap-1 truncate rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-brand hover:border-brand transition whitespace-nowrap"
              >
                Lucrezi în: {orgName} ▾
              </Link>
            )}
            {tzError && (
              <span className="hidden md:inline text-xs text-red-600 whitespace-nowrap">
                Nu s-a salvat
              </span>
            )}
            <select
              value={tz}
              onChange={(e) => changeTimezone(e.target.value)}
              disabled={tzSaving}
              title="Fus orar (se păstrează pe contul tău)"
              aria-label="Fus orar"
              className="hidden md:block max-w-[170px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand disabled:opacity-50"
            >
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <LiveClock timezone={tz} />
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
    </TimezoneProvider>
  );
}
