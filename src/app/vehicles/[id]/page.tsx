import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getVehicle } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { VehicleForm } from "@/components/VehicleForm";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const [vehicle, drivers, trailers] = await Promise.all([
    getVehicle(id),
    listDrivers(),
    listTrailers(),
  ]);
  if (!vehicle) notFound();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Editează vehicul</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <VehicleForm
          initial={{
            id: vehicle.id,
            plate: vehicle.plate,
            type: vehicle.type ?? "TRACTOR",
            price: vehicle.price != null ? String(vehicle.price) : "",
            location: vehicle.location ?? "",
            itpExp: vehicle.itp_exp ? String(vehicle.itp_exp).slice(0, 10) : "",
            rcaExp: vehicle.rca_exp ? String(vehicle.rca_exp).slice(0, 10) : "",
            cascoExp: vehicle.casco_exp ? String(vehicle.casco_exp).slice(0, 10) : "",
            insuranceExp: vehicle.insurance_exp ? String(vehicle.insurance_exp).slice(0, 10) : "",
            tachoExp: vehicle.tacho_exp ? String(vehicle.tacho_exp).slice(0, 10) : "",
            driverId: vehicle.driver_id ?? "",
            trailerId: vehicle.trailer_id ?? "",
            active: vehicle.active,
          }}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          trailers={trailers.map((t) => ({ id: t.id, plate: t.plate }))}
        />
      </div>
    </div>
  );
}
