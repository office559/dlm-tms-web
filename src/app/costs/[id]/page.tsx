import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getCost } from "@/lib/costs";
import { listVehicles } from "@/lib/vehicles";
import { CostForm } from "@/components/CostForm";

export default async function EditCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const [cost, vehicles] = await Promise.all([getCost(id), listVehicles()]);
  if (!cost) notFound();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Editează cheltuială</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <CostForm
          initial={{
            id: cost.id,
            date: String(cost.date).slice(0, 10),
            category: cost.category,
            vehicleId: cost.vehicle_id ?? "",
            amount: String(cost.amount),
            note: cost.note ?? "",
          }}
          vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate }))}
        />
      </div>
    </div>
  );
}
