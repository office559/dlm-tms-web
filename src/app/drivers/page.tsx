import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listDrivers } from "@/lib/drivers";
import { DeleteButton } from "@/components/DeleteButton";

export default async function DriversPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const drivers = await listDrivers();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Șoferi</h1>
          <p className="text-slate-600 mt-1">Lista șoferilor din flotă.</p>
        </div>
        
          href="/drivers/new"
          className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition"
        >
          + Adaugă șofer
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Nume</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Salariu</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.phone || "—"}</td>
                <td className="px-4 py-3">{d.salary ?? "—"}</td>
                <td className="px-4 py-3">
                  {d.active ? (
                    <span className="text-green-700 bg-green-50 rounded-full px-2 py-0.5 text-xs">
                      Activ
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-xs">
                      Inactiv
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/drivers/${d.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/drivers/${d.id}`} confirmText={`Ștergi șoferul ${d.name}?`} />
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Niciun șofer încă. Adaugă primul mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
