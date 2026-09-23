import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { listDrivers } from "@/lib/drivers";
import { listVehicles } from "@/lib/vehicles";
import { listTrailers } from "@/lib/trailers";
import { listDispatchers } from "@/lib/db";
import { JobForm } from "@/components/JobForm";

export default async function NewJobPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [customers, drivers, vehicles, trailers, dispatchers] = await Promise.all([
    listCustomers(),
    listDrivers(),
    listVehicles(),
    listTrailers(),
    listDispatchers(),
  ]);

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Adaugă cursă</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <JobForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate }))}
          trailers={trailers.map((t) => ({ id: t.id, plate: t.plate }))}
          dispatchers={dispatchers.map((d) => ({ id: d.id, name: d.name }))}
        />
      </div>
    </div>
  );
}
