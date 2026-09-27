"use client";

import { useState } from "react";
import type { DayJob } from "@/lib/dashboard";

const STATUS_LABELS: Record<string, string> = {
  planificare: "Planificare",
  activ: "Activ",
  finalizat: "Finalizat",
  anulat: "Anulat",
};

const STATUS_STYLES: Record<string, string> = {
  planificare: "text-slate-600 bg-slate-100",
  activ: "text-blue-700 bg-blue-50",
  finalizat: "text-green-700 bg-green-50",
  anulat: "text-red-700 bg-red-50",
};

function JobRow({ job }: { job: DayJob }) {
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="w-12 shrink-0 text-sm font-semibold text-brand">{job.timeLabel}</span>
        <div>
          <p className="text-sm font-semibold text-brand-dark">{job.clientName}</p>
          <p className="text-xs text-slate-400">
            {job.loadPlace || "—"} → {job.unloadPlace || "—"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[60px] sm:pl-0">
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 whitespace-nowrap">
          {job.driverName || "— fără șofer"}
        </span>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 whitespace-nowrap">
          {job.vehiclePlate || "—"}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
            STATUS_STYLES[job.status] ?? "text-slate-600 bg-slate-100"
          }`}
        >
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
      </div>
    </div>
  );
}

type TabKey = "ieri" | "azi" | "maine";

/**
 * Rubrica „Program" de pe Dashboard: arată automat cursele programate
 * ieri / azi / mâine (după ora de start), cu tab-uri comutabile fără a
 * părăsi pagina — datele pentru toate cele 3 zile vin deja încărcate de pe
 * server, doar comutarea între ele e client-side.
 */
export function DailyProgramCard({
  ieri,
  azi,
  maine,
  todayLabel,
}: {
  ieri: DayJob[];
  azi: DayJob[];
  maine: DayJob[];
  todayLabel: string;
}) {
  const [tab, setTab] = useState<TabKey>("azi");
  const data: Record<TabKey, DayJob[]> = { ieri, azi, maine };
  const jobs = data[tab];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "ieri", label: "Ieri", count: ieri.length },
    { key: "azi", label: "Azi", count: azi.length },
    { key: "maine", label: "Mâine", count: maine.length },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="font-medium text-brand-dark">Program</h2>
          <p className="text-xs text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <a href="/planning" className="text-sm text-brand hover:text-brand-dark shrink-0">
          Deschide planning →
        </a>
      </div>

      <div className="flex gap-2 px-6 py-3">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-between rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 text-slate-600 hover:border-brand"
              }`}
            >
              <span>{t.label}</span>
              <span>{t.count}</span>
            </button>
          );
        })}
      </div>

      <div>
        {jobs.map((j) => (
          <JobRow key={j.id} job={j} />
        ))}
        {jobs.length === 0 && (
          <p className="px-6 py-6 text-center text-sm text-slate-400">Nicio cursă programată.</p>
        )}
      </div>
    </div>
  );
}
