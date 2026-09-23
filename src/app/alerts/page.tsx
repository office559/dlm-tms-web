import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listExpiryAlerts } from "@/lib/alerts";
import { getSettings } from "@/lib/settings";

function badgeClass(daysLeft: number) {
  if (daysLeft < 0) return "bg-red-50 text-red-700";
  if (daysLeft <= 7) return "bg-orange-50 text-orange-700";
  return "bg-amber-50 text-amber-700";
}

function daysLabel(daysLeft: number) {
  if (daysLeft < 0) return `Expirat de ${Math.abs(daysLeft)} zile`;
  if (daysLeft === 0) return "Expiră azi";
  return `${daysLeft} zile rămase`;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const settings = await getSettings();
  const defaultDays = settings?.alert_days ?? 30;
  const days = params.days && !Number.isNaN(Number(params.days)) ? Number(params.days) : defaultDays;

  const alerts = await listExpiryAlerts(days);
  const expired = alerts.filter((a) => a.days_left < 0);
  const upcoming = alerts.filter((a) => a.days_left >= 0);

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Alerte expirare documente</h1>
          <p className="text-slate-600 mt-1">
            ITP, RCA, CASCO, asigurare și tahograf pentru vehicule și remorci active.
          </p>
        </div>
        <form className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Prag (zile)</label>
            <input
              type="number"
              name="days"
              defaultValue={days}
              min={0}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition"
          >
            Aplică
          </button>
        </form>
      </div>

      {expired.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h2 className="font-medium text-red-700">Expirate ({expired.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Nr. înmatriculare</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Data expirării</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expired.map((a) => (
                <tr key={`${a.kind}-${a.id}-${a.doc}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 capitalize">{a.kind}</td>
                  <td className="px-4 py-3 font-medium">{a.plate}</td>
                  <td className="px-4 py-3">{a.doc}</td>
                  <td className="px-4 py-3">{new Date(a.exp_date).toLocaleDateString("ro-RO")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(a.days_left)}`}>
                      {daysLabel(a.days_left)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={a.kind === "vehicul" ? `/vehicles/${a.id}` : `/trailers/${a.id}`} className="text-brand hover:text-brand-dark text-sm">
                      Editează
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-brand-dark">
            Expiră în următoarele {days} zile ({upcoming.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Nr. înmatriculare</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Data expirării</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((a) => (
              <tr key={`${a.kind}-${a.id}-${a.doc}`} className="border-t border-slate-100">
                <td className="px-4 py-3 capitalize">{a.kind}</td>
                <td className="px-4 py-3 font-medium">{a.plate}</td>
                <td className="px-4 py-3">{a.doc}</td>
                <td className="px-4 py-3">{new Date(a.exp_date).toLocaleDateString("ro-RO")}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(a.days_left)}`}>
                    {daysLabel(a.days_left)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <a href={a.kind === "vehicul" ? `/vehicles/${a.id}` : `/trailers/${a.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                </td>
              </tr>
            ))}
            {upcoming.length === 0 && expired.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Niciun document nu expiră în perioada selectată.
                </td>
              </tr>
            )}
            {upcoming.length === 0 && expired.length > 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Niciun document nu expiră în perioada selectată (dar vezi secțiunea de mai sus).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
