import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";
import { listDrivers } from "@/lib/drivers";
import { listTrailers } from "@/lib/trailers";
import { listCustomers } from "@/lib/customers";
import { AppShell } from "@/components/AppShell";
import { formatDateInTz, formatTimeInTz } from "@/lib/tz";
import { getUserTimezone } from "@/lib/user-prefs";
import {
  fleetState,
  clearExpiredPauses,
  currentJobsByVehicle,
  plannedJobsByVehicle,
  lastUnloadPlaceByVehicle,
  weeklyRestSuggestionByVehicle,
  vehicleExtrasByVehicle,
} from "@/lib/fleet";
import { cabotageByVehicle } from "@/lib/cabotage";
import { PlanningTable } from "@/components/PlanningTable";
import type { PlanningRow } from "@/components/PlanningTable";

/** Moment (Date sau text) → text ISO, ca să poată fi citit corect în browser. */
function iso(s: string | Date | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Moment (Date sau text) → milisecunde; null dacă lipsește sau e invalid. */
function ms(s: string | Date | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

const STATE_ORDER: Record<string, number> = {
  pending: -1,
  pauza: 0,
  disponibil: 1,
  indisponibil: 2,
  alocat: 3,
  tranzit: 4,
  stationare: 5,
};

const STATE_TABS: { key: string; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "pending", label: "Pending" },
  { key: "disponibil", label: "Disponibil" },
  { key: "alocat", label: "Viitor" },
  { key: "tranzit", label: "Tranzit" },
  { key: "pauza", label: "Pauză" },
  { key: "indisponibil", label: "Indisponibil" },
  { key: "stationare", label: "Staționare" },
];

/**
 * Cheia de ordonare în cadrul aceleiași stări (milisecunde; mai mic = mai sus).
 *  - Pauză: momentul în care se termină pauza (zilnică sau săptămânală) — în
 *    ordine inversă: mașina care termină pauza ultima apare prima;
 *  - Viitor: momentul încărcării cursei următoare.
 */
function orderKey(
  state: string,
  v: {
    pause: boolean;
    rest_end_at: string | Date | null;
    weekly_rest: boolean;
    weekly_rest_end_at: string | Date | null;
  },
  job: { start_at: string | Date | null } | null
): number | null {
  if (state === "pauza") {
    const ends = [
      v.pause ? ms(v.rest_end_at) : null,
      v.weekly_rest ? ms(v.weekly_rest_end_at) : null,
    ].filter((x): x is number => x !== null);
    return ends.length ? Math.max(...ends) : null;
  }
  if (state === "alocat") return ms(job?.start_at ?? null);
  return null;
}

const VALID_STATES = STATE_TABS.filter((t) => t.key !== "toate").map((t) => t.key);

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Orele de încărcare / descărcare ale curselor se introduc în formular ca
  // oră locală a locului respectiv (ex. 14:00 din comanda Amazon) și se salvează
  // exact așa. Le afișăm neschimbate, nu convertite în fusul orar ales în Setări.
  const fmtDate = (s: string | Date | null) => formatDateInTz(s, "UTC");
  const fmtTime = (s: string | Date | null) => formatTimeInTz(s, "UTC");

  const params = await searchParams;
  const userTz = await getUserTimezone(session.user.id);

  // Filtre multiple: ?stare=disponibil,alocat
  const selected = new Set(
    (params.stare ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID_STATES.includes(s))
  );

  // Interogările rulează cât mai mult în paralel (mai puține "drumuri" până la
  // baza de date): întâi se curăță pauzele/programele expirate, apoi se citesc
  // vehiculele; șoferii, remorcile și clienții se citesc în același timp.
  const vehiclesP = clearExpiredPauses().then(() => listVehicles());
  // Vehiculele inactive nu apar în Planificare (rămân în lista de Vehicule).
  const activeIdsP = vehiclesP.then((all) => all.filter((v) => v.active).map((v) => v.id));

  const [
    allVehicles,
    drivers,
    trailers,
    customers,
    jobsByVehicle,
    plannedByVehicle,
    lastUnloadByVehicle,
    weeklyRestSuggestion,
    extrasByVehicle,
    cabotageMap,
  ] = await Promise.all([
    vehiclesP,
    listDrivers(),
    listTrailers(),
    listCustomers(),
    activeIdsP.then((ids) => currentJobsByVehicle(ids, { skipClear: true })),
    activeIdsP.then((ids) => plannedJobsByVehicle(ids)),
    activeIdsP.then((ids) => lastUnloadPlaceByVehicle(ids)),
    activeIdsP.then((ids) => weeklyRestSuggestionByVehicle(ids)),
    activeIdsP.then((ids) => vehicleExtrasByVehicle(ids)),
    activeIdsP.then((ids) => cabotageByVehicle(ids)),
  ]);

  // Codul (SCAC) fiecărui client, după id-ul clientului.
  const codeByClient = new Map(customers.map((c) => [c.id, c.code]));

  const vehicles = allVehicles.filter((v) => v.active);
  const trailerById = new Map(trailers.map((t) => [t.id, t]));

  const allRows = vehicles
    .map((v) => ({ v, job: jobsByVehicle.get(v.id) ?? null }))
    .map((x) => ({ ...x, state: fleetState(x.v, x.job, userTz) }))
    .sort((a, b) => {
      // 1) grupat pe stare
      const byState = (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9);
      if (byState !== 0) return byState;
      // 2) în cadrul stării: Pauză = în ordinea în care se termină pauza,
      //    Viitor = în ordinea în care încarcă. Fără oră → la sfârșit.
      //    (Pauză: invers — cea care termină ultima e prima.)
      const ka = orderKey(a.state, a.v, a.job);
      const kb = orderKey(b.state, b.v, b.job);
      if (ka === null && kb === null) return 0;
      if (ka === null) return 1;
      if (kb === null) return -1;
      // Pauză: invers (cea care termină ultima e prima). Celelalte: crescător.
      return a.state === "pauza" ? kb - ka : ka - kb;
    });

  const counts: Record<string, number> = { toate: allRows.length };
  for (const r of allRows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const filteredRows =
    selected.size === 0 ? allRows : allRows.filter((r) => selected.has(r.state));

  const rows: PlanningRow[] = filteredRows.map(({ v, job, state }) => {
    const trailer = v.trailer_id ? trailerById.get(v.trailer_id) ?? null : null;
    const extras = extrasByVehicle.get(v.id);

    // Cursele următoare: planificate și diferite de cea afișată acum în rând.
    const upcoming = (plannedByVehicle.get(v.id) ?? []).filter((j) => j.id !== job?.id);

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
      scac: job?.client_id ? codeByClient.get(job.client_id) ?? null : null,
      nextJobRef: upcoming[0] ? upcoming[0].ref || upcoming[0].id : null,
      nextJobCount: upcoming.length,
      jobDateLabel: job?.start_at ? fmtDate(job.start_at) : "—",
      driverId: v.driver_id,
      crewType: extras?.crewType ?? null,
      note: extras?.note ?? null,
      programStart: v.program_start,
      programEnd: v.program_end,
      programStartAt: iso(v.program_start_at),
      programEndAt: iso(v.program_end_at),
      cabotage: cabotageMap.get(v.id) ?? null,
      pause: v.pause,
      restStart: v.rest_start,
      restEnd: v.rest_end,
      restStartAt: iso(v.rest_start_at),
      restEndAt: iso(v.rest_end_at),
      weeklyRest: v.weekly_rest,
      weeklyRestType: v.weekly_rest_type,
      weeklyRestStart: v.weekly_rest_start,
      weeklyRestEnd: v.weekly_rest_end,
      weeklyRestStartAt: iso(v.weekly_rest_start_at),
      weeklyRestEndAt: iso(v.weekly_rest_end_at),
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
