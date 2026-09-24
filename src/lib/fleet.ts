import { pool } from "@/lib/db";
import type { Vehicle } from "@/lib/vehicles";
import type { Job } from "@/lib/jobs";

export type FleetState =
  | "disponibil"
  | "indisponibil"
  | "pauza"
  | "alocat"
  | "tranzit"
  | "stationare";

export const FLEET_STATE_LABELS: Record<FleetState, string> = {
  disponibil: "Disponibil",
  indisponibil: "Indisponibil",
  pauza: "Pauză",
  alocat: "Viitor",
  tranzit: "Tranzit",
  stationare: "Staționare",
};

export const FLEET_STATE_STYLES: Record<FleetState, string> = {
  disponibil: "text-green-700 bg-green-50",
  indisponibil: "text-red-700 bg-red-50",
  pauza: "text-sky-700 bg-sky-50",
  alocat: "text-amber-700 bg-amber-50",
  tranzit: "text-orange-700 bg-orange-50",
  stationare: "text-red-700 bg-red-50",
};

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

/** Actualizare rapidă a unui vehicul din tabelul de Planificare (fără să ceară tot formularul). */
export async function patchVehicleQuick(
  id: string,
  fields: {
    driverId?: string | null;
    location?: string | null;
    pause?: boolean;
    programStart?: string | null;
    programEnd?: string | null;
    restDurH?: number | null;
    restStart?: string | null;
    restEnd?: string | null;
    restStartAt?: string | null;
    restEndAt?: string | null;
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
  if (sets.length === 0) return;
  await pool.query(`update vehicles set ${sets.join(", ")} where id = $1`, vals);
}
