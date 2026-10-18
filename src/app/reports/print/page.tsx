import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { buildReport, fmtDay, fmtMoney, parseReportParams } from "@/lib/reports-firms";
import { formatDateInTz, formatTimeInTz } from "@/lib/tz";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; firma?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { from, to, firma } = parseReportParams(await searchParams);
  const r = await buildReport(from, to, firma);

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-sm text-slate-900 print:max-w-none print:p-0">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Raport — {r.companyLabel}</h1>
          <p className="text-slate-600">
            Perioada {fmtDay(from)} – {fmtDay(to)}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-5 flex flex-wrap gap-x-10 gap-y-2 rounded-lg border border-slate-300 p-3">
        <div>
          <div className="text-xs text-slate-500">Curse (fără anulate)</div>
          <div className="text-xl font-bold">{r.totals.reduce((s, t) => s + t.jobs, 0)}</div>
        </div>
        {r.totals.map((t) => (
          <div key={t.currency}>
            <div className="text-xs text-slate-500">Venit {t.currency}</div>
            <div className="text-xl font-bold">{fmtMoney(t.total, t.currency)}</div>
          </div>
        ))}
        <div>
          <div className="text-xs text-slate-500">Cheltuieli flotă</div>
          <div className="text-xl font-bold text-red-700">{fmtMoney(r.costsTotal)}</div>
        </div>
      </div>

      {r.firms.map((f) => (
        <section key={f.id} className="mb-6 break-inside-avoid-page">
          <div className="flex items-baseline justify-between rounded-t-lg bg-brand-dark px-3 py-2 text-white">
            <h2 className="text-lg font-bold">{f.name}</h2>
            <span className="font-semibold">
              {f.jobs} curse
              {f.currencies.map((b) => ` · ${fmtMoney(b.total, b.currency)}`)}
            </span>
          </div>
          {f.currencies.length === 0 && <p className="p-3 text-slate-500">Nicio cursă în perioadă.</p>}
          {f.currencies.map((b) => (
            <table key={b.currency} className="mb-2 w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left text-xs">
                  <th className="p-2">Vehicul ({b.currency})</th>
                  <th className="p-2">Șofer</th>
                  <th className="p-2 text-right">Curse</th>
                  <th className="p-2 text-right">Venit</th>
                  <th className="p-2 text-right">Medie / cursă</th>
                  <th className="p-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((x, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="p-2 font-bold">{x.plate}</td>
                    <td className="p-2">{x.driver}</td>
                    <td className="p-2 text-right">{x.jobs}</td>
                    <td className="p-2 text-right font-semibold">{fmtMoney(x.total, b.currency)}</td>
                    <td className="p-2 text-right">{fmtMoney(x.jobs ? x.total / x.jobs : 0, b.currency)}</td>
                    <td className="p-2 text-right">{b.total > 0 ? ((x.total / b.total) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
                  <td className="p-2" colSpan={2}>
                    Total {f.name}
                  </td>
                  <td className="p-2 text-right">{b.jobs}</td>
                  <td className="p-2 text-right">{fmtMoney(b.total, b.currency)}</td>
                  <td className="p-2 text-right">{fmtMoney(b.jobs ? b.total / b.jobs : 0, b.currency)}</td>
                  <td className="p-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          ))}

          {f.jobList.length > 0 && (
            <table className="mt-3 w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-1.5">Data</th>
                  <th className="p-1.5">Traseu</th>
                  <th className="p-1.5">Ref.</th>
                  <th className="p-1.5">Client</th>
                  <th className="p-1.5">Vehicul</th>
                  <th className="p-1.5">Șofer</th>
                  <th className="p-1.5 text-right">Tarif</th>
                </tr>
              </thead>
              <tbody>
                {f.jobList.map((j, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-200 ${j.status === "anulat" ? "text-slate-400 line-through" : ""}`}
                  >
                    <td className="whitespace-nowrap p-1.5">
                      {j.startAt ? `${formatDateInTz(j.startAt, "UTC")} ${formatTimeInTz(j.startAt, "UTC")}` : "—"}
                    </td>
                    <td className="p-1.5">{j.route}</td>
                    <td className="p-1.5">{j.ref}</td>
                    <td className="p-1.5">{j.client}</td>
                    <td className="p-1.5">{j.plate}</td>
                    <td className="p-1.5">{j.driver}</td>
                    <td className="whitespace-nowrap p-1.5 text-right">{fmtMoney(j.amount, j.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
