import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { CostForm } from "@/components/CostForm";
import { AppShell } from "@/components/AppShell";

export default async function NewCostPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const vehicles = await listVehicles();

  return (
    <AppShell active="costs" crumb="Adaugă cheltuială">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Adaugă cheltuială</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <CostForm vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate }))} />
        </div>
      </div>
    </AppShell>
  );
}
