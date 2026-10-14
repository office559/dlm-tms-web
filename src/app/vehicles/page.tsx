import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { listCompanies } from "@/lib/companies";
import { DeleteButton } from "@/components/DeleteButton";
import { matchesQuery } from "@/lib/search";
import { AppShell } from "@/components/AppShell";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; firma?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q = "", firma = "" } = await searchParams;

  const [vehicles, drivers, trailers, companies] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
    listCompanies(),
  ]);

  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const trailerPlate = new Map(trailers.map((t) => [t.id, t.plate]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const filteredVehicles = vehicles.filter((v) => {
    const byCompany =
      firma === ""
        ? true
        : firma === "none"
          ? !v.company_id
          : v.company_id === firma;
    if (!byCompany) return false;
    return matchesQuery(
      [
        v.plate,
        v.type,
        v.driver_id ? driverName.get(v.driver_id) : null,
        v.trailer_id ? trailerPlate.get(v.trailer_id) : null,
        v.company_id ? companyName.get(v.company_id) : null,
      ],
      q
    );
  });

  const hasFilters = Boolean(q) || firma !== "";

  return (
    <AppShell active="vehicles" crumb="Vehicule">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Vehicule</h1>
          <p className="text-slate-600 mt-1">Lista vehiculelor din flotă.</p>
        </div>
        <a href="/vehicles/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă vehicul
        </a>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Caută după număr, tip, șofer, remorcă, firmă..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <select
          name="firma"
          defaultValue={firma}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">Toate firmele</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Fără firmă</option>
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
          Caută
        </button>
        {hasFilters && (
          <a href="/vehicles" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-500 hover:bg-slate-50 transition">
            Resetează
          </a>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Număr</th>
              <th className="px-4 py-3">Firmă</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Șofer</th>
              <th className="px-4 py-3">Remorcă</th>
              <th className="px-4 py-3">Preț</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{v.plate}</td>
                <td className="px-4 py-3">
                  {v.company_id ? (
                    companyName.get(v.company_id) ?? "—"
                  ) : (
                    <span className="text-slate-400">Fără firmă</span>
                  )}
                </td>
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
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  {hasFilters
                    ? "Niciun vehicul găsit pentru filtrele alese."
                    : "Niciun vehicul încă. Adaugă primul mai sus."}
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
