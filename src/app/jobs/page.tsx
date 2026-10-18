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
import { AppShell } from "@/components/AppShell";

const STATUS_LABELS: Record<string, string> = {
  planificare: "Planificare",
  activ: "Activ",
  finalizat: "Finalizat",
  anulat: "Anulat",
};

const STATUS_STYLES: Record<string, string> = {
  planificare: "border-yellow-500 text-yellow-700",
  activ: "border-orange-500 text-orange-700",
  finalizat: "border-green-600 text-green-700",
  anulat: "border-red-600 text-red-700",
};

const STATUS_ORDER = ["planificare", "activ", "finalizat", "anulat"];

function fmtStart(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

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
      <span className="rounded-full border-2 border-green-600 bg-white px-2.5 py-0.5 text-[13px] font-bold text-green-700">
        Confirmat
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full border-2 border-amber-500 bg-white px-2.5 py-0.5 text-[13px] font-bold text-amber-700">
        Pending
      </span>
      {waReadAt && <span className="text-slate-500 text-xs font-semibold">(citit)</span>}
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

  // Cursele grupate pe client (alfabetic; cursele fără client la sfârșit).
  // În interiorul clientului rămâne ordinea din listă (cele mai noi primele).
  type JobRow = (typeof filteredJobs)[number];
  const groups: { key: string; name: string; jobs: JobRow[] }[] = [];
  for (const j of filteredJobs) {
    const key = j.client_id ?? "none";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        name: j.client_id ? customerName.get(j.client_id) ?? "Client necunoscut" : "Fără client",
        jobs: [],
      };
      groups.push(g);
    }
    g.jobs.push(j);
  }
  groups.sort((a, b) => {
    if (a.key === "none") return 1;
    if (b.key === "none") return -1;
    return a.name.localeCompare(b.name, "ro");
  });

  /** Totalul tarifelor unui client (fără cursele anulate), pe monede: "3634.71 € · 200 RON". */
  function groupTotal(list: JobRow[]): string {
    const byCurrency = new Map<string, number>();
    for (const j of list) {
      if (j.status === "anulat" || j.rate == null) continue;
      const cur = j.currency ?? "";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + Number(j.rate));
    }
    return Array.from(byCurrency.entries())
      .map(([cur, sum]) => `${sum.toFixed(2)} ${cur}`.trim())
      .join(" · ");
  }

  return (
    <AppShell active="jobs" crumb="Job Center">
      <div className="space-y-6">
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

      {groups.map((g) => {
        const total = groupTotal(g.jobs);
        return (
          <div key={g.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-[#1e3a5f] px-4 py-3 text-white">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-base font-extrabold">{g.name}</span>
                {STATUS_ORDER.map((st) => {
                  const n = g.jobs.filter((j) => j.status === st).length;
                  if (n === 0) return null;
                  return (
                    <span
                      key={st}
                      className={`rounded-full border-[1.5px] bg-white px-2 text-[11.5px] font-bold ${STATUS_STYLES[st]}`}
                    >
                      {STATUS_LABELS[st]} {n}
                    </span>
                  );
                })}
              </div>
              <div className="whitespace-nowrap text-[13px] font-semibold opacity-85">
                {g.jobs.length} {g.jobs.length === 1 ? "cursă" : "curse"}
                {total ? ` · total ${total}` : ""}
              </div>
            </div>
            <table className="w-full table-fixed text-[14.5px]">
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>
              <thead className="bg-orange-50 text-orange-800 text-left">
                <tr>
                  <th className="px-4 py-3">Traseu</th>
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
                {g.jobs.map((j) => {
                  const dName = j.driver_id ? driverName.get(j.driver_id) : null;
                  const dPhone = j.driver_id ? driverPhone.get(j.driver_id) : null;
                  const cName = j.client_id ? customerName.get(j.client_id) ?? null : null;
                  const waHref = dName && dPhone ? waLink(dPhone, waCountry, jobMessage(j, dName, cName)) : null;
                  return (
                    <tr key={j.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-extrabold">
                        {j.load_place || "—"} → {j.unload_place || "—"}
                      </td>
                      <td className="px-4 py-3">{dName ?? "—"}</td>
                      <td className="px-4 py-3">{j.vehicle_id ? vehiclePlate.get(j.vehicle_id) ?? "—" : "—"}</td>
                      <td className="px-4 py-3">{fmtStart(j.start_at)}</td>
                      <td className="px-4 py-3 font-extrabold">
                        {j.rate != null ? `${j.rate} ${j.currency ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border-2 bg-white px-2.5 py-0.5 text-[13px] font-bold ${
                            STATUS_STYLES[j.status] ?? "border-slate-400 text-slate-600"
                          }`}
                        >
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
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold space-x-3">
                        <WhatsAppLink href={waHref} label="Anunță șofer" />
                        <a href={`/jobs/${j.id}`} className="text-sm font-bold text-slate-900 hover:text-brand">
                          Editează
                        </a>
                        <DeleteButton url={`/api/jobs/${j.id}`} confirmText={`Ștergi cursa ${j.ref || j.id}?`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center text-slate-400">
          {q ? `Nicio cursă găsită pentru „${q}".` : "Nicio cursă încă. Adaugă prima mai sus."}
        </div>
      )}
      </div>
    </AppShell>
  );
}
