import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { listCustomers } from "@/lib/customers";
import { listDrivers } from "@/lib/drivers";
import { listVehicles } from "@/lib/vehicles";
import { listTrailers } from "@/lib/trailers";
import { listDispatchers } from "@/lib/db";
import { JobForm } from "@/components/JobForm";

function toLocalInput(d: Date | null) {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const [job, customers, drivers, vehicles, trailers, dispatchers] = await Promise.all([
    getJob(id),
    listCustomers(),
    listDrivers(),
    listVehicles(),
    listTrailers(),
    listDispatchers(),
  ]);
  if (!job) notFound();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Editează cursă</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <JobForm
          initial={{
            id: job.id,
            clientId: job.client_id ?? "",
            ref: job.ref ?? "",
            loadPlace: job.load_place ?? "",
            unloadPlace: job.unload_place ?? "",
            startAt: toLocalInput(job.start_at),
            endAt: toLocalInput(job.end_at),
            miles: job.miles != null ? String(job.miles) : "",
            currency: job.currency ?? "€",
            rate: job.rate != null ? String(job.rate) : "",
            extra: job.extra != null ? String(job.extra) : "",
            driverId: job.driver_id ?? "",
            vehicleId: job.vehicle_id ?? "",
            trailerId: job.trailer_id ?? "",
            dispatcherId: job.dispatcher_id ?? "",
            status: job.status,
            invoice: job.invoice,
            paidAt: job.paid_at ? String(job.paid_at).slice(0, 10) : "",
            notes: job.notes ?? "",
          }}
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
