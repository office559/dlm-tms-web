import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DriverForm } from "@/components/DriverForm";
import { AppShell } from "@/components/AppShell";

export default async function NewDriverPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <AppShell active="drivers" crumb="Șofer nou">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Șofer nou</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <DriverForm />
        </div>
      </div>
    </AppShell>
  );
}
