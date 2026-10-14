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
  weeklyRestSuggestionByVehicle,
  vehicleExtrasByVehicle,
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

const VALID_STATES = STATE_TABS.filter((t) => t.key !== "toate").map((t) => t.key);

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;

  // Filtre multiple: ?stare=disponibil,alocat
  const selected = new Set(
    (params.stare ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID_STATES.includes(s))
  );

  const [allVehicles, drivers, trailers] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listTrailers(),
  ]);

  // Vehiculele inactive nu apar în Planificare (rămân în lista de Vehicule).
  const vehicles = allVehicles.filter((v) => v.active);

  const trailerById = new Map(trailers.map((t) => [t.id, t]));
  const vehicleIds = vehicles.map((v) => v.id);
  const [jobsByVehicle, lastUnloadByVehicle, weeklyRestSuggestion, extrasByVehicle] =
    await Promise.all([
      currentJobsByVehicle(vehicleIds),
      lastUnloadPlaceByVehicle(vehicleIds),
      weeklyRestSuggestionByVehicle(vehicleIds),
      vehicleExtrasByVehicle(vehicleIds),
    ]);

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job) }))
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const filteredRows =
    selected.size === 0 ? allRows : allRows.filter((r) => selected.has(r.state));

  const rows: PlanningRow[] = filteredRows.map(({ v, job, state }) => {
    const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;
    const extras = extrasByVehicle.get(v.id);

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
      crewType: extras?.crewType ?? null,
      note: extras?.note ?? null,
      programStart: v.program_start,
      programEnd: v.program_end,
      programStartAt: v.program_start_at ? v.program_start_at.toString() : null,
      programEndAt: v.program_end_at ? v.program_end_at.toString() : null,
      pause: v.pause,
      restStart: v.rest_start,
      restEnd: v.rest_end,
      restEndAt: v.rest_end_at ? v.rest_end_at.toString() : null,
      weeklyRest: v.weekly_rest,
      weeklyRestType: v.weekly_rest_type,
      weeklyRestStart: v.weekly_rest_start,
      weeklyRestEnd: v.weekly_rest_end,
      weeklyRestEndAt: v.weekly_rest_end_at ? v.weekly_rest_end_at.toString() : null,
      weeklyRestSuggested: weeklyRestSuggestion.get(v.id) ?? "45",
      location: v.location,
      fallbackLocation: lastUnloadByVehicle.get(v.id) ?? null,
      loadPlace: job?.load_place ?? null,
      unloadPlace: job?.unload_place ?? null,
      loadDateLabel: job?.start_at ? `${fmtDate(job.start_at)} ${fmtTime(job.start_at)}` : "",
      unloadDateLabel: job?.end_at ? `${fmtDate(job.end_at)} ${fmtTime(job.end_at)}` : "",
      waState,
      waRead,
      cases: v.cases ?? [],
    };
  });

  const emptyMessage =
    selected.size === 0
      ? "Niciun vehicul activ găsit. Adaugă sau activează vehicule în secțiunea Vehicule."
      : "Niciun vehicul în categoriile selectate.";

  // Link pentru un filtru: adaugă sau scoate starea din selecție.
  function tabHref(key: string) {
    if (key === "toate") return "/planning";
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size === 0) return "/planning";
    // păstrăm ordinea din bara de filtre
    const ordered = VALID_STATES.filter((s) => next.has(s));
    return `/planning?stare=${ordered.join(",")}`;
  }

  return (
    <AppShell active="planning" crumb="Planificare" wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Planificare</h1>
          <p className="text-slate-600 mt-1">
            Stare live a flotei — vehicul, șofer, program, pauză, locație și cursa curentă.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((t) => {
            const isOn = t.key === "toate" ? selected.size === 0 : selected.has(t.key);
            const tabClass = isOn
              ? "rounded-full px-3 py-1.5 text-sm font-medium transition bg-brand text-white"
              : "rounded-full px-3 py-1.5 text-sm font-medium transition bg-white border border-slate-200 text-slate-600 hover:border-brand";
            return (
              <a key={t.key} href={tabHref(t.key)} className={tabClass}>
                {t.label} ({counts[t.key] ?? 0})
              </a>
            );
          })}
        </div>

        <PlanningTable
          rows={rows}
          drivers={drivers.map((d) => ({
            id: d.id,
            name: d.fictive_name ? `${d.name} / ${d.fictive_name}` : d.name,
          }))}
          emptyMessage={emptyMessage}
        />
      </div>
    </AppShell>
  );
}
