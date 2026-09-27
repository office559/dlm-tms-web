import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getDashboardTotals,
  getMonthlyTrend,
  getTopDriversThisMonth,
  getDailyProgram,
} from "@/lib/dashboard";
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

/**
 * O căsuță de informare (KPI) de sus de pe Dashboard.
 */
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ?? "text-brand-dark"}`}>{value}</p>
    </div>
  );
}

type Series = { label: string; value: number };

/**
 * Mini grafic cu bare pentru comparația lunilor precedente cu luna curentă.
 * Ultima bară (luna curentă) e evidențiată cu altă culoare.
 */
function MonthlyBarChart({
  title,
  series,
  color,
  fmt,
}: {
  title: string;
  series: Series[];
  color: string;
  fmt: (n: number) => string;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const lastIdx = series.length - 1;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">{title}</h3>
      <div className="flex items-end gap-3 h-40">
        {series.map((s, i) => {
          const heightPct = Math.max(2, Math.round((s.value / max) * 100));
          const isCurrent = i === lastIdx;
          return (
            <div key={s.label + i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[11px] text-slate-400">{fmt(s.value)}</span>
              <div className="w-full rounded-t-md bg-slate-100 flex items-end" style={{ height: "100%" }}>
                <div
                  className={`w-full rounded-t-md ${isCurrent ? color : "bg-slate-300"}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={`text-xs ${isCurrent ? "font-semibold text-brand-dark" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [totals, trend, topDrivers, dailyProgram] = await Promise.all([
    getDashboardTotals(),
    getMonthlyTrend(6),
    getTopDriversThisMonth(5),
    getDailyProgram(),
  ]);

  return (
    <AppShell active="dashboard" crumb="Dashboard">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">DLM DISPATCHER DASHBOARD</h1>

        <DailyProgramCard
          ieri={dailyProgram.ieri}
          azi={dailyProgram.azi}
          maine={dailyProgram.maine}
          todayLabel={todayLabel()}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Venit Total" value={fmtNum(totals.venitTotal, 2)} accent="text-emerald-700" />
          <StatCard label="Km Total" value={fmtNum(totals.kmTotal)} />
          <StatCard label="Curse finalizate" value={fmtNum(totals.curseFinalizate)} />
          <StatCard label="Media pe KM" value={fmtNum(totals.mediaPeKm, 2)} accent="text-brand-dark" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MonthlyBarChart
            title="Venit pe lună"
            series={trend.map((t) => ({ label: t.label, value: t.venit }))}
            color="bg-emerald-500"
            fmt={(n) => fmtNum(n, 0)}
          />
          <MonthlyBarChart
            title="Km pe lună"
            series={trend.map((t) => ({ label: t.label, value: t.km }))}
            color="bg-brand"
            fmt={(n) => fmtNum(n, 0)}
          />
          <MonthlyBarChart
            title="Nr. curse pe lună"
            series={trend.map((t) => ({ label: t.label, value: t.curse }))}
            color="bg-amber-500"
            fmt={(n) => fmtNum(n, 0)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-medium text-brand-dark">Top Șoferi — luna curentă</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Șofer</th>
                <th className="px-4 py-2">Km</th>
                <th className="px-4 py-2">Venit</th>
                <th className="px-4 py-2">Nr. curse</th>
              </tr>
            </thead>
            <tbody>
              {topDrivers.map((d, i) => (
                <tr key={d.name} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2">{fmtNum(d.km)}</td>
                  <td className="px-4 py-2 text-emerald-700 font-medium">{fmtNum(d.venit, 2)}</td>
                  <td className="px-4 py-2">{d.curse}</td>
                </tr>
              ))}
              {topDrivers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nicio cursă finalizată luna aceasta încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
