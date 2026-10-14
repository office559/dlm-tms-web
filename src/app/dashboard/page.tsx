import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getPeriodStats,
  getJobSituation,
  getJobsTrend,
  getExpiringDocs,
  getRecentJobs,
  getDailyProgram,
} from "@/lib/dashboard";
import type { TrendDay } from "@/lib/dashboard";
import { listVehicles } from "@/lib/vehicles";
import { fleetState, currentJobsByVehicle } from "@/lib/fleet";
import { FLEET_STATE_LABELS } from "@/lib/fleet-labels";
import type { FleetState } from "@/lib/fleet-labels";
import { AppShell } from "@/components/AppShell";
import { DailyProgramCard } from "@/components/DailyProgramCard";

function fmtNum(n: number, digits = 0) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const DAY_NAMES = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
const MONTH_NAMES = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

function todayLabel() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · Azi`;
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** „Azi 13:12" / „Ieri 11:25" / „12.10.2026 09:00". */
function fmtWhen(value: Date | string) {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(date);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  const time = date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Azi ${time}`;
  if (diff === 1) return `Ieri ${time}`;
  return `${date.toLocaleDateString("ro-RO")} ${time}`;
}

function fmtDayLabel(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].toLowerCase()}`;
}

/* ---------------------------- Componente ---------------------------- */

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
      <span
        className={`rounded-md px-1.5 py-0.5 font-semibold ${
          up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}
      >
        {up ? "↑" : "↓"} {fmtNum(Math.abs(value), 1)}%
      </span>
      vs. perioada anterioară
    </p>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-brand-dark">{value}</p>
      <Delta value={delta} />
    </div>
  );
}

type Segment = { label: string; value: number; color: string };

function Donut({
  segments,
  centerValue,
  centerSub,
}: {
  segments: Segment[];
  centerValue: string;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-brand-dark leading-none">{centerValue}</span>
        <span className="mt-1 text-[11px] text-slate-400">{centerSub}</span>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: TrendDay[] }) {
  const W = 1000;
  const H = 200;
  const rawMax = Math.max(4, ...data.flatMap((d) => [d.curse, d.anulate]));
  const niceMax = Math.ceil(rawMax / 4) * 4;
  const x = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * W : W / 2);
  const y = (v: number) => H - (v / niceMax) * H;
  const path = (key: "curse" | "anulate") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`)
      .join(" ");

  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(niceMax * f));
  const labelCount = Math.min(6, data.length);
  const labelIdx =
    labelCount > 1
      ? Array.from({ length: labelCount }, (_, k) =>
          Math.round((k * (data.length - 1)) / (labelCount - 1))
        )
      : [0];

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-52 flex-col justify-between text-[11px] text-slate-400">
          {ticks.map((t, i) => (
            <span key={i} className="leading-none">
              {t}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-52 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={H * f}
              y2={H * f}
              stroke="#e2e8f0"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={path("curse")}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path("anulate")}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="ml-6 mt-2 flex justify-between text-[11px] text-slate-400">
        {labelIdx.map((i) => (
          <span key={i}>{data[i] ? fmtDayLabel(data[i].day) : ""}</span>
        ))}
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === "finalizat") {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Finalizată</span>;
  }
  if (status === "anulat") {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Anulată</span>;
  }
  if (status === "activ") {
    return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">În tranzit</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Planificată</span>;
}

/* ------------------------------ Pagina ------------------------------ */

const FLEET_ORDER = ["disponibil", "alocat", "tranzit", "pauza", "indisponibil", "stationare"];
const FLEET_COLORS: Record<string, string> = {
  disponibil: "#10b981",
  alocat: "#8b5cf6",
  tranzit: "#3b82f6",
  pauza: "#f59e0b",
  indisponibil: "#ef4444",
  stationare: "#94a3b8",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [stats, situation, trend, docs, recent, dailyProgram, vehicles] = await Promise.all([
    getPeriodStats(30),
    getJobSituation(),
    getJobsTrend(30),
    getExpiringDocs(30),
    getRecentJobs(5),
    getDailyProgram(),
    listVehicles(),
  ]);

  // Status flotă: aceeași logică de stare ca în Planificare.
  const activeVehicles = vehicles.filter((v) => v.active);
  const jobsByVehicle = await currentJobsByVehicle(activeVehicles.map((v) => v.id));
  const stateCounts: Record<string, number> = {};
  for (const v of activeVehicles) {
    const st = fleetState(v, jobsByVehicle.get(v.id) ?? null);
    stateCounts[st] = (stateCounts[st] ?? 0) + 1;
  }
  const segments: Segment[] = FLEET_ORDER.map((k) => ({
    label: FLEET_STATE_LABELS[k as FleetState] ?? k,
    value: stateCounts[k] ?? 0,
    color: FLEET_COLORS[k] ?? "#94a3b8",
  }));
  const totalFleet = activeVehicles.length;
  const availableCount = stateCounts["disponibil"] ?? 0;
  const availability = totalFleet > 0 ? Math.round((availableCount / totalFleet) * 100) : 0;

  const rate = stats.km > 0 ? stats.venit / stats.km : 0;
  const ratePrev = stats.kmPrev > 0 ? stats.venitPrev / stats.kmPrev : 0;
  const activeJobs = situation.tranzit + situation.planificate;

  return (
    <AppShell active="dashboard" crumb="Dashboard" wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">DLM DISPATCHER DASHBOARD</h1>
          <p className="mt-1 text-sm text-slate-500">Performanță — ultimele 30 de zile · {todayLabel()}</p>
        </div>

        {/* Cifre principale */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Venit total"
            value={`€${fmtNum(stats.venit)}`}
            delta={pctChange(stats.venit, stats.venitPrev)}
          />
          <KpiCard
            label="Km parcurși"
            value={`${fmtNum(stats.km)} km`}
            delta={pctChange(stats.km, stats.kmPrev)}
          />
          <KpiCard
            label="Curse finalizate"
            value={fmtNum(stats.curse)}
            delta={pctChange(stats.curse, stats.cursePrev)}
          />
          <KpiCard
            label="Rata medie"
            value={`€${fmtNum(rate, 2)}/km`}
            delta={pctChange(rate, ratePrev)}
          />
        </div>

        {/* Status flotă / Situație curse / Atenție necesară */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium text-slate-500">Status flotă</h2>
            <div className="mt-4 flex items-center gap-5">
              <Donut
                segments={segments}
                centerValue={String(availableCount)}
                centerSub={`/${totalFleet}`}
              />
              <ul className="flex-1 space-y-1.5 text-sm">
                {segments.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-semibold text-slate-800">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-500">Disponibilitate</span>
              <span className="font-semibold text-amber-600">{availability}%</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-500">Situație curse</h2>
              <a href="/jobs" className="text-xs text-brand hover:text-brand-dark">
                Vezi toate
              </a>
            </div>
            <div className="mt-4 rounded-xl bg-blue-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Curse active</span>
                <span className="text-2xl font-semibold text-blue-700">{activeJobs}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> În tranzit
                </span>
                <span className="font-semibold text-blue-700">{situation.tranzit}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Planificate (viitor)
                </span>
                <span className="font-semibold text-orange-600">{situation.planificate}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-xl font-semibold text-emerald-700">{situation.createAzi}</p>
                <p className="text-xs text-slate-500">Create azi</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-xl font-semibold text-red-600">{situation.anulateAzi}</p>
                <p className="text-xs text-slate-500">Anulate azi</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-center">
                <p className="text-xl font-semibold text-slate-800">{situation.curse30}</p>
                <p className="text-xs text-slate-500">Curse 30 zile</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-xl font-semibold text-red-600">{situation.anulate30}</p>
                <p className="text-xs text-slate-500">Anulate 30 zile</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium text-slate-500">Atenție necesară</h2>
            <p className="text-xs text-slate-400">Expirate sau expiră în 30 de zile</p>
            {docs.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  ✓
                </div>
                <p className="text-sm font-medium text-slate-700">Totul este în regulă</p>
                <p className="text-xs text-slate-400">
                  Niciun document expirat sau care expiră curând
                </p>
              </div>
            ) : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {docs.map((d, i) => {
                  const expired = d.daysLeft < 0;
                  return (
                    <li
                      key={`${d.plate}-${d.doc}-${i}`}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        expired ? "bg-red-50" : "bg-amber-50"
                      }`}
                    >
                      <span className="font-medium text-slate-800">
                        {d.plate} <span className="font-normal text-slate-500">· {d.doc}</span>
                      </span>
                      <span className={`text-xs font-semibold ${expired ? "text-red-700" : "text-amber-700"}`}>
                        {expired
                          ? `expirat de ${Math.abs(d.daysLeft)} zile`
                          : d.daysLeft === 0
                            ? "expiră azi"
                            : `în ${d.daysLeft} zile`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Grafic tendințe */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-medium text-brand-dark">Tendințe curse (30 zile)</h2>
              <p className="text-xs text-slate-400">Curse create și anulate pe ultimele 30 de zile</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Curse: {situation.curse30}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Anulate: {situation.anulate30}
              </span>
            </div>
          </div>
          <TrendChart data={trend} />
        </div>

        {/* Curse recente */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-medium text-brand-dark">Curse recente</h2>
              <p className="text-xs text-slate-400">Ultimele 5 curse</p>
            </div>
            <a href="/jobs" className="text-xs text-brand hover:text-brand-dark">
              Vezi toate
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2">VRID</th>
                  <th className="px-4 py-2">Rută</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Șofer</th>
                  <th className="px-4 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((j) => (
                  <tr key={j.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono font-semibold">
                      <a href={`/jobs/${j.id}`} className="text-brand hover:text-brand-dark">
                        {j.ref || j.id}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {j.loadPlace || "—"} → {j.unloadPlace || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td className="px-4 py-2 text-slate-600">{j.driverName || "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{fmtWhen(j.when)}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      Nicio cursă încă.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Programul zilei (păstrat din versiunea veche) */}
        <DailyProgramCard
          ieri={dailyProgram.ieri}
          azi={dailyProgram.azi}
          maine={dailyProgram.maine}
          todayLabel={todayLabel()}
        />
      </div>
    </AppShell>
  );
}
