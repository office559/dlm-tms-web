import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getVehicle } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { listCompanies } from "@/lib/companies";
import { VehicleForm } from "@/components/VehicleForm";
import { AppShell } from "@/components/AppShell";
import { dateInputValue } from "@/lib/date-input";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const [vehicle, drivers, trailers, companies] = await Promise.all([
    getVehicle(id),
    listDrivers(),
    listTrailers(),
    listCompanies(),
  ]);
  if (!vehicle) notFound();

  return (
    <AppShell active="vehicles" crumb="Editează vehicul">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Editează vehicul</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <VehicleForm
            initial={{
              id: vehicle.id,
              plate: vehicle.plate,
              type: vehicle.type ?? "TRACTOR",
              price: vehicle.price != null ? String(vehicle.price) : "",
              location: vehicle.location ?? "",
              itpExp: dateInputValue(vehicle.itp_exp),
              rcaExp: dateInputValue(vehicle.rca_exp),
              cascoExp: dateInputValue(vehicle.casco_exp),
              insuranceExp: dateInputValue(vehicle.insurance_exp),
              tachoExp: dateInputValue(vehicle.tacho_exp),
              driverId: vehicle.driver_id ?? "",
              trailerId: vehicle.trailer_id ?? "",
              companyId: vehicle.company_id ?? "",
              active: vehicle.active,
            }}
            drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
            trailers={trailers.map((t) => ({ id: t.id, plate: t.plate }))}
            companies={companies.map((c) => ({ id: c.id, name: c.name, active: c.active }))}
          />
        </div>
      </div>
    </AppShell>
  );
}
