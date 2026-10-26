import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { TruckBansView } from "@/components/TruckBansView";
import { monthList } from "@/lib/truck-bans";

export const dynamic = "force-dynamic";

export default async function RestrictionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = monthList(currentMonth);

  return (
    <AppShell active="restrictions" crumb="Restricții circulație" wide>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold text-brand-dark">Restricții de circulație camioane</h1>
          <p className="mt-1 text-base text-slate-600">
            Zilele și orele în care camioanele nu au voie să circule, pe țări: Germania, Austria, Polonia, Slovacia,
            Cehia, Italia, Ungaria, Franța, Spania, Belgia și Olanda. Apasă o lună pentru toate țările, o țară pentru
            regulile ei sau o celulă pentru zilele exacte.
          </p>
        </div>
        <TruckBansView months={months} currentMonth={currentMonth} />
      </div>
    </AppShell>
  );
}
