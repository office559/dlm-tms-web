import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCompaniesWithCounts } from "@/lib/companies";
import { AppShell } from "@/components/AppShell";
import { CompaniesManager } from "@/components/CompaniesManager";

export default async function CompaniesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const companies = await listCompaniesWithCounts();

  return (
    <AppShell active="companies" crumb="Firme">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Firme</h1>
          <p className="mt-1 text-slate-600">
            Firmele ale căror vehicule le dispecerezi (firma ta și celelalte). Fiecare vehicul
            aparține unei firme, iar rapoartele se pot filtra pe firmă.
          </p>
        </div>

        <CompaniesManager
          companies={companies.map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
            vehicle_count: c.vehicle_count,
          }))}
        />
      </div>
    </AppShell>
  );
}
