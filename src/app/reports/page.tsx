import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getRevenueByCurrency,
  getCostsByCategory,
  getCostsByVehicle,
  getCostsTotal,
  getBrokerageSummary,
  getJobsSummary,
} from "@/lib/reports";
import { AppShell } from "@/components/AppShell";

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const from = params.from || firstOfMonth();
  const to = params.to || today();

  const [revenue, costsByCategory, costsByVehicle, costsTotal, brokerage, jobs] = await Promise.all([
    getRevenueByCurrency(from, to),
    getCostsByCategory(from, to),
    getCostsByVehicle(from, to),
    getCostsTotal(from, to),
    getBrokerageSummary(from, to),
    getJobsSummary(from, to),
  ]);

  return (
    <AppShell active="reports" crumb="Rapoarte & Profituri">
      <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-dark">Rapoarte &amp; Profituri</h1>
        <p className="text-slate-600 mt-1">Situație agregată pentru perioada selectată.</p>
      </div>

      <form className="flex flex-wrap items-end gap-4 bg-white rounded-2xl border border-slate-200 p-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">De la</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Până la</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition"
        >
          Filtrează
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Curse în perioadă</p>
          <p className="text-2xl font-semibold text-brand-dark mt-1">{jobs.total}</p>
          <p className="text-xs text-slate-500 mt-2">
            {jobs.finalizat} finalizate · {jobs.activ} active · {jobs.planificare} planificate · {jobs.anulat} anulate
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Cheltuieli flotă</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">{costsTotal.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Marjă brokeraj</p>
          <p className={`text-2xl font-semibold mt-1 ${brokerage.margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
            {brokerage.margin.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-2">{brokerage.count} înregistrări</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-medium text-brand-dark">Venituri curse pe monedă</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Monedă</th>
                <th className="px-4 py-2">Nr. curse</th>
                <th className="px-4 py-2">Total (tarif + extra)</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.currency} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{r.currency}</td>
                  <td className="px-4 py-2">{r.count}</td>
                  <td className="px-4 py-2">{Number(r.total).toFixed(2)}</td>
                </tr>
              ))}
              {revenue.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nicio cursă în perioadă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-medium text-brand-dark">Cheltuieli pe categorie</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {costsByCategory.map((c) => (
                <tr key={c.category} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{c.category}</td>
                  <td className="px-4 py-2">{Number(c.total).toFixed(2)}</td>
                </tr>
              ))}
              {costsByCategory.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                    Nicio cheltuială în perioadă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-brand-dark">Cheltuieli pe vehicul (top 8)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2">Vehicul</th>
              <th className="px-4 py-2">Total cheltuieli</th>
            </tr>
          </thead>
          <tbody>
            {costsByVehicle.map((v) => (
              <tr key={v.plate} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{v.plate}</td>
                <td className="px-4 py-2">{Number(v.total).toFixed(2)}</td>
              </tr>
            ))}
            {costsByVehicle.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  Nicio cheltuială asociată unui vehicul în perioadă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Notă: veniturile din curse sunt afișate pe monedă (pot fi în EUR, USD, GBP sau RON), iar cheltuielile și marja de brokeraj sunt în RON — profitul net trebuie calculat manual dacă monedele diferă.
      </p>
      </div>
    </AppShell>
  );
}
