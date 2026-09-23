import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";
import { listCustomers } from "@/lib/customers";
import { listDrivers } from "@/lib/drivers";
import { listVehicles } from "@/lib/vehicles";
import { DeleteButton } from "@/components/DeleteButton";

const STATUS_LABELS: Record<string, string> = {
  planificare: "Planificare",
  activ: "Activ",
  finalizat: "Finalizat",
  anulat: "Anulat",
};

const STATUS_STYLES: Record<string, string> = {
  planificare: "text-slate-600 bg-slate-100",
  activ: "text-blue-700 bg-blue-50",
  finalizat: "text-green-700 bg-green-50",
  anulat: "text-red-700 bg-red-50",
};

export default async function JobsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [jobs, customers, drivers, vehicles] = await Promise.all([
    listJobs(),
    listCustomers(),
    listDrivers(),
    listVehicles(),
  ]);

  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plate]));

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Job Center</h1>
          <p className="text-slate-600 mt-1">Cursele planificate și în desfășurare.</p>
        </div>
        <a href="/jobs/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă cursă
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Traseu</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Șofer</th>
              <th className="px-4 py-3">Vehicul</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Tarif</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  {j.load_place || "—"} → {j.unload_place || "—"}
                </td>
                <td className="px-4 py-3">{j.client_id ? customerName.get(j.client_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{j.driver_id ? driverName.get(j.driver_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{j.vehicle_id ? vehiclePlate.get(j.vehicle_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">
                  {j.start_at ? new Date(j.start_at).toLocaleString("ro-RO") : "—"}
                </td>
                <td className="px-4 py-3">
                  {j.rate != null ? `${j.rate} ${j.currency ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[j.status] ?? "text-slate-600 bg-slate-100"}`}>
                    {STATUS_LABELS[j.status] ?? j.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/jobs/${j.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/jobs/${j.id}`} confirmText={`Ștergi cursa ${j.ref || j.id}?`} />
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Nicio cursă încă. Adaugă prima mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
