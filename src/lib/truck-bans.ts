import {
  COUNTRIES,
  ES_DATES_2026,
  FIRST_MONTH,
  HOLIDAYS,
  LAST_MONTH,
  type CountryCode,
  type CountryInfo,
} from "@/lib/truck-bans-data";

/** Tipul interdicției — decide culoarea în aplicație. */
export type BanKind = "holiday" | "sunday" | "saturday" | "summer" | "eve" | "route";

export type BanEntry = {
  hours: string;
  label: string;
  kind: BanKind;
  scope?: string;
};

export type BanDay = { date: string; weekday: string; entries: BanEntry[] };

const WEEKDAYS = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

const MONTH_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LONG = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDay(date: string): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

function between(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

const holidayMaps: Record<CountryCode, Map<string, { name: string; scope?: string }>> = {} as never;
for (const c of COUNTRIES) {
  holidayMaps[c.code] = new Map(HOLIDAYS[c.code].map((x) => [x.date, { name: x.name, scope: x.scope }]));
}

function push(list: BanEntry[], e: BanEntry) {
  // fără dubluri (aceleași ore și același fel)
  if (!list.some((x) => x.hours === e.hours && x.kind === e.kind)) list.push(e);
}

/** Interdicțiile unei țări într-o zi anume (în ordinea importanței). */
export function bansOn(code: CountryCode, date: string): BanEntry[] {
  const out: BanEntry[] = [];
  const dow = parse(date).getUTCDay(); // 0 = duminică
  const month = Number(date.slice(5, 7));
  const hol = holidayMaps[code].get(date);
  const tomorrow = holidayMaps[code].get(nextDay(date));
  const holEntry = (hours: string): BanEntry => ({
    hours,
    label: hol?.name ?? "",
    kind: "holiday",
    scope: hol?.scope,
  });
  const sunday = (hours: string): BanEntry => ({ hours, label: "Duminică", kind: "sunday" });

  switch (code) {
    case "DE": {
      if (hol) push(out, holEntry("00–22"));
      else if (dow === 0) push(out, sunday("00–22"));
      if (dow === 6 && between(date, "2027-07-03", "2027-08-28")) {
        push(out, { hours: "07–20", label: "Sâmbătă de vară (drumuri selectate)", kind: "summer" });
      }
      break;
    }
    case "AT": {
      if (hol) push(out, holEntry("00–22"));
      else if (dow === 0) push(out, sunday("00–22"));
      if (dow === 6) push(out, { hours: "15–24", label: "Sâmbătă după-amiază", kind: "saturday" });
      break;
    }
    case "PL": {
      if (hol) push(out, holEntry("08–22"));
      else if (tomorrow && !date.endsWith("-12-24") && !date.endsWith("-12-31")) {
        push(out, { hours: "18–22", label: `Ajun: ${tomorrow.name}`, kind: "eve" });
      }
      if (between(date, "2027-06-25", "2027-08-29")) {
        if (dow === 5) push(out, { hours: "18–22", label: "Vară: vineri", kind: "summer" });
        if (dow === 6) push(out, { hours: "08–14", label: "Vară: sâmbătă", kind: "summer" });
        if (dow === 0 && !hol) push(out, { hours: "08–22", label: "Vară: duminică", kind: "summer" });
      }
      break;
    }
    case "SK": {
      if (hol) push(out, holEntry("06–22"));
      else if (dow === 0) push(out, sunday("06–22"));
      if (dow === 6 && between(date, "2027-07-03", "2027-08-28")) {
        push(out, { hours: "09–19", label: "Sâmbătă de vară", kind: "summer" });
      }
      break;
    }
    case "CZ": {
      if (hol) push(out, holEntry("13–22"));
      else if (dow === 0) push(out, sunday("13–22"));
      if (between(date, "2027-07-01", "2027-08-31")) {
        if (dow === 5) push(out, { hours: "17–21", label: "Vară: vineri", kind: "summer" });
        if (dow === 6) push(out, { hours: "07–13", label: "Vară: sâmbătă", kind: "summer" });
      }
      break;
    }
    case "IT": {
      if (hol) push(out, holEntry("09–22"));
      else if (dow === 0) push(out, sunday(month >= 6 && month <= 9 ? "07–22" : "09–22"));
      break;
    }
    case "HU": {
      const summer = between(date, "2027-07-01", "2027-08-31");
      if (hol) push(out, holEntry("00–22"));
      else if (dow === 0) push(out, sunday("00–22"));
      if (dow === 6) {
        if (summer) push(out, { hours: "15–24", label: "Vară: sâmbătă", kind: "summer" });
        else push(out, { hours: "22–24", label: "Sâmbătă seara", kind: "saturday" });
      } else if (tomorrow && dow !== 0) {
        push(out, { hours: "22–24", label: `Ajun: ${tomorrow.name}`, kind: "eve" });
      }
      break;
    }
    case "FR": {
      if (hol) push(out, holEntry(dow === 6 ? "00–24" : "00–22"));
      else if (dow === 0) {
        push(out, { hours: tomorrow ? "00–24" : "00–22", label: tomorrow ? "Duminică înainte de sărbătoare" : "Duminică", kind: "sunday" });
      }
      if (dow === 6 && !hol) push(out, { hours: "22–24", label: "Sâmbătă seara", kind: "saturday" });
      else if (tomorrow && dow !== 6 && dow !== 0) {
        push(out, { hours: "22–24", label: `Ajun: ${tomorrow.name}`, kind: "eve" });
      }
      break;
    }
    case "ES": {
      if (ES_DATES_2026.includes(date)) {
        push(out, { hours: "după rută", label: "Restricții pe drumuri selectate", kind: "route" });
      }
      break;
    }
    default:
      break;
  }
  return out;
}

function addMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Lista lunilor afișate: de la luna curentă (sau prima luna cu date) până la sfârșitul datelor. */
export function monthList(fromMonth?: string): string[] {
  let start = fromMonth && fromMonth > FIRST_MONTH ? fromMonth : FIRST_MONTH;
  if (start > LAST_MONTH) start = LAST_MONTH;
  const out: string[] = [];
  for (let m = start; m <= LAST_MONTH; m = addMonth(m, 1)) out.push(m);
  return out;
}

export function monthLabel(ym: string, long = false): string {
  const m = Number(ym.slice(5, 7)) - 1;
  return `${long ? MONTH_LONG[m] : MONTH_SHORT[m]} ${long ? ym.slice(0, 4) : ym.slice(2, 4)}`;
}

/** Zilele cu interdicții ale unei țări într-o lună. */
export function banDaysInMonth(code: CountryCode, ym: string): BanDay[] {
  const out: BanDay[] = [];
  const first = parse(`${ym}-01`);
  const next = parse(`${addMonth(ym, 1)}-01`);
  for (let d = first; d < next; d = new Date(d.getTime() + 86400000)) {
    const date = iso(d);
    const entries = bansOn(code, date);
    if (entries.length) out.push({ date, weekday: WEEKDAYS[d.getUTCDay()], entries });
  }
  return out;
}

export type MonthStatus = "known" | "provisional" | "unknown";

export function statusFor(c: CountryInfo, ym: string): MonthStatus {
  if (c.unknownFrom && ym >= c.unknownFrom) return "unknown";
  if (c.provisionalFrom && ym >= c.provisionalFrom) return "provisional";
  return "known";
}

export function dayNumber(date: string): number {
  return Number(date.slice(8, 10));
}
