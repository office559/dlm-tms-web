import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { DeleteButton } from "@/components/DeleteButton";

export default async function CustomersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const customers = await listCustomers();

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Clienți</h1>
          <p className="text-slate-600 mt-1">Lista clienților și brokerilor.</p>
        </div>
        <a href="/customers/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă client
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Nume</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Cod</th>
              <th className="px-4 py-3">Termen plată</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.type || "—"}</td>
                <td className="px-4 py-3">{c.code || "—"}</td>
                <td className="px-4 py-3">{c.term_days != null ? `${c.term_days} zile` : "—"}</td>
                <td className="px-4 py-3">{c.email || "—"}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <a href={`/customers/${c.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/customers/${c.id}`} confirmText={`Ștergi clientul ${c.name}?`} />
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Niciun client încă. Adaugă primul mai sus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
