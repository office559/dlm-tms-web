/**
 * Valoarea pentru un câmp <input type="date"> („AAAA-LL-ZZ”), dintr-o dată
 * citită din baza de date.
 *
 * Baza de date întoarce coloanele de tip „date” ca obiecte Date, iar
 * String(Date) dă un text de felul „Thu Dec 31 2026 ...” — care nu e o dată
 * validă pentru formular și strică salvarea. Aici o scriem corect.
 */
export function dateInputValue(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}
