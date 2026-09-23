export function matchesQuery(fields: (string | number | null | undefined)[], q: string) {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f != null && String(f).toLowerCase().includes(needle));
}
