import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listBrokerage } from "@/lib/brokerage";
import { DeleteButton } from "@/components/DeleteButton";
import { matchesQuery } from "@/lib/search";
import { AppShell } from "@/components/AppShell";

const STATUS_STYLES: Record<string, string> = {
  "În curs": "bg-amber-50 text-amber-700",
  "Finalizat": "bg-emerald-50 text-emerald-700",
  "Anulat": "bg-slate-100 text-slate-500",
};

export default async function BrokeragePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q = "" } = await searchParams;

  const items = await listBrokerage();

  const filteredItems = items.filter((b) =>
    matchesQuery([b.client, b.sub, b.ref, b.route], q)
  );

  const totalMargin = filteredItems.reduce((sum, b) => {
    const cp = Number(b.client_price ?? 0);
    const sp = Number(b.sub_price ?? 0);
    return sum + (cp - sp);
  }, 0);

  return (
    <AppShell active="brokerage" crumb="Brokeraj">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Brokeraj</h1>
          <p className="text-slate-600 mt-1">
            Marjă totală: <span className="font-medium">{totalMargin.toFixed(2)}</span>
          </p>
        </div>
        <a href="/brokerage/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă înregistrare
        </a>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Caută după client, subcontractor, referință, rută..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
          Caută
        </button>
        {q && (
          <a href="/brokerage" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-500 hover:bg-slate-50 transition">
            Resetează
          </a>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Rută</th>
              <th className="px-4 py-3">Încărcare</th>
              <th className="px-4 py-3">Preț client</th>
              <th className="px-4 py-3">Subcontractor</th>
              <th className="px-4 py-3">Preț sub</th>
              <th className="px-4 py-3">Marjă</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plăți</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((b) => {
              const cp = Number(b.client_price ?? 0);
              const sp = Number(b.sub_price ?? 0);
              const margin = cp - sp;
              return (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {b.client}
                    {b.ref && <span className="text-slate-400 font-normal"> · {b.ref}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{b.route || "—"}</td>
                  <td className="px-4 py-3">
                    {b.collect_date ? new Date(b.collect_date).toLocaleDateString("ro-RO") : "—"}
                  </td>
                  <td className="px-4 py-3">{b.client_price != null ? cp.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3">{b.sub || "—"}</td>
                  <td className="px-4 py-3">{b.sub_price != null ? sp.toFixed(2) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {margin.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {b.paid_client ? "Client ✓" : "Client ✗"} / {b.paid_sub ? "Sub ✓" : "Sub ✗"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <a href={`/brokerage/${b.id}`} className="text-brand hover:text-brand-dark text-sm">
                      Editează
                    </a>
                    <DeleteButton url={`/api/brokerage/${b.id}`} confirmText={`Ștergi înregistrarea pentru ${b.client}?`} />
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                  {q ? `Nicio înregistrare găsită pentru „${q}".` : "Nicio înregistrare de brokeraj încă. Adaugă prima mai sus."}
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
