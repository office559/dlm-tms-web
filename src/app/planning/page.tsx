import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { AppShell } from "@/components/AppShell";
import {
  fleetState,
  FLEET_STATE_LABELS,
  FLEET_STATE_STYLES,
  currentJobsByVehicle,
} from "@/lib/fleet";
import {
  DriverSelect,
  LocationInput,
  PauseControl,
  ProgramEditor,
  JobStatusControl,
} from "@/components/PlanningCells";
import type { Job } from "@/lib/jobs";

function fmtDate(s: string | Date | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ro-RO");
}

function fmtTime(s: string | Date | null) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function waBadge(job: Job | null) {
  if (!job || !job.wa_message_sid) return <span className="text-slate-300 text-xs">—</span>;
  if (job.wa_confirmed_at) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs text-green-700 bg-green-50">Confirmat</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full px-2 py-0.5 text-xs text-amber-700 bg-amber-50">Pending</span>
      {job.wa_read_at && <span className="text-slate-400 text-xs">(citit)</span>}
    </span>
  );
}

const STATE_ORDER: Record<string, number> = {
  pauza: 0,
  disponibil: 1,
  indisponibil: 2,
  alocat: 3,
  tranzit: 4,
  stationare: 5,
};

const STATE_TABS: { key: string; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "disponibil", label: "Disponibil" },
  { key: "alocat", label: "Viitor" },
  { key: "tranzit", label: "Tranzit" },
  { key: "pauza", label: "Pauză" },
  { key: "indisponibil", label: "Indisponibil" },
  { key: "stationare", label: "Staționare" },
];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const activeFilter =
    params.stare && STATE_TABS.some((t) => t.key === params.stare) ? params.stare : "toate";

  const [vehicles, drivers, trailers] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
  ]);

  const trailerById = new Map(trailers.map((t) => [t.id, t]));
  const jobsByVehicle = await currentJobsByVehicle(vehicles.map((v) => v.id));

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job) }))
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const rows = activeFilter === "toate" ? allRows : allRows.filter((r) => r.state === activeFilter);

  return (
    <AppShell active="planning" crumb="Planificare">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Planificare</h1>
          <p className="text-slate-600 mt-1">
            Stare live a flotei — vehicul, șofer, program, pauză, locație și cursa curentă.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((t) => {
            const tabClass = activeFilter === t.key
              ? "rounded-full px-3 py-1.5 text-sm font-medium transition bg-brand text-white"
              : "rounded-full px-3 py-1.5 text-sm font-medium transition bg-white border border-slate-200 text-slate-600 hover:border-brand";
            const tabHref = t.key === "toate" ? "/planning" : `/planning?stare=${t.key}`;
            return (
              <a key={t.key} href={tabHref} className={tabClass}>
                {t.label} ({counts[t.key] ?? 0})
              </a>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Vehicul</th>
                <th className="px-4 py-3 whitespace-nowrap">VRID</th>
                <th className="px-4 py-3 whitespace-nowrap">Dată</th>
                <th className="px-4 py-3 whitespace-nowrap">Stare</th>
                <th className="px-4 py-3 whitespace-nowrap">Șofer</th>
                <th className="px-4 py-3 whitespace-nowrap">Program</th>
                <th className="px-4 py-3 whitespace-nowrap">Pauză</th>
                <th className="px-4 py-3 whitespace-nowrap">Locație</th>
                <th className="px-4 py-3 whitespace-nowrap">ÎNC - DSC</th>
                <th className="px-4 py-3 whitespace-nowrap">Loading</th>
                <th className="px-4 py-3 whitespace-nowrap">Cazuri</th>
                <th className="px-4 py-3 whitespace-nowrap">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, job, state }) => {
                const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;
                let loadingPct: number | null = null;
                if (job && job.status === "activ" && job.start_at && job.end_at) {
                  const st = new Date(job.start_at).getTime();
                  const en = new Date(job.end_at).getTime();
                  const now = Date.now();
                  loadingPct =
                    en > st ? Math.min(100, Math.max(0, Math.round(((now - st) / (en - st)) * 100))) : 0;
                }
                return (
                  <tr key={v.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {v.plate}
                        {trailer ? ` / ${trailer.plate}` : ""}
                      </div>
                      {v.type && <div className="text-xs text-slate-400">{v.type}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {job ? (
                        <a href={`/jobs/${job.id}`} className="text-brand hover:text-brand-dark">
                          {job.ref || job.id}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {job?.start_at ? fmtDate(job.start_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${FLEET_STATE_STYLES[state]}`}>
                        {FLEET_STATE_LABELS[state]}
                      </span>
                      {job && (job.status === "planificare" || job.status === "activ") && (
                        <JobStatusControl jobId={job.id} status={job.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DriverSelect
                        vehicleId={v.id}
                        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
                        value={v.driver_id}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ProgramEditor
                        vehicleId={v.id}
                        programStart={v.program_start}
                        programEnd={v.program_end}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PauseControl vehicleId={v.id} value={v.pause} restDurH={v.rest_dur_h} />
                      {v.rest_start && v.rest_end && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {v.rest_start} – {v.rest_end}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LocationInput vehicleId={v.id} value={v.location} />
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      {job ? (
                        <>
                          <div className="text-xs">
                            {job.load_place || "—"} → {job.unload_place || "—"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            ÎNC {fmtDate(job.start_at)} {fmtTime(job.start_at)} · DESC {fmtDate(job.end_at)}{" "}
                            {fmtTime(job.end_at)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {loadingPct === null ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        <div className="w-16">
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-brand" style={{ width: `${loadingPct}%` }} />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{loadingPct}%</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-xs" title="În curând">
                        —
                      </span>
                    </td>
                    <td className="px-4 py-3">{waBadge(job)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-6 text-center text-slate-400">
                    {activeFilter === "toate"
                      ? "Niciun vehicul găsit. Adaugă vehicule în secțiunea Vehicule."
                      : "Niciun vehicul în această categorie."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Notele de tip „Cazuri" vor fi adăugate într-un pas următor.
        </p>
      </div>
    </AppShell>
  );
}
