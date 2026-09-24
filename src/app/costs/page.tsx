import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCosts } from "@/lib/costs";
import { listVehicles } from "@/lib/vehicles";
import { DeleteButton } from "@/components/DeleteButton";
import { matchesQuery } from "@/lib/search";
import { AppShell } from "@/components/AppShell";

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q = "" } = await searchParams;

  const [costs, vehicles] = await Promise.all([listCosts(), listVehicles()]);
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plate]));

  const filteredCosts = costs.filter((c) =>
    matchesQuery(
      [c.category, c.note, c.vehicle_id ? vehiclePlate.get(c.vehicle_id) : null],
      q
    )
  );

  const total = filteredCosts.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <AppShell active="costs" crumb="Cheltuieli flotă">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Cheltuieli flotă</h1>
          <p className="text-slate-600 mt-1">
            Total: <span className="font-medium">{total.toFixed(2)}</span>
          </p>
        </div>
        <a href="/costs/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă cheltuială
        </a>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Caută după categorie, vehicul, observații..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
          Caută
        </button>
        {q && (
          <a href="/costs" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-500 hover:bg-slate-50 transition">
            Resetează
          </a>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Vehicul</th>
              <th className="px-4 py-3">Sumă</th>
              <th className="px-4 py-3">Observații</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCosts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{new Date(c.date).toLocaleDateString("ro-RO")}</td>
                <td className="px-4 py-3 font-medium">{c.category}</td>
                <td className="px-4 py-3">{c.vehicle_id ? vehiclePlate.get(c.vehicle_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{Number(c.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-500">{c.note || "—"}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/costs/${c.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/costs/${c.id}`} confirmText={`Ștergi cheltuiala de ${c.amount}?`} />
                </td>
              </tr>
            ))}
            {filteredCosts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {q ? `Nicio cheltuială găsită pentru „${q}".` : "Nicio cheltuială încă. Adaugă prima mai sus."}
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
