/**
 * Calculul pontajului din activitățile de tahograf (fără bază de date —
 * funcții pure, ușor de verificat).
 *
 * Reguli (la fel ca TachoScan, „conform timpului de început"):
 *  - ziua de lucru = ziua UTC din tahograf (în România: 03:00–03:00 vara, 02:00–02:00 iarna)
 *  - orele afișate sunt ora României
 *  - muncă = condus + alte activități (disponibilitatea se arată separat)
 *  - noapte = muncă între 22:00 și 06:00, ora României
 *  - sărbători = muncă într-o zi de sărbătoare legală în România
 *  - diurnă = zi în care șoferul a fost (măcar o parte) în afara României,
 *    inclusiv zilele libere petrecute în străinătate
 */

import type { Activity, Segment } from "./ddd";

export const TZ = "Europe/Bucharest";

export type DaySource = { source: string; segments: Segment[]; vehicles: string[] };

export type CountryPoint = { at: number; country: string };

export type PontajDay = {
  day: string; // YYYY-MM-DD
  dow: number; // 0 = luni … 6 = duminică
  start: string; // HH:MM (ora RO) sau ""
  end: string;
  drive: number; // minute
  other: number;
  avail: number;
  work: number;
  breaks: number; // pauze între prima și ultima activitate
  rest: number;
  night: number;
  holidayWork: number;
  isHoliday: boolean;
  holidayName: string;
  countries: string[];
  abroad: boolean;
  vehicles: string[];
  worked: boolean;
  diurna: number;
  manual: boolean;
  source: "card" | "vu" | "";
};

export type PontajTotals = {
  daysWorked: number;
  drive: number;
  other: number;
  avail: number;
  work: number;
  breaks: number;
  night: number;
  holidayWork: number;
  diurnaDays: number;
  diurna: number;
};

export type DiurnaRule = { abroad: number; ro: number; currency: string };

/* ------------------------------------------------------------------ */
/* Sărbători legale România                                            */
/* ------------------------------------------------------------------ */

/** Paștele ortodox (calendar iulian → gregorian, valabil 1900–2099). */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day + 13));
}

const holidayCache = new Map<number, Map<string, string>>();

export function roHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const m = new Map<string, string>();
  const fixed: [number, number, string][] = [
    [1, 1, "Anul Nou"],
    [1, 2, "Anul Nou"],
    [1, 6, "Boboteaza"],
    [1, 7, "Sf. Ioan"],
    [1, 24, "Unirea Principatelor"],
    [5, 1, "Ziua Muncii"],
    [6, 1, "Ziua Copilului"],
    [8, 15, "Adormirea Maicii Domnului"],
    [11, 30, "Sf. Andrei"],
    [12, 1, "Ziua Națională"],
    [12, 25, "Crăciunul"],
    [12, 26, "Crăciunul"],
  ];
  for (const [mo, d, n] of fixed) m.set(`${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, n);
  const easter = orthodoxEaster(year).getTime();
  const rel: [number, string][] = [
    [-2, "Vinerea Mare"],
    [0, "Paștele"],
    [1, "Paștele"],
    [49, "Rusaliile"],
    [50, "Rusaliile"],
  ];
  for (const [off, n] of rel) m.set(new Date(easter + off * 86400000).toISOString().slice(0, 10), n);
  holidayCache.set(year, m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Ora României                                                        */
/* ------------------------------------------------------------------ */

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Pentru un moment UTC: data locală (YYYY-MM-DD), ora și minutul local. */
export function localParts(ms: number) {
  const p: Record<string, string> = {};
  for (const x of dtf.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

/** Decalajul față de UTC (în minute) pentru fiecare oră UTC a zilei. */
function hourOffsets(dayMs: number) {
  const res: { offset: number; date: string }[] = [];
  for (let h = 0; h < 24; h++) {
    const ms = dayMs + h * 3600000;
    const lp = localParts(ms);
    const localMin = lp.hour * 60 + lp.minute;
    let off = localMin - h * 60;
    if (off < -720) off += 1440;
    if (off > 720) off -= 1440;
    res.push({ offset: off, date: lp.date });
  }
  return res;
}

export function hm(min: number) {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Combinarea surselor                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cardul șoferului are tot (toate camioanele) → are prioritate. Fără card,
 * combinăm toate fișierele de camion în care apare șoferul în acea zi.
 */
export function mergeSources(sources: DaySource[]): { minutes: Int8Array; manual: Uint8Array; vehicles: string[]; source: "card" | "vu" | "" } {
  const minutes = new Int8Array(1440).fill(-1);
  const manual = new Uint8Array(1440);
  const card = sources.filter((s) => s.source === "card");
  const use = card.length ? card : sources;
  for (const s of use) {
    for (const seg of s.segments) {
      for (let i = Math.max(0, seg.start); i < Math.min(1440, seg.end); i++) {
        // la suprapuneri păstrăm activitatea „mai grea" (condus > muncă > disponibil > odihnă)
        if (seg.act > minutes[i]) {
          minutes[i] = seg.act;
          manual[i] = seg.manual ? 1 : 0;
        }
      }
    }
  }
  const vehicles = [...new Set(sources.flatMap((s) => s.vehicles))].filter(Boolean);
  return { minutes, manual, vehicles, source: use.length === 0 ? "" : card.length ? "card" : "vu" };
}

/** Țara în care se află șoferul la momentul t (ultimul eveniment ≤ t). */
function countryAt(points: CountryPoint[], t: number, fallback = "RO") {
  let c = "";
  for (const p of points) {
    if (p.at <= t) c = p.country;
    else break;
  }
  return c || fallback;
}

export function computeDay(
  day: string,
  sources: DaySource[],
  countries: CountryPoint[],
  diurna: DiurnaRule
): PontajDay {
  const dayMs = Date.parse(day + "T00:00:00Z");
  const { minutes, manual, vehicles, source } = mergeSources(sources);
  const offs = hourOffsets(dayMs);
  const holidays = roHolidays(new Date(dayMs).getUTCFullYear());
  const holidaysNext = roHolidays(new Date(dayMs + 86400000).getUTCFullYear());

  const counts = [0, 0, 0, 0];
  let night = 0;
  let holidayWork = 0;
  let first = -1;
  let last = -1;
  let anyManual = false;
  for (let i = 0; i < 1440; i++) {
    const a = minutes[i] as Activity | -1;
    if (a < 0) continue;
    counts[a]++;
    if (a === 0) continue;
    if (first < 0) first = i;
    last = i + 1;
    if (manual[i]) anyManual = true;
    if (a >= 2) {
      const o = offs[Math.floor(i / 60)];
      const localMin = (((i + o.offset) % 1440) + 1440) % 1440;
      const lh = Math.floor(localMin / 60);
      if (lh >= 22 || lh < 6) night++;
      if (holidays.has(o.date) || holidaysNext.has(o.date)) holidayWork++;
    }
  }
  // pauze = perioadele de odihnă mai scurte de 3 ore dintre prima și ultima activitate
  // (odihna zilnică, care poate cădea în aceeași zi UTC, nu se numără)
  let breaks = 0;
  if (first >= 0) {
    let run = 0;
    for (let i = first; i <= last; i++) {
      const isRest = i < last && (minutes[i] === 0 || minutes[i] === -1);
      if (isRest) run++;
      else {
        if (run > 0 && run < 180) breaks += run;
        run = 0;
      }
    }
  }

  const work = counts[2] + counts[3];
  const worked = work > 0;
  const fmt = (i: number) => {
    const o = offs[Math.min(23, Math.floor(i / 60))];
    return hm((((i + o.offset) % 1440) + 1440) % 1440);
  };

  // țările zilei
  const inDay = countries.filter((p) => p.at >= dayMs && p.at < dayMs + 86400000);
  const list = [countryAt(countries, dayMs), ...inDay.map((p) => p.country)];
  const uniq = [...new Set(list.filter(Boolean))];
  const abroad = uniq.some((c) => c !== "RO");

  const holName = holidays.get(day) ?? "";
  const dow = (new Date(dayMs).getUTCDay() + 6) % 7;

  return {
    day,
    dow,
    start: first >= 0 && worked ? fmt(first) : "",
    end: last > 0 && worked ? fmt(last) : "",
    drive: counts[3],
    other: counts[2],
    avail: counts[1],
    work,
    breaks,
    rest: 1440 - work - counts[1],
    night,
    holidayWork,
    isHoliday: Boolean(holName),
    holidayName: holName,
    countries: uniq.sort((a, b) => (a === "RO" ? -1 : b === "RO" ? 1 : 0)),
    abroad,
    vehicles,
    worked,
    diurna: abroad ? diurna.abroad : worked ? diurna.ro : 0,
    manual: anyManual,
    source,
  };
}

export function monthDays(year: number, month: number): string[] {
  const res: string[] = [];
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= n; d++) res.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return res;
}

export function totalsOf(days: PontajDay[]): PontajTotals {
  const t: PontajTotals = { daysWorked: 0, drive: 0, other: 0, avail: 0, work: 0, breaks: 0, night: 0, holidayWork: 0, diurnaDays: 0, diurna: 0 };
  for (const d of days) {
    if (d.worked) t.daysWorked++;
    t.drive += d.drive;
    t.other += d.other;
    t.avail += d.avail;
    t.work += d.work;
    t.breaks += d.breaks;
    t.night += d.night;
    t.holidayWork += d.holidayWork;
    if (d.diurna > 0) t.diurnaDays++;
    t.diurna += d.diurna;
  }
  return t;
}

/** Împarte zilele lunii pe săptămâni (luni–duminică). */
export function weeksOf(days: PontajDay[]): PontajDay[][] {
  const weeks: PontajDay[][] = [];
  let cur: PontajDay[] = [];
  for (const d of days) {
    cur.push(d);
    if (d.dow === 6) {
      weeks.push(cur);
      cur = [];
    }
  }
  if (cur.length) weeks.push(cur);
  return weeks;
}

export const DOW_SHORT = ["L", "Ma", "Mi", "J", "V", "S", "D"];
export const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function fmtDayRo(day: string) {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}
