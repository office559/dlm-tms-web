import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listJobsForPayments, listBrokerageForPayments, getPaymentsSummary } from "@/lib/payments";
import { JobPaymentRow } from "@/components/JobPaymentRow";
import { BrokeragePaymentRow } from "@/components/BrokeragePaymentRow";
import { AppShell } from "@/components/AppShell";

export default async function PaymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [jobs, brokerage, summary] = await Promise.all([
    listJobsForPayments(),
    listBrokerageForPayments(),
    getPaymentsSummary(),
  ]);

  return (
    <AppShell active="payments" crumb="Plăți">
      <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-dark">Plăți</h1>
        <p className="text-slate-600 mt-1">Facturare curse și plăți brokeraj.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">De încasat (curse neplătite)</p>
          {summary.jobsUnpaidByCurrency.length === 0 ? (
            <p className="text-2xl font-semibold text-emerald-700 mt-1">0.00</p>
          ) : (
            <div className="mt-1 space-y-0.5">
              {summary.jobsUnpaidByCurrency.map((r) => (
                <p key={r.currency} className="text-lg font-semibold text-red-600">
                  {Number(r.total).toFixed(2)} {r.currency}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">De încasat brokeraj</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">{summary.brokerageToCollect.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">De plătit subcontractori</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">{summary.brokerageToPay.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-brand-dark">Facturare curse</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Traseu</th>
              <th className="px-4 py-3">Referință</th>
              <th className="px-4 py-3">Tarif</th>
              <th className="px-4 py-3">Facturare</th>
              <th className="px-4 py-3">Data plată</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <JobPaymentRow key={j.id} job={j} />
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nicio cursă cu tarif setat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-brand-dark">Plăți brokeraj</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Subcontractor</th>
              <th className="px-4 py-3">Preț client</th>
              <th className="px-4 py-3">Preț sub</th>
              <th className="px-4 py-3 text-center">Client plătit</th>
              <th className="px-4 py-3 text-center">Sub plătit</th>
            </tr>
          </thead>
          <tbody>
            {brokerage.map((b) => (
              <BrokeragePaymentRow key={b.id} item={b} />
            ))}
            {brokerage.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nicio înregistrare de brokeraj.
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
