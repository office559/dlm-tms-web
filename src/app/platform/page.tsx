import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgContext } from "@/lib/org";
import { listOrganizationCards } from "@/lib/platform";
import { PlatformOrgs } from "@/components/PlatformOrgs";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx?.isPlatformAdmin) redirect("/dashboard");

  const cards = await listOrganizationCards();
  const users = cards.reduce((s, c) => s + c.users, 0);

  return (
    <AppShell active="platform" crumb="Firme clienți">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Firme clienți</h1>
          <p className="mt-1 text-slate-600">
            {cards.length} {cards.length === 1 ? "firmă" : "firme"} · {users} utilizatori în total. Doar tu vezi această
            pagină; fiecare firmă are datele ei, complet separate.
          </p>
        </div>
        <PlatformOrgs cards={cards} activeOrgId={ctx.organizationId} />
      </div>
    </AppShell>
  );
}
