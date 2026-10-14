import { pool } from "@/lib/db";
import type { Vehicle } from "@/lib/vehicles";
import type { Job } from "@/lib/jobs";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_LABELS, FLEET_STATE_STYLES, FLEET_ROW_STYLES } from "@/lib/fleet-labels";

// Reexportate pentru compatibilitate — fișierele client (ex. PlanningCells.tsx)
// importă tipul și etichetele din "@/lib/fleet-labels" direct, ca să nu tragă
// "pg" (server-only) în bundle-ul de client.
export type { FleetState };
export { FLEET_STATE_LABELS, FLEET_STATE_STYLES, FLEET_ROW_STYLES };

/**
 * True dacă vehiculul are o pauză cu oră de sfârșit care a trecut deja.
 * Bifa `pause` rămâne true în baza de date după ce pauza expiră, așa că
 * starea se calculează aici, în funcție de ora curentă.
 */
function pauseEnded(v: Vehicle): boolean {
  const raw = (v as unknown as { rest_end_at?: string | Date | null }).rest_end_at;
  if (!raw) return false;
  const end = new Date(raw).getTime();
  if (Number.isNaN(end)) return false;
  return end <= Date.now();
}

/**
 * Starea unui vehicul în Planificare, derivată din datele reale (nu mai e
 * stocată separat): activ/inactiv, suprascriere manuală, cursa curentă și
 * pauza. Oglindește logica din macheta veche, adaptată la statusurile
 * reale de cursă din aplicație (planificare / activ / finalizat / anulat).
 */
export function fleetState(v: Vehicle, currentJob: Job | null): FleetState {
  if (!v.active) return "stationare";
  if (v.state_override === "stationare") return "stationare";
  if (currentJob && currentJob.status === "activ") return "tranzit";
  if (v.state_override === "indisponibil") return "indisponibil";
  if (v.pause && !pauseEnded(v)) return "pauza";
  if (currentJob && currentJob.status === "planificare") return "alocat";
  if (!v.driver_id) return "indisponibil";
  return "disponibil";
}

/**
 * Șterge pauzele scurte care au expirat: scoate bifa de pauză și orele
 * (start/sfârșit/durată), ca vehiculul să apară curat în Planificare.
 * Se apelează la încărcarea tabelului; erorile sunt ignorate ca să nu
 * blocheze pagina.
 */
async function clearExpiredPauses() {
  try {
    await pool.query(
      `update vehicles
          set pause = false,
              rest_dur_h = null,
              rest_start = null,
              rest_end = null,
              rest_start_at = null,
              rest_end_at = null
        where pause = true
          and rest_end_at is not null
          and rest_end_at <= now()`
    );
  } catch {
    // ignorăm — curățarea se va încerca din nou la următoarea încărcare
  }
}

/**
 * Pentru fiecare vehicul din listă, găsește cursa lui curentă sau
 * următoare (status planificare/activ), preferând cea aflată deja în
 * desfășurare.
 */
export async function currentJobsByVehicle(vehicleIds: string[]): Promise<Map<string, Job>> {
  await clearExpiredPauses();
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await pool.query<Job>(
    `select distinct on (vehicle_id) *
       from jobs
      where vehicle_id = any($1)
        and status in ('planificare', 'activ')
      order by vehicle_id, (status = 'activ') desc, start_at asc nulls last`,
    [vehicleIds]
  );
  const map = new Map<string, Job>();
  rows.forEach((j) => {
    if (j.vehicle_id) map.set(j.vehicle_id, j);
  });
  return map;
}

/**
 * Pentru vehiculele fără locație setată manual, ultima locație de
 * descărcare (din ultima cursă finalizată) — folosită ca valoare automată
 * în Planificare, până când dispecerul o schimbă manual.
 */
export async function lastUnloadPlaceByVehicle(vehicleIds: string[]): Promise<Map<string, string>> {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await pool.query<{ vehicle_id: string; unload_place: string | null }>(
    `select distinct on (vehicle_id) vehicle_id, unload_place
       from jobs
      where vehicle_id = any($1)
        and status = 'finalizat'
        and unload_place is not null
      order by vehicle_id, coalesce(end_at, start_at, created_at) desc`,
    [vehicleIds]
  );
  const map = new Map<string, string>();
  rows.forEach((r) => {
    if (r.unload_place) map.set(r.vehicle_id, r.unload_place);
  });
  return map;
}

/**
 * Notița și tipul de echipaj (single / team) ale fiecărui vehicul, citite
 * direct din baza de date. Dacă coloanele nu există încă, întoarce o listă
 * goală, ca pagina Planificare să nu se strice.
 */
export async function vehicleExtrasByVehicle(
  vehicleIds: string[]
): Promise<Map<string, { note: string | null; crewType: string | null }>> {
  const map = new Map<string, { note: string | null; crewType: string | null }>();
  if (vehicleIds.length === 0) return map;
  try {
    const { rows } = await pool.query<{
      id: string;
      note: string | null;
      crew_type: string | null;
    }>(`select id, note, crew_type from vehicles where id = any($1)`, [vehicleIds]);
    rows.forEach((r) => map.set(r.id, { note: r.note, crewType: r.crew_type }));
  } catch {
    // coloanele note / crew_type nu există încă — rulează SQL-ul din Supabase
  }
  return map;
}

/**
 * Ultimul tip de pauză săptămânală (45h / 24h) făcut de fiecare vehicul,
 * din istoricul salvat la fiecare pornire de pauză săptămânală (vezi
 * `logWeeklyRestStart` mai jos) — folosit ca să se calculeze automat
 * sugestia pentru săptămâna următoare.
 */
async function lastWeeklyRestTypeByVehicle(vehicleIds: string[]): Promise<Map<string, string>> {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await pool.query<{ vehicle_id: string; type: string }>(
    `select distinct on (vehicle_id) vehicle_id, type
       from vehicle_weekly_rest_log
      where vehicle_id = any($1)
      order by vehicle_id, start_at desc`,
    [vehicleIds]
  );
  const map = new Map<string, string>();
  rows.forEach((r) => map.set(r.vehicle_id, r.type));
  return map;
}

/**
 * Sugestia de pauză săptămânală pentru fiecare vehicul (45h sau 24h),
 * calculată din ultima pauză săptămânală înregistrată: dacă ultima a fost
 * redusă (24h), următoarea TREBUIE să fie normală (45h, conform regulii —
 * nu poți lua 24h de două ori la rând); dacă ultima a fost normală (45h),
 * se sugerează alternarea la 24h; dacă nu există niciun istoric, se
 * sugerează 45h ca punct de plecare sigur. Dispecerul poate oricând alege
 * manual altă variantă din popup — e doar o sugestie, nu o blocare.
 */
export async function weeklyRestSuggestionByVehicle(
  vehicleIds: string[]
): Promise<Map<string, "45" | "24">> {
  const last = await lastWeeklyRestTypeByVehicle(vehicleIds);
  const map = new Map<string, "45" | "24">();
  for (const id of vehicleIds) {
    const lastType = last.get(id);
    map.set(id, lastType === "24" ? "45" : lastType === "45" ? "24" : "45");
  }
  return map;
}

/**
 * Salvează în istoric o pauză săptămânală pornită (tip + interval exact),
 * ca să rămână disponibilă pentru calculul sugestiei chiar și după ce
 * pauza curentă e
