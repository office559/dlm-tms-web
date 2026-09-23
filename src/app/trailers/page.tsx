import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listTrailers } from "@/lib/trailers";
import { DeleteButton } from "@/components/DeleteButton";

export default async function TrailersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const trailers = await listTrailers();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Remorci</h1>
          <p className="text-slate-600 mt-1">Lista remorcilor din flotă.</p>
        </div>
        <a href="/trailers/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă remorcă
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Număr</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {trailers.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{t.plate}</td>
                <td className="px-4 py-3">{t.type || "—"}</td>
                <td className="px-4 py-3">
                  {t.active ? (
                    <span className="text-green-700 bg-green-50 rounded-full px-2 py-0.5 text-xs">
                      Activă
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-xs">
                      Inactivă
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/trailers/${t.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/trailers/${t.id}`} confirmText={`Ștergi remorca ${t.plate}?`} />
                </td>
              </tr>
            ))}
            {trailers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nicio remorcă încă. Adaugă prima mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
