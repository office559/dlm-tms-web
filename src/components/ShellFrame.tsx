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
  children,
}: {
  navGroups: NavGroup[];
  activeKey: string;
  crumb: string;
  userInitials: string;
  userName: string;
  alertCount: number;
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
          <div className="max-w-[1500px] mx-auto p-5 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
