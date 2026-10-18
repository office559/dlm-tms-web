import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCompanies } from "@/lib/companies";
import { AppShell } from "@/components/AppShell";
import {
  buildReport,
  fmtDay,
  fmtMoney,
  monthRange,
  parseReportParams,
  weekRange,
} from "@/lib/reports-firms";
import type { CostRow, FirmReport } from "@/lib/reports-firms";

const STATUS_LABELS: Record<string, string> = {
  planificare: "planificate",
  activ: "active",
  finalizat: "finalizate",
  anulat: "anulate",
};

function CostTable({ title, rows }: { title: string; rows: CostRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h3 className="px-5 pb-2 pt-4 text-lg font-semibold text-brand-dark">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-base text-slate-500">Nicio cheltuială în perioadă.</p>
      ) : (
        <table className="w-full text-base">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-100">
                <td className="px-5 py-3">
                  <div className="font-semibold text-slate-900">{r.label}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${(r.total / max) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-lg font-bold text-slate-900">
                  {fmtMoney(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FirmCard({ firm, qs }: { firm: FirmReport; qs: (firma: string) => string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-dark px-5 py-4 text-white">
        <h2 className="text-xl font-extrabold">{firm.name}</h2>
        <div className="text-base font-semibold">
          {firm.jobs} curse
          {firm.currencies.map((b) => (
            <span key={b.currency}>
              {" · "}
              <b className="text-xl">{fmtMoney(b.total, b.currency)}</b>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/export?${qs(firm.id)}`}
            className="rounded-lg border-2 border-white/70 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/10"
          >
            ⬇ Excel
          </a>
          <a
            href={`/reports/print?${qs(firm.id)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border-2 border-white/70 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/10"
          >
            ⬇ PDF
          </a>
        </div>
      </div>

      {firm.currencies.length === 0 ? (
        <p className="px-5 py-6 text-base text-slate-500">Nicio cursă (fără cele anulate) în perioadă.</p>
      ) : (
        firm.currencies.map((b) => {
          const max = Math.max(1, ...b.rows.map((r) => r.total));
          return (
            <div key={b.currency}>
              {firm.currencies.length > 1 && (
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-sm font-bold text-slate-600">
                  Venituri în {b.currency}
                </div>
              )}
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-orange-50 text-left text-sm text-orange-800">
                    <th className="px-5 py-2.5">Vehicul</th>
                    <th className="px-5 py-2.5">Șofer</th>
                    <th className="px-5 py-2.5 text-right">Curse</th>
                    <th className="px-5 py-2.5 text-right">Venit</th>
                    <th className="px-5 py-2.5 text-right">Medie / cursă</th>
                    <th className="w-44 px-5 py-2.5">% din firmă</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, i) => {
                    const pct = b.total > 0 ? (r.total / b.total) * 100 : 0;
                    return (
                      <tr key={`${r.plate}-${r.driver}-${i}`} className="border-t border-slate-100">
                        <td className="px-5 py-3 text-lg font-bold text-slate-900">{r.plate}</td>
                        <td className="px-5 py-3 text-slate-700">{r.driver}</td>
                        <td className="px-5 py-3 text-right">{r.jobs}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-lg font-bold text-slate-900">
                          {fmtMoney(r.total, b.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                          {fmtMoney(r.jobs ? r.total / r.jobs : 0, b.currency)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm font-semibold text-slate-600">{pct.toFixed(0)}%</div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${(r.total / max) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                    <td className="px-5 py-3 text-slate-900" colSpan={2}>
                      Total {firm.name}
                    </td>
                    <td className="px-5 py-3 text-right">{b.jobs}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-lg text-brand-dark">
                      {fmtMoney(b.total, b.currency)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                      {fmtMoney(b.jobs ? b.total / b.jobs : 0, b.currency)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; firma?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { from, to, firma } = parseReportParams(await searchParams);
  const [companies, report] = await Promise.all([listCompanies(), buildReport(from, to, firma)]);

  const qs = (f: string) =>
    new URLSearchParams({ from, to, ...(f ? { firma: f } : {}) }).toString();

  const presets = [
    { label: "Săptămâna aceasta", ...weekRange(0) },
    { label: "Săptămâna trecută", ...weekRange(-1) },
    { label: "Luna aceasta", ...monthRange(0) },
    { label: "Luna trecută", ...monthRange(-1) },
  ];
  const presetHref = (r: { from: string; to: string }) =>
    `/reports?${new URLSearchParams({ from: r.from, to: r.to, ...(firma ? { firma } : {}) })}`;

  const eur = report.totals.find((t) => t.currency === "EUR");
  const profitEur = (eur?.total ?? 0) - report.costsTotal;
  const statusLine = report.statusCounts
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${STATUS_LABELS[s.status] ?? s.status}`)
    .join(" · ");

  return (
    <AppShell active="reports" crumb="Rapoarte & Profituri" wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-brand-dark">Rapoarte &amp; Profituri</h1>
            <p className="mt-1 text-base text-slate-600">
              Situație pentru perioada {fmtDay(from)} – {fmtDay(to)} · {report.companyLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/reports/export?${qs(firma)}`}
              className="rounded-xl border-2 border-brand-dark bg-white px-4 py-2 text-base font-bold text-brand-dark hover:bg-slate-50"
            >
              ⬇ Excel
            </a>
            <a
              href={`/reports/print?${qs(firma)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border-2 border-brand-dark bg-white px-4 py-2 text-base font-bold text-brand-dark hover:bg-slate-50"
            >
              ⬇ PDF
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const on = p.from === from && p.to === to;
            return (
              <a
                key={p.label}
                href={presetHref(p)}
                className={
                  on
                    ? "rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white"
                    : "rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-brand"
                }
              >
                {p.label}
              </a>
            );
          })}
        </div>

        <form
          method="get"
          action="/reports"
          className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Firmă
            <select
              name="firma"
              defaultValue={firma}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
            >
              <option value="">Toate firmele</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">Fără firmă</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            De la
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Până la
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2.5 text-base font-bold text-white hover:opacity-90"
          >
            Filtrează
          </button>
        </form>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Curse în perioadă</div>
            <div className="mt-1 text-4xl font-bold text-brand-dark">{report.jobsCount}</div>
            <div className="mt-1 text-sm text-slate-500">{statusLine || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Venituri curse</div>
            {report.totals.length === 0 ? (
              <div className="mt-1 text-4xl font-bold text-brand-dark">0,00</div>
            ) : (
              report.totals.map((t) => (
                <div key={t.currency} className="mt-1 text-3xl font-bold text-brand-dark">
                  {fmtMoney(t.total, t.currency)}
                </div>
              ))
            )}
            <div className="mt-1 text-sm text-slate-500">tarif + extra, fără cele anulate</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Cheltuieli flotă</div>
            <div className="mt-1 text-4xl font-bold text-red-600">{fmtMoney(report.costsTotal)}</div>
            <div className="mt-1 text-sm text-slate-500">în perioadă</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Profit estimat (EUR)</div>
            <div
              className={`mt-1 text-4xl font-bold ${profitEur >= 0 ? "text-green-700" : "text-red-600"}`}
            >
              {fmtMoney(profitEur, "EUR")}
            </div>
            <div className="mt-1 text-sm text-slate-500">venituri EUR − cheltuieli</div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-brand-dark">Venituri curse pe monedă</h2>
          {report.totals.length === 0 ? (
            <p className="mt-2 text-base text-slate-500">Nicio cursă în perioadă.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-x-12 gap-y-4">
              {report.totals.map((t) => (
                <div key={t.currency}>
                  <div className="text-4xl font-extrabold text-brand-dark">
                    {fmtMoney(t.total, t.currency)}
                  </div>
                  <div className="mt-0.5 text-base text-slate-500">
                    {t.jobs} curse · {t.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {report.firms.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-500">
            Nicio cursă în perioada aleasă.
          </p>
        ) : (
          report.firms.map((f) => <FirmCard key={f.id} firm={f} qs={qs} />)
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <CostTable title="Cheltuieli pe categorie" rows={report.costsByCategory} />
          <CostTable title="Cheltuieli pe vehicul (top 8)" rows={report.costsByVehicle} />
        </div>

        <p className="text-sm text-slate-500">
          Venitul unei curse = tarif + extra, la data încărcării. Cursele anulate nu sunt incluse în venituri.
          Cheltuielile sunt cele din secțiunea Cheltuieli, filtrate după firma vehiculului.
        </p>
      </div>
    </AppShell>
  );
}
