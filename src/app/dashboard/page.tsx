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
        Aceasta e prima versiune a fundației — autentificare și conturi de dispecer. Modulele
        operaționale (Job Center, Planificare, Rapoarte) urmează în etapele următoare.
      </p>
      {session.user.role === "admin" && (
        <a
          href="/dispatchers"
          className="inline-block mt-6 rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition"
        >
          Gestionează dispecerii
        </a>
      )}
    </div>
  );
}
