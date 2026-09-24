import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <AppShell active="dashboard" crumb="Command Center">
      <h1 className="text-2xl font-semibold text-brand-dark">
        Bine ai venit, {session.user.name || session.user.email}
      </h1>
      <p className="text-slate-600 mt-2">
        Aici vor apărea curând statisticile live ale flotei (curse azi, în tranzit, venit, alerte).
      </p>
    </AppShell>
  );
}
