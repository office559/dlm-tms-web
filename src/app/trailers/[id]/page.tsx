import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTrailer } from "@/lib/trailers";
import { TrailerForm } from "@/components/TrailerForm";
import { AppShell } from "@/components/AppShell";
import { dateInputValue } from "@/lib/date-input";

export default async function EditTrailerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const trailer = await getTrailer(id);
  if (!trailer) notFound();

  return (
    <AppShell active="trailers" crumb="Editează remorcă">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Editează remorcă</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <TrailerForm
            initial={{
              id: trailer.id,
              plate: trailer.plate,
              type: trailer.type ?? "Curtainsider",
              itpExp: dateInputValue(trailer.itp_exp),
              rcaExp: dateInputValue(trailer.rca_exp),
              cascoExp: dateInputValue(trailer.casco_exp),
              active: trailer.active,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
