import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { VehicleForm } from "@/components/VehicleForm";

export default async function NewVehiclePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [drivers, trailers] = await Promise.all([listDrivers(), listTrailers()]);

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Adaugă vehicul</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <VehicleForm
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          trailers={trailers.map((t) => ({ id: t.id, plate: t.plate }))}
        />
      </div>
    </div>
  );
}
