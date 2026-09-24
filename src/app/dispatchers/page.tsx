import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listDispatchers } from "@/lib/db";
import { InviteDispatcherForm } from "@/components/InviteDispatcherForm";
import { AppShell } from "@/components/AppShell";

export default async function DispatchersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const dispatchers = await listDispatchers();

  return (
    <AppShell active="dispatchers" crumb="Dispeceri">
      <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-dark">Dispeceri</h1>
        <p className="text-slate-600 mt-1">
          Adaugă un dispecer nou și primește automat un email cu link de activare cont.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <InviteDispatcherForm />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Nume</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Adăugat</th>
            </tr>
          </thead>
          <tbody>
            {dispatchers.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.email}</td>
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
                <td className="px-4 py-3 text-slate-500">
                  {new Date(d.created_at).toLocaleDateString("ro-RO")}
                </td>
              </tr>
            ))}
            {dispatchers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Niciun dispecer încă. Trimite prima invitație mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </AppShell>
  );
}
