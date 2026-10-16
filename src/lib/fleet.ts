import { pool } from "@/lib/db";
import type { Vehicle } from "@/lib/vehicles";
import type { Job } from "@/lib/jobs";
import type { FleetState } from "@/lib/fleet-labels";
import { FLEET_STATE_LABELS, FLEET_STATE_STYLES, FLEET_ROW_STYLES } from "@/lib/fleet-labels";

// Reexportate pentru compatibilitate (fișierele client importă din fleet-labels).
export type { FleetState };
export { FLEET_STATE_LABELS, FLEET_STATE_STYLES, FLEET_ROW_STYLES };

/** True dacă pauza are oră de sfârșit care a trecut deja. */
function pauseEnded(v: Vehicle): boolean {
  const raw = (v as unknown as { rest_end_at?: string | Date | null }).rest_end_at;
  if (!raw) return false;
  const end = new Date(raw).getTime();
  if (Number.isNaN(end)) return false;
  return end <= Date.now();
}

/** Starea unui vehicul în Planificare, derivată din datele reale. */
export function fleetState(v: Vehicle, currentJob: Job | null): FleetState {
  if (!v.active) return "stationare";
  if (v.state_override === "stationare") return "stationare";
  if (currentJob && currentJob.status === "activ") return "tranzit";
  // După finalizarea unei curse, vehiculul rămâne "pending" până îl mută dispecerul.
  if (v.state_override === "pending") return "pending";
  if (v.state_override === "indisponibil") return "indisponibil";
  if (v.pause && !pauseEnded(v)) return "pauza";
  if (currentJob && currentJob.status === "planificare") return "alocat";
  if (!v.driver_id) return "indisponibil";
  return "disponibil";
}

/** Șterge pauzele scurte expirate (bifa + orele), ca vehiculul să apară curat. */
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
    // se încearcă din nou la următoarea încărcare
  }
}

/** Cursa curentă sau următoare (planificare / activ) pentru fiecare vehicul. */
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

/** Ultima locație de descărcare (din ultima cursă finalizată) pentru fiecare vehicul. */
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

/** Notița și tipul de echipaj (single / team) ale fiecărui vehicul. */
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
    // coloanele note / crew_type nu există încă
  }
  return map;
}

/** Ultimul tip de pauză săptămânală (45 / 24) al fiecărui vehicul. */
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

/** Sugestia pentru pauza săptămânală următoare: după 24h urmează 45h, altfel alternează. */
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

/** Salvează în istoric o pauză săptămânală pornită. */
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

/** Actualizare rapidă a unui vehicul din tabelul de Planificare. */
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
    note?: string | null;
    crewType?: string | null;
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
  if (fields.note !== undefined) {
    const text = typeof fields.note === "string" ? fields.note.trim() : "";
    vals.push(text || null);
    sets.push(`note = $${vals.length}`);
  }
  if (fields.crewType !== undefined) {
    const crew =
      fields.crewType === "team" || fields.crewType === "single" ? fields.crewType : null;
    vals.push(crew);
    sets.push(`crew_type = $${vals.length}`);
  }

  // Vehiculul e "pending" (după o cursă finalizată). Când dispecerul îi notează
  // o pauză, trece automat în Pauză; când îi notează un program, trece în
  // Disponibil (sau Alocat, dacă are o cursă planificată). Dacă starea manuală
  // e trimisă explicit în același apel, aceasta rămâne cea care contează.
  const startsPause = fields.pause === true;
  const setsProgram = Boolean(
    fields.programStart || fields.programStartAt || fields.programEnd || fields.programEndAt
  );
  if (fields.stateOverride === undefined && (startsPause || setsProgram)) {
    sets.push(`state_override = case when state_override = 'pending' then null else state_override end`);
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
