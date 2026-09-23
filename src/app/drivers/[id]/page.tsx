import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDriver } from "@/lib/drivers";
import { DriverForm } from "@/components/DriverForm";

export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const driver = await getDriver(id);
  if (!driver) notFound();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Editează șofer</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <DriverForm
          initial={{
            id: driver.id,
            name: driver.name,
            fictiveName: driver.fictive_name ?? "",
            salary: driver.salary != null ? String(driver.salary) : "",
            tm: driver.tm ?? "",
            card: driver.card ?? "",
            permisExp: driver.permis_exp ? String(driver.permis_exp).slice(0, 10) : "",
            cpcExp: driver.cpc_exp ? String(driver.cpc_exp).slice(0, 10) : "",
            cardExp: driver.card_exp ? String(driver.card_exp).slice(0, 10) : "",
            medicalExp: driver.medical_exp ? String(driver.medical_exp).slice(0, 10) : "",
            phone: driver.phone ?? "",
            active: driver.active,
          }}
        />
      </div>
    </div>
  );
}
