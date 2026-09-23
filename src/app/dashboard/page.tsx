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
        Modulele operaționale (Job Center, Planificare, Rapoarte) urmează în etapele următoare.
      </p>
      <div className="flex flex-wrap gap-3 mt-6">
        
          href="/drivers"
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition"
        >
          Șoferi
        </a>
        {session.user.role === "admin" && (
          
            href="/dispatchers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition"
          >
            Gestionează dispecerii
          </a>
        )}
      </div>
    </div>
  );
}
