import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { TrailerForm } from "@/components/TrailerForm";

export default async function NewTrailerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Adaugă remorcă</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <TrailerForm />
      </div>
    </div>
  );
}
