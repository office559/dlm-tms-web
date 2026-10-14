/** Fusuri orare disponibile în TMS + funcții de lucru cu ore într-un fus ales. */

export type TimezoneOption = { value: string; label: string };

export const TIMEZONES: TimezoneOption[] = [
  { value: "Europe/Bucharest", label: "România (București)" },
  { value: "Europe/Berlin", label: "Germania (Berlin)" },
  { value: "Europe/London", label: "Regatul Unit (Londra)" },
  { value: "Europe/Paris", label: "Franța (Paris)" },
  { value: "Europe/Rome", label: "Italia (Roma)" },
  { value: "Europe/Madrid", label: "Spania (Madrid)" },
  { value: "Europe/Vienna", label: "Austria (Viena)" },
  { value: "Europe/Amsterdam", label: "Olanda (Amsterdam)" },
  { value: "Europe/Brussels", label: "Belgia (Bruxelles)" },
  { value: "Europe/Budapest", label: "Ungaria (Budapesta)" },
  { value: "Europe/Warsaw", label: "Polonia (Varșovia)" },
  { value: "Europe/Prague", label: "Cehia (Praga)" },
  { value: "Europe/Athens", label: "Grecia (Atena)" },
  { value: "Europe/Sofia", label: "Bulgaria (Sofia)" },
  { value: "Europe/Istanbul", label: "Turcia (Istanbul)" },
  { value: "UTC", label: "UTC" },
];

export const DEFAULT_TIMEZONE = "Europe/Bucharest";

export function isValidTimezone(tz: unknown): tz is string {
  return typeof tz === "string" && TIMEZONES.some((t) => t.value === tz);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Componentele datei/orei unui moment, așa cum se văd în fusul ales. */
export function zonedParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

function tzOffsetMs(ts: number, tz: string) {
  const p = zonedParts(new Date(ts), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/**
 * Momentul exact pentru ora „HH:MM" din ziua curentă (din fusul ales).
 * Ex.: „10:00" în Berlin → momentul în care la Berlin sunt ora 10:00.
 */
export function zonedTimeToDate(time: string, tz: string, base: Date = new Date()): Date {
  const [h, m] = time.split(":").map((n) => Number(n) || 0);
  const p = zonedParts(base, tz);
  const guess = Date.UTC(p.year, p.month - 1, p.day, h, m, 0, 0);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz);
  return new Date(ts);
}

/** „HH:MM" pentru un moment, în fusul ales; gol dacă valoarea lipsește. */
export function formatTimeInTz(
  value: Date | string | number | null | undefined,
  tz: string
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = zonedParts(d, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** „ZZ.LL.AAAA" pentru un moment, în fusul ales; „—" dacă lipsește. */
export function formatDateInTz(
  value: Date | string | number | null | undefined,
  tz: string
): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const p = zonedParts(d, tz);
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

/** Ora curentă „HH:MM" în fusul ales. */
export function nowTimeInTz(tz: string): string {
  return formatTimeInTz(new Date(), tz);
}
