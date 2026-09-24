import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";
import { listCustomers } from "@/lib/customers";
import { listDrivers } from "@/lib/drivers";
import { listVehicles } from "@/lib/vehicles";
import { getSettings } from "@/lib/settings";
import { DeleteButton } from "@/components/DeleteButton";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { matchesQuery } from "@/lib/search";
import { waLink } from "@/lib/whatsapp";

const STATUS_LABELS: Record<string, string> = {
  planificare: "Planificare",
  activ: "Activ",
  finalizat: "Finalizat",
  anulat: "Anulat",
};

const STATUS_STYLES: Record<string, string> = {
  planificare: "text-slate-600 bg-slate-100",
  activ: "text-blue-700 bg-blue-50",
  finalizat: "text-green-700 bg-green-50",
  anulat: "text-red-700 bg-red-50",
};

function WaConfirmBadge({
  waMessageSid,
  waReadAt,
  waConfirmedAt,
}: {
  waMessageSid: string | null;
  waReadAt: Date | null;
  waConfirmedAt: Date | null;
}) {
  if (!waMessageSid) return <span className="text-slate-300 text-xs">—</span>;

  if (waConfirmedAt) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs text-green-700 bg-green-50">
        Confirmat
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full px-2 py-0.5 text-xs text-amber-700 bg-amber-50">
        Pending
      </span>
      {waReadAt && <span className="text-slate-400 text-xs">(citit)</span>}
    </span>
  );
}

function jobMessage(j: {
  ref: string | null;
  load_place: string | null;
  unload_place: string | null;
  start_at: Date | null;
}, driverName: string, clientName: string | null) {
  const lines = [
    `Salut ${driverName}, cursă nouă:`,
    `${j.load_place || "—"} → ${j.unload_place || "—"}`,
  ];
  if (j.start_at) lines.push(`Start: ${new Date(j.start_at).toLocaleString("ro-RO")}`);
  if (clientName) lines.push(`Client: ${clientName}`);
  if (j.ref) lines.push(`Referință: ${j.ref}`);
  return lines.join("\n");
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q = "" } = await searchParams;

  const [jobs, customers, drivers, vehicles, settings] = await Promise.all([
    listJobs(),
    listCustomers(),
    listDrivers(),
    listVehicles(),
    getSettings(),
  ]);

  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const driverPhone = new Map(drivers.map((d) => [d.id, d.phone]));
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plate]));
  const waCountry = settings?.wa_country ?? null;

  const filteredJobs = jobs.filter((j) =>
    matchesQuery(
      [
        j.ref,
        j.load_place,
        j.unload_place,
        j.client_id ? customerName.get(j.client_id) : null,
        j.driver_id ? driverName.get(j.driver_id) : null,
        j.vehicle_id ? vehiclePlate.get(j.vehicle_id) : null,
      ],
      q
    )
  );

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Job Center</h1>
          <p className="text-slate-600 mt-1">Cursele planificate și în desfășurare.</p>
        </div>
        <a href="/jobs/new" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          + Adaugă cursă
        </a>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Caută după traseu, referință, client, șofer, vehicul..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
          Caută
        </button>
        {q && (
          <a href="/jobs" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-500 hover:bg-slate-50 transition">
            Resetează
          </a>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Traseu</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Șofer</th>
              <th className="px-4 py-3">Vehicul</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Tarif</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((j) => {
              const dName = j.driver_id ? driverName.get(j.driver_id) : null;
              const dPhone = j.driver_id ? driverPhone.get(j.driver_id) : null;
              const cName = j.client_id ? customerName.get(j.client_id) ?? null : null;
              const waHref = dName && dPhone ? waLink(dPhone, waCountry, jobMessage(j, dName, cName)) : null;
              return (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {j.load_place || "—"} → {j.unload_place || "—"}
                  </td>
                  <td className="px-4 py-3">{cName ?? "—"}</td>
                  <td className="px-4 py-3">{dName ?? "—"}</td>
                  <td className="px-4 py-3">{j.vehicle_id ? vehiclePlate.get(j.vehicle_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3">
                    {j.start_at ? new Date(j.start_at).toLocaleString("ro-RO") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {j.rate != null ? `${j.rate} ${j.currency ?? ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[j.status] ?? "text-slate-600 bg-slate-100"}`}>
                      {STATUS_LABELS[j.status] ?? j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <WaConfirmBadge
                      waMessageSid={j.wa_message_sid}
                      waReadAt={j.wa_read_at}
                      waConfirmedAt={j.wa_confirmed_at}
                    />
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <WhatsAppLink href={waHref} label="Anunță șofer" />
                    <a href={`/jobs/${j.id}`} className="text-brand hover:text-brand-dark text-sm">
                      Editează
                    </a>
                    <DeleteButton url={`/api/jobs/${j.id}`} confirmText={`Ștergi cursa ${j.ref || j.id}?`} />
                  </td>
                </tr>
              );
            })}
            {filteredJobs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  {q ? `Nicio cursă găsită pentru „${q}".` : "Nicio cursă încă. Adaugă prima mai sus."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
