import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listDrivers } from "@/lib/drivers";
import { getSettings } from "@/lib/settings";
import { DeleteButton } from "@/components/DeleteButton";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { matchesQuery } from "@/lib/search";
import { waLink } from "@/lib/whatsapp";
import { AppShell } from "@/components/AppShell";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q = "" } = await searchParams;

  const [drivers, settings] = await Promise.all([listDrivers(), getSettings()]);
  const waCountry = settings?.wa_country ?? null;

  const filteredDrivers = drivers.filter((d) => matchesQuery([d.name, d.phone], q));

  return (
    <AppShell active="drivers" crumb="Șoferi">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Șoferi</h1>
          <p className="text-slate-600 mt-1">Lista șoferilor din flotă.</p>
        </div>
        <a href="/drivers/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă șofer
        </a>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Caută după nume, telefon..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
          Caută
        </button>
        {q && (
          <a href="/drivers" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-500 hover:bg-slate-50 transition">
            Resetează
          </a>
        )}
      </form>

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
            {filteredDrivers.map((d) => (
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
                  <WhatsAppLink
                    href={waLink(d.phone, waCountry, `Bună, ${d.name}!`)}
                  />
                  <a href={`/drivers/${d.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                  <DeleteButton url={`/api/drivers/${d.id}`} confirmText={`Ștergi șoferul ${d.name}?`} />
                </td>
              </tr>
            ))}
            {filteredDrivers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {q ? `Niciun șofer găsit pentru „${q}".` : "Niciun șofer încă. Adaugă primul mai sus."}
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
