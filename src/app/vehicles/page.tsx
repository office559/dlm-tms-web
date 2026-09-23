import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { DeleteButton } from "@/components/DeleteButton";

export default async function VehiclesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [vehicles, drivers, trailers] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
  ]);

  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const trailerPlate = new Map(trailers.map((t) => [t.id, t.plate]));

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Vehicule</h1>
          <p className="text-slate-600 mt-1">Lista vehiculelor din flotă.</p>
        </div>
        <a href="/vehicles/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă vehicul
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Număr</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Șofer</th>
              <th className="px-4 py-3">Remorcă</th>
              <th className="px-4 py-3">Preț</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{v.plate}</td>
                <td className="px-4 py-3">{v.type || "—"}</td>
                <td className="px-4 py-3">{v.driver_id ? driverName.get(v.driver_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{v.trailer_id ? trailerPlate.get(v.trailer_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{v.price ?? "—"}</td>
                <td className="px-4 py-3">
                  {v.active ? (
                    <span className="text-green-700 bg-green-50 rounded-full px-2 py-0.5 text-xs">
                      Activ
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-xs">
                      Inactiv
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/vehicles/${v.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/vehicles/${v.id}`} confirmText={`Ștergi vehiculul ${v.plate}?`} />
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Niciun vehicul încă. Adaugă primul mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
