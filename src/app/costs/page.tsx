import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCosts } from "@/lib/costs";
import { listVehicles } from "@/lib/vehicles";
import { DeleteButton } from "@/components/DeleteButton";

export default async function CostsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [costs, vehicles] = await Promise.all([listCosts(), listVehicles()]);
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plate]));
  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="min-h-screen p-8 space-y-6">
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
            {costs.map((c) => (
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
            {costs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nicio cheltuială încă. Adaugă prima mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
