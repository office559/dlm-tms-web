
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { AppShell } from "@/components/AppShell";
import {
  fleetState,
  currentJobsByVehicle,
  lastUnloadPlaceByVehicle,
} from "@/lib/fleet";
import { PlanningTable } from "@/components/PlanningTable";
import type { PlanningRow } from "@/components/PlanningTable";

function fmtDate(s: string | Date | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ro-RO");
}

function fmtTime(s: string | Date | null) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
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
  const vehicleIds = vehicles.map((v) => v.id);
  const [jobsByVehicle, lastUnloadByVehicle] = await Promise.all([
    currentJobsByVehicle(vehicleIds),
    lastUnloadPlaceByVehicle(vehicleIds),
  ]);

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job) }))
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const filteredRows =
    activeFilter === "toate" ? allRows : allRows.filter((r) => r.state === activeFilter);

  const rows: PlanningRow[] = filteredRows.map(({ v, job, state }) => {
    const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;

    let loadingPct: number | null = null;
    if (job && job.status === "activ" && job.start_at && job.end_at) {
      const st = new Date(job.start_at).getTime();
      const en = new Date(job.end_at).getTime();
      const now = Date.now();
      loadingPct =
        en > st ? Math.min(100, Math.max(0, Math.round(((now - st) / (en - st)) * 100))) : 0;
    }

    let waState: "none" | "pending" | "confirmed" = "none";
    let waRead = false;
    if (job?.wa_message_sid) {
      waState = job.wa_confirmed_at ? "confirmed" : "pending";
      waRead = Boolean(job.wa_read_at);
    }

    return {
      vehicleId: v.id,
      plate: v.plate,
      trailerPlate: trailer?.plate ?? null,
      trailerType: trailer?.type ?? null,
      state,
      jobId: job ? job.id : null,
      jobRef: job?.ref ?? null,
      jobDateLabel: job?.start_at ? fmtDate(job.start_at) : "—",
      driverId: v.driver_id,
      programStart: v.program_start,
      programEnd: v.program_end,
      programStartAt: v.program_start_at ? v.program_start_at.toString() : null,
      programEndAt: v.program_end_at ? v.program_end_at.toString() : null,
      pause: v.pause,
      restStart: v.rest_start,
      restEnd: v.rest_end,
      restEndAt: v.rest_end_at ? v.rest_end_at.toString() : null,
      location: v.location,
      fallbackLocation: lastUnloadByVehicle.get(v.id) ?? null,
      loadPlace: job?.load_place ?? null,
      unloadPlace: job?.unload_place ?? null,
      traseuDateLabel: job
        ? `ÎNC ${fmtDate(job.start_at)} ${fmtTime(job.start_at)} · DESC ${fmtDate(job.end_at)} ${fmtTime(job.end_at)}`
        : "",
      loadingPct,
      waState,
      waRead,
    };
  });

  const emptyMessage =
    activeFilter === "toate"
      ? "Niciun vehicul găsit. Adaugă vehicule în secțiunea Vehicule."
      : "Niciun vehicul în această categorie.";

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

        <PlanningTable
          rows={rows}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          emptyMessage={emptyMessage}
        />

        <p className="text-xs text-slate-400">
          Notele de tip „Cazuri" vor fi adăugate într-un pas următor.
        </p>
      </div>
    </AppShell>
  );
}
