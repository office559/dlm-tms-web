import { pool } from "@/lib/db";

/** Câte curse interne are voie să facă un camion într-o țară străină. */
export const CABOTAGE_MAX = 3;
/** În câte zile de la descărcarea internațională trebuie terminat cabotajul. */
export const CABOTAGE_DAYS = 7;
/** Țările de origine ale camioanelor: acolo cursele interne NU sunt cabotaj. */
export const HOME_COUNTRIES = ["RO"];

export type Cabotage = {
  /** Țara în care camionul e pe cabotaj (cod din 2 litere). */
  country: string;
  /** Câte curse interne (planificate / în tranzit / finalizate) are în țara aceea. */
  count: number;
  /** Zile rămase din cele 7; null dacă nu se știe de când curge termenul. */
  daysLeft: number | null;
  /** True dacă cele 7 zile au trecut. */
  expired: boolean;
};

type CabotageJob = {
  vehicle_id: string | null;
  status: string;
  load_country: string | null;
  unload_country: string | null;
  start_at: Date | string | null;
  end_at: Date | string | null;
  created_at: Date | string;
};

function ms(v: Date | string | null | undefined): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Starea de cabotaj a unui vehicul, din cursele lui (în ordine cronologică):
 *  - cursă internă (încărcare și descărcare în aceeași țară străină) → +1;
 *  - cursă internațională FINALIZATĂ → cabotajul se resetează: dacă a descărcat
 *    în altă țară, cabotajul vechi dispare; termenul de 7 zile pornește de la
 *    descărcarea ei;
 *  - cursele anulate nu contează și nu resetează nimic;
 *  - cursele interne din țara de origine nu sunt cabotaj.
 */
export function computeCabotage(jobs: CabotageJob[], now: number = Date.now()): Cabotage | null {
  const sorted = jobs
    .filter((j) => j.status !== "anulat" && j.load_country && j.unload_country)
    .sort((a, b) => {
      const ka = ms(a.start_at) ?? ms(a.end_at) ?? ms(a.created_at) ?? 0;
      const kb = ms(b.start_at) ?? ms(b.end_at) ?? ms(b.created_at) ?? 0;
      return ka - kb;
    });

  let cur: { country: string; count: number; entryAt: number | null } | null = null;

  for (const j of sorted) {
    const from = (j.load_country ?? "").toUpperCase();
    const to = (j.unload_country ?? "").toUpperCase();
    const startMs = ms(j.start_at) ?? ms(j.end_at) ?? ms(j.created_at);
    const unloadMs = ms(j.end_at) ?? ms(j.start_at) ?? ms(j.created_at);

    if (from === to) {
      // cursă internă
      if (HOME_COUNTRIES.includes(from)) {
        cur = null;
        continue;
      }
      if (!cur || cur.country !== from) {
        cur = { country: from, count: 0, entryAt: startMs };
      }
      cur.count += 1;
    } else if (j.status === "finalizat") {
      // cursă internațională terminată: camionul a descărcat în altă țară
      cur = HOME_COUNTRIES.includes(to) ? null : { country: to, count: 0, entryAt: unloadMs };
    }
    // cursă internațională încă neterminată: nu schimbă nimic
  }

  if (!cur || cur.count === 0) return null;

  let daysLeft: number | null = null;
  if (cur.entryAt !== null) {
    const leftMs = cur.entryAt + CABOTAGE_DAYS * 86_400_000 - now;
    daysLeft = Math.ceil(leftMs / 86_400_000);
  }
  return {
    country: cur.country,
    count: cur.count,
    daysLeft: daysLeft === null ? null : Math.max(0, daysLeft),
    expired: daysLeft !== null && daysLeft <= 0,
  };
}

/** Cabotajul fiecărui vehicul (doar cele care sunt pe cabotaj apar în rezultat). */
export async function cabotageByVehicle(vehicleIds: string[]): Promise<Map<string, Cabotage>> {
  const result = new Map<string, Cabotage>();
  if (vehicleIds.length === 0) return result;
  try {
    const { rows } = await pool.query<CabotageJob>(
      `select vehicle_id, status, load_country, unload_country, start_at, end_at, created_at
         from jobs
        where vehicle_id = any($1)
          and status in ('finalizat', 'activ', 'planificare')
          and load_country is not null
          and unload_country is not null
          and coalesce(start_at, end_at, created_at) >= now() - interval '45 days'`,
      [vehicleIds]
    );
    const byVehicle = new Map<string, CabotageJob[]>();
    rows.forEach((r) => {
      if (!r.vehicle_id) return;
      const list = byVehicle.get(r.vehicle_id) ?? [];
      list.push(r);
      byVehicle.set(r.vehicle_id, list);
    });
    byVehicle.forEach((list, vehicleId) => {
      const c = computeCabotage(list);
      if (c) result.set(vehicleId, c);
    });
  } catch {
    // coloanele load_country / unload_country nu există încă (rulează migrarea 010)
  }
  return result;
}
