import { pool } from "@/lib/db";

/**
 * Venitul unei curse, pentru Dashboard:
 *  - cursă finalizată  → tarif + extra
 *  - cursă anulată     → taxa de anulare încasată (cancel_fee), dacă există
 *  - orice altceva     → 0
 * Anulările fără taxă nu intră deloc în calcule (cancel_fee gol sau 0).
 */
function venitExpr(a = "") {
  const p = a ? `${a}.` : "";
  return `(case
    when ${p}status = 'finalizat' then coalesce(${p}rate, 0) + coalesce(${p}extra, 0)
    when ${p}status = 'anulat' then coalesce(${p}cancel_fee, 0)
    else 0
  end)`;
}

/** Cursele care contează pentru venit: finalizate + anulate cu taxă plătită. */
function venitFilter(a = "") {
  const p = a ? `${a}.` : "";
  return `(${p}status = 'finalizat' or (${p}status = 'anulat' and coalesce(${p}cancel_fee, 0) > 0))`;
}

export type DashboardTotals = {
  venitTotal: number;
  kmTotal: number;
  curseFinalizate: number;
  mediaPeKm: number;
  /** din venitTotal: suma taxelor de anulare încasate */
  anulariPlatite: number;
  /** câte curse anulate au taxă încasată */
  anulariPlatiteNr: number;
};

export type MonthlyPoint = {
  month: string;
  label: string;
  venit: number;
  km: number;
  curse: number;
};

export type TopDriver = {
  name: string;
  venit: number;
  km: number;
  curse: number;
};

/**
 * Totaluri agregate pe tot istoricul, pentru căsuțele de informare de sus
 * de pe Dashboard. Venitul include și anulările plătite; km, nr. curse și
 * media pe km se calculează doar din cursele finalizate.
 */
export async function getDashboardTotals(): Promise<DashboardTotals> {
  const { rows } = await pool.query<{
    venit: number;
    venit_fin: number;
    km: number;
    curse: number;
    anulari: number;
    anulari_nr: number;
  }>(
    `select
       coalesce(sum(${venitExpr()}), 0)::float as venit,
       coalesce(sum(case when status = 'finalizat' then coalesce(rate,0) + coalesce(extra,0) else 0 end), 0)::float as venit_fin,
       coalesce(sum(case when status = 'finalizat' then coalesce(miles,0) else 0 end), 0)::float as km,
       (count(*) filter (where status = 'finalizat'))::int as curse,
       coalesce(sum(case when status = 'anulat' then coalesce(cancel_fee,0) else 0 end), 0)::float as anulari,
       (count(*) filter (where status = 'anulat'))::int as anulari_nr
     from jobs
     where ${venitFilter()}`
  );
  const r = rows[0];
  const venitTotal = Number(r?.venit) || 0;
  const venitFin = Number(r?.venit_fin) || 0;
  const kmTotal = Number(r?.km) || 0;
  const curseFinalizate = Number(r?.curse) || 0;
  const mediaPeKm = kmTotal > 0 ? venitFin / kmTotal : 0;
  return {
    venitTotal,
    kmTotal,
    curseFinalizate,
    mediaPeKm,
    anulariPlatite: Number(r?.anulari) || 0,
    anulariPlatiteNr: Number(r?.anulari_nr) || 0,
  };
}

const MONTH_LABELS = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

/**
 * Evoluția lunară (ultimele `months` luni, inclusiv luna curentă), pentru
 * graficul de comparație Venit / Km / Nr. curse. Venitul include anulările
 * plătite; km și nr. curse doar cursele finalizate.
 * Completează cu 0 lunile fără curse, ca să apară mereu toate barele.
 */
export async function getMonthlyTrend(months = 6): Promise<MonthlyPoint[]> {
  const { rows } = await pool.query<{ month: string; venit: number; km: number; curse: number }>(
    `select
       to_char(date_trunc('month', coalesce(start_at, created_at)), 'YYYY-MM') as month,
       coalesce(sum(${venitExpr()}), 0)::float as venit,
       coalesce(sum(case when status = 'finalizat' then coalesce(miles,0) else 0 end), 0)::float as km,
       (count(*) filter (where status = 'finalizat'))::int as curse
     from jobs
     where ${venitFilter()}
       and coalesce(start_at, created_at) >= date_trunc('month', now()) - make_interval(months => $1::int)
     group by 1
     order by 1`,
    [months - 1]
  );

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const now = new Date();
  const points: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const found = byMonth.get(key);
    points.push({
      month: key,
      label: MONTH_LABELS[d.getMonth()],
      venit: Number(found?.venit) || 0,
      km: Number(found?.km) || 0,
      curse: Number(found?.curse) || 0,
    });
  }
  return points;
}

/**
 * Top șoferi după venit, doar pentru luna curentă. Venitul include
 * anulările plătite; km și nr. curse doar cursele finalizate.
 */
export async function getTopDriversThisMonth(limit = 5): Promise<TopDriver[]> {
  const { rows } = await pool.query<TopDriver>(
    `select
       d.name as name,
       coalesce(sum(${venitExpr("j")}), 0)::float as venit,
       coalesce(sum(case when j.status = 'finalizat' then coalesce(j.miles,0) else 0 end), 0)::float as km,
       (count(*) filter (where j.status = 'finalizat'))::int as curse
     from jobs j
     join drivers d on d.id = j.driver_id
     where ${venitFilter("j")}
       and coalesce(j.start_at, j.created_at) >= date_trunc('month', now())
       and coalesce(j.start_at, j.created_at) < date_trunc('month', now()) + interval '1 month'
     group by d.name
     order by venit desc
     limit $1`,
    [limit]
  );
  return rows.map((r) => ({
    name: r.name,
    venit: Number(r.venit) || 0,
    km: Number(r.km) || 0,
    curse: Number(r.curse) || 0,
  }));
}

export type DayJob = {
  id: string;
  timeLabel: string;
  clientName: string;
  loadPlace: string | null;
  unloadPlace: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  status: string;
};

export type DailyProgram = {
  ieri: DayJob[];
  azi: DayJob[];
  maine: DayJob[];
};

/**
 * Programul zilei — cursele planificate pentru ieri / azi / mâine (după
 * data de start), pentru rubrica „Program" de pe Dashboard. Exclude
 * cursele anulate.
 */
export async function getDailyProgram(): Promise<DailyProgram> {
  const { rows } = await pool.query<{
    id: string;
    start_at: Date;
    client_name: string | null;
    load_place: string | null;
    unload_place: string | null;
    driver_name: string | null;
    vehicle_plate: string | null;
    status: string;
    day_offset: number;
  }>(
    `select
       j.id, j.start_at, c.name as client_name, j.load_place, j.unload_place,
       d.name as driver_name, v.plate as vehicle_plate, j.status,
       (j.start_at::date - current_date)::int as day_offset
     from jobs j
     left join customers c on c.id = j.client_id
     left join drivers d on d.id = j.driver_id
     left join vehicles v on v.id = j.vehicle_id
     where j.start_at is not null
       and j.start_at::date between current_date - 1 and current_date + 1
       and j.status <> 'anulat'
     order by j.start_at asc`
  );

  const toDayJob = (r: (typeof rows)[number]): DayJob => ({
    id: r.id,
    timeLabel: new Date(r.start_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }),
    clientName: r.client_name || "Fără client",
    loadPlace: r.load_place,
    unloadPlace: r.unload_place,
    driverName: r.driver_name,
    vehiclePlate: r.vehicle_plate,
    status: r.status,
  });

  return {
    ieri: rows.filter((r) => r.day_offset === -1).map(toDayJob),
    azi: rows.filter((r) => r.day_offset === 0).map(toDayJob),
    maine: rows.filter((r) => r.day_offset === 1).map(toDayJob),
  };
}

/* ------------------------------------------------------------------ */
/*  Noul Dashboard: performanță pe ultimele 30 de zile                 */
/* ------------------------------------------------------------------ */

export type PeriodStats = {
  venit: number;
  km: number;
  curse: number;
  venitPrev: number;
  kmPrev: number;
  cursePrev: number;
  /** din venit: taxele de anulare încasate în perioadă */
  anulari: number;
  anulariPrev: number;
};

/**
 * Venit, km și curse finalizate în ultimele `days` zile, comparat cu
 * perioada precedentă de aceeași lungime. Venitul include anulările
 * plătite; km și nr. curse doar cursele finalizate.
 */
export async function getPeriodStats(days = 30): Promise<PeriodStats> {
  const { rows } = await pool.query<{
    venit: number;
    km: number;
    curse: number;
    venit_prev: number;
    km_prev: number;
    curse_prev: number;
    anulari: number;
    anulari_prev: number;
  }>(
    `with f as (
       select
         ${venitExpr()} as venit,
         case when status = 'finalizat' then coalesce(miles, 0) else 0 end as km,
         (status = 'finalizat') as fin,
         (status = 'anulat') as anul,
         coalesce(start_at, created_at) as t
       from jobs
       where ${venitFilter()}
     )
     select
       coalesce(sum(venit) filter (where t >= now() - make_interval(days => $1::int)), 0)::float as venit,
       coalesce(sum(km) filter (where t >= now() - make_interval(days => $1::int)), 0)::float as km,
       (count(*) filter (where fin and t >= now() - make_interval(days => $1::int)))::int as curse,
       coalesce(sum(venit) filter (
         where t >= now() - make_interval(days => $1::int * 2)
           and t < now() - make_interval(days => $1::int)
       ), 0)::float as venit_prev,
       coalesce(sum(km) filter (
         where t >= now() - make_interval(days => $1::int * 2)
           and t < now() - make_interval(days => $1::int)
       ), 0)::float as km_prev,
       (count(*) filter (
         where fin
           and t >= now() - make_interval(days => $1::int * 2)
           and t < now() - make_interval(days => $1::int)
       ))::int as curse_prev,
       coalesce(sum(venit) filter (where anul and t >= now() - make_interval(days => $1::int)), 0)::float as anulari,
       coalesce(sum(venit) filter (
         where anul
           and t >= now() - make_interval(days => $1::int * 2)
           and t < now() - make_interval(days => $1::int)
       ), 0)::float as anulari_prev
     from f`,
    [days]
  );
  const r = rows[0];
  return {
    venit: Number(r?.venit) || 0,
    km: Number(r?.km) || 0,
    curse: Number(r?.curse) || 0,
    venitPrev: Number(r?.venit_prev) || 0,
    kmPrev: Number(r?.km_prev) || 0,
    cursePrev: Number(r?.curse_prev) || 0,
    anulari: Number(r?.anulari) || 0,
    anulariPrev: Number(r?.anulari_prev) || 0,
  };
}

export type JobSituation = {
  tranzit: number;
  planificate: number;
  createAzi: number;
  anulateAzi: number;
  curse30: number;
  anulate30: number;
};

/**
 * Situația curselor: în tranzit (status „activ"), planificate (orice
 * altceva în afară de activ / finalizat / anulat), create și anulate azi,
 * și totalurile pe ultimele 30 de zile. Anulările se numără după data
 * creării cursei.
 */
export async function getJobSituation(): Promise<JobSituation> {
  const { rows } = await pool.query<{
    tranzit: number;
    planificate: number;
    create_azi: number;
    anulate_azi: number;
    curse_30: number;
    anulate_30: number;
  }>(
    `select
       (count(*) filter (where status = 'activ'))::int as tranzit,
       (count(*) filter (where status not in ('activ', 'finalizat', 'anulat')))::int as planificate,
       (count(*) filter (where created_at::date = current_date))::int as create_azi,
       (count(*) filter (where status = 'anulat' and created_at::date = current_date))::int as anulate_azi,
       (count(*) filter (where created_at >= now() - interval '30 days'))::int as curse_30,
       (count(*) filter (where status = 'anulat' and created_at >= now() - interval '30 days'))::int as anulate_30
     from jobs`
  );
  const r = rows[0];
  return {
    tranzit: Number(r?.tranzit) || 0,
    planificate: Number(r?.planificate) || 0,
    createAzi: Number(r?.create_azi) || 0,
    anulateAzi: Number(r?.anulate_azi) || 0,
    curse30: Number(r?.curse_30) || 0,
    anulate30: Number(r?.anulate_30) || 0,
  };
}

export type TrendDay = {
  day: string; // YYYY-MM-DD
  curse: number;
  anulate: number;
};

/**
 * Curse create și anulate pe fiecare zi din ultimele `days` zile
 * (zilele fără curse apar cu 0).
 */
export async function getJobsTrend(days = 30): Promise<TrendDay[]> {
  const { rows } = await pool.query<{ day: string; curse: number; anulate: number }>(
    `select
       to_char(g::date, 'YYYY-MM-DD') as day,
       count(j.id)::int as curse,
       (count(j.id) filter (where j.status = 'anulat'))::int as anulate
     from generate_series(
            (current_date - ($1::int - 1))::timestamp,
            current_date::timestamp,
            interval '1 day'
          ) g
     left join jobs j on j.created_at::date = g::date
     group by g
     order by g`,
    [days]
  );
  return rows.map((r) => ({
    day: r.day,
    curse: Number(r.curse) || 0,
    anulate: Number(r.anulate) || 0,
  }));
}

export type ExpiringDoc = {
  plate: string;
  doc: string;
  expDate: string; // YYYY-MM-DD
  daysLeft: number; // negativ = expirat
};

/**
 * Documentele vehiculelor active (ITP, RCA, CASCO, asigurare, tahograf)
 * care au expirat sau expiră în următoarele `days` zile.
 */
export async function getExpiringDocs(days = 30): Promise<ExpiringDoc[]> {
  const { rows } = await pool.query<{
    plate: string;
    doc: string;
    exp_date: string;
    days_left: number;
  }>(
    `select
       plate,
       doc,
       to_char(exp_at, 'YYYY-MM-DD') as exp_date,
       (exp_at - current_date)::int as days_left
     from (
       select plate, 'ITP'::text as doc, nullif(itp_exp::text, '')::date as exp_at
         from vehicles where active
       union all
       select plate, 'RCA'::text, nullif(rca_exp::text, '')::date
         from vehicles where active
       union all
       select plate, 'CASCO'::text, nullif(casco_exp::text, '')::date
         from vehicles where active
       union all
       select plate, 'Asigurare'::text, nullif(insurance_exp::text, '')::date
         from vehicles where active
       union all
       select plate, 'Tahograf'::text, nullif(tacho_exp::text, '')::date
         from vehicles where active
     ) t
     where exp_at is not null
       and exp_at <= current_date + $1::int
     order by exp_at asc
     limit 20`,
    [days]
  );
  return rows.map((r) => ({
    plate: r.plate,
    doc: r.doc,
    expDate: r.exp_date,
    daysLeft: Number(r.days_left),
  }));
}

export type RecentJob = {
  id: string;
  ref: string | null;
  loadPlace: string | null;
  unloadPlace: string | null;
  status: string;
  driverName: string | null;
  when: Date;
};

/** Ultimele `limit` curse create, pentru tabelul „Curse recente". */
export async function getRecentJobs(limit = 5): Promise<RecentJob[]> {
  const { rows } = await pool.query<{
    id: string;
    ref: string | null;
    load_place: string | null;
    unload_place: string | null;
    status: string;
    driver_name: string | null;
    t: Date;
  }>(
    `select
       j.id,
       j.ref,
       j.load_place,
       j.unload_place,
       j.status,
       case
         when d.id is null then null
         when d.fictive_name is not null and d.fictive_name <> '' then d.name || ' / ' || d.fictive_name
         else d.name
       end as driver_name,
       coalesce(j.start_at, j.created_at) as t
     from jobs j
     left join drivers d on d.id = j.driver_id
     order by j.created_at desc
     limit $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    loadPlace: r.load_place,
    unloadPlace: r.unload_place,
    status: r.status,
    driverName: r.driver_name,
    when: r.t,
  }));
}
