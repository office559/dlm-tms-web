/**
 * Ajutor mic pentru culori: din "Culoare temă" aleasă de utilizator în
 * Setări, generează automat o nuanță mai închisă (pentru hover / accente),
 * ca să nu fie nevoie ca utilizatorul să aleagă manual două culori.
 */
export function darkenHex(hex: string, amount = 0.25): string {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const dr = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
  const dg = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
  const db = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
}
