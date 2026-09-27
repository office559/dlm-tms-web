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
  if (v.pause) return "pauza";
  if (currentJob && currentJob.status === "planificare") return "alocat";
  if (!v.driver_id) return "indisponibil";
  return "disponibil";
}

/**
 * Pentru fiecare vehicul din listă, găsește cursa lui curentă sau
 * următoare (status planificare/activ), preferând cea aflată deja în
 * desfășurare.
 */
export async function currentJobsByVehicle(vehicleIds: string[]): Promise<Map<string, Job>> {
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
 * pauza curentă e finalizată și câmpurile din `vehicles` sunt resetate.
 */
async function logWeeklyRestStart(
  vehicleId: string,
  type: string,
  startAt: string,
  endAt: string
) {
  await pool.query(
    `insert into vehicle_weekly_rest_log (vehicle_id, type, start_at, end_at)
     values ($1, $2, $3, $4)`,
    [vehicleId, type, startAt, endAt]
  );
}

/** Actualizare rapidă a unui vehicul din tabelul de Planificare (fără să ceară tot formularul). */
export async function patchVehicleQuick(
  id: string,
  fields: {
    driverId?: string | null;
    location?: string | null;
    pause?: boolean;
    programStart?: string | null;
    programEnd?: string | null;
    programStartAt?: string | null;
    programEndAt?: string | null;
    restDurH?: number | null;
    restStart?: string | null;
    restEnd?: string | null;
    restStartAt?: string | null;
    restEndAt?: string | null;
    weeklyRest?: boolean;
    weeklyRestType?: string | null;
    weeklyRestStart?: string | null;
    weeklyRestEnd?: string | null;
    weeklyRestStartAt?: string | null;
    weeklyRestEndAt?: string | null;
    stateOverride?: string | null;
    casesAdd?: string;
    casesRemove?: string;
  }
) {
  const sets: string[] = [];
  const vals: unknown[] = [id];
  if (fields.driverId !== undefined) {
    vals.push(fields.driverId || null);
    sets.push(`driver_id = $${vals.length}`);
  }
  if (fields.location !== undefined) {
    vals.push(fields.location || null);
    sets.push(`location = $${vals.length}`);
  }
  if (fields.pause !== undefined) {
    vals.push(fields.pause);
    sets.push(`pause = $${vals.length}`);
  }
  if (fields.programStart !== undefined) {
    vals.push(fields.programStart || null);
    sets.push(`program_start = $${vals.length}`);
  }
  if (fields.programEnd !== undefined) {
    vals.push(fields.programEnd || null);
    sets.push(`program_end = $${vals.length}`);
  }
  if (fields.programStartAt !== undefined) {
    vals.push(fields.programStartAt || null);
    sets.push(`program_start_at = $${vals.length}`);
  }
  if (fields.programEndAt !== undefined) {
    vals.push(fields.programEndAt || null);
    sets.push(`program_end_at = $${vals.length}`);
  }
  if (fields.restDurH !== undefined) {
    vals.push(fields.restDurH ?? null);
    sets.push(`rest_dur_h = $${vals.length}`);
  }
  if (fields.restStart !== undefined) {
    vals.push(fields.restStart || null);
    sets.push(`rest_start = $${vals.length}`);
  }
  if (fields.restEnd !== undefined) {
    vals.push(fields.restEnd || null);
    sets.push(`rest_end = $${vals.length}`);
  }
  if (fields.restStartAt !== undefined) {
    vals.push(fields.restStartAt || null);
    sets.push(`rest_start_at = $${vals.length}`);
  }
  if (fields.restEndAt !== undefined) {
    vals.push(fields.restEndAt || null);
    sets.push(`rest_end_at = $${vals.length}`);
  }
  if (fields.weeklyRest !== undefined) {
    vals.push(fields.weeklyRest);
    sets.push(`weekly_rest = $${vals.length}`);
  }
  if (fields.weeklyRestType !== undefined) {
    vals.push(fields.weeklyRestType || null);
    sets.push(`weekly_rest_type = $${vals.length}`);
  }
  if (fields.weeklyRestStart !== undefined) {
    vals.push(fields.weeklyRestStart || null);
    sets.push(`weekly_rest_start = $${vals.length}`);
  }
  if (fields.weeklyRestEnd !== undefined) {
    vals.push(fields.weeklyRestEnd || null);
    sets.push(`weekly_rest_end = $${vals.length}`);
  }
  if (fields.weeklyRestStartAt !== undefined) {
    vals.push(fields.weeklyRestStartAt || null);
    sets.push(`weekly_rest_start_at = $${vals.length}`);
  }
  if (fields.weeklyRestEndAt !== undefined) {
    vals.push(fields.weeklyRestEndAt || null);
    sets.push(`weekly_rest_end_at = $${vals.length}`);
  }
  if (fields.stateOverride !== undefined) {
    vals.push(fields.stateOverride || null);
    sets.push(`state_override = $${vals.length}`);
  }
  if (fields.casesAdd) {
    vals.push(fields.casesAdd);
    sets.push(`cases = array_append(coalesce(cases, '{}'), $${vals.length})`);
  }
  if (fields.casesRemove) {
    vals.push(fields.casesRemove);
    sets.push(`cases = array_remove(cases, $${vals.length})`);
  }

  if (
    fields.weeklyRest === true &&
    fields.weeklyRestType &&
    fields.weeklyRestStartAt &&
    fields.weeklyRestEndAt
  ) {
    await logWeeklyRestStart(
      id,
      fields.weeklyRestType,
      fields.weeklyRestStartAt,
      fields.weeklyRestEndAt
    );
  }

  if (sets.length === 0) return;
  await pool.query(`update vehicles set ${sets.join(", ")} where id = $1`, vals);
}
