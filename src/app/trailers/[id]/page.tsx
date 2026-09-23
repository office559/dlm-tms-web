import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTrailer } from "@/lib/trailers";
import { TrailerForm } from "@/components/TrailerForm";

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
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Editează remorcă</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <TrailerForm
          initial={{
            id: trailer.id,
            plate: trailer.plate,
            type: trailer.type ?? "Curtainsider",
            itpExp: trailer.itp_exp ? String(trailer.itp_exp).slice(0, 10) : "",
            rcaExp: trailer.rca_exp ? String(trailer.rca_exp).slice(0, 10) : "",
            cascoExp: trailer.casco_exp ? String(trailer.casco_exp).slice(0, 10) : "",
            active: trailer.active,
          }}
        />
      </div>
    </div>
  );
}
