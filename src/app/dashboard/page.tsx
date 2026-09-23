import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold text-brand-dark">
        Bine ai venit, {session.user.name || session.user.email}
      </h1>
      <p className="text-slate-600 mt-2">
        Planificare, Rapoarte și celelalte module operaționale urmează în etapele următoare.
      </p>
      <div className="flex flex-wrap gap-3 mt-6">
        <a href="/jobs" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Job Center
        </a>
        <a href="/drivers" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Șoferi
        </a>
        <a href="/vehicles" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Vehicule
        </a>
        <a href="/trailers" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Remorci
        </a>
        <a href="/customers" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Clienți
        </a>
        <a href="/costs" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Cheltuieli flotă
        </a>
        <a href="/brokerage" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Brokeraj
        </a>
        <a href="/reports" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Rapoarte &amp; Profituri
        </a>
        <a href="/planning" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Planificare
        </a>
        <a href="/payments" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Plăți
        </a>
        {session.user.role === "admin" && (
          <a href="/dispatchers" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
            Gestionează dispecerii
          </a>
        )}
      </div>
    </div>
  );
}
