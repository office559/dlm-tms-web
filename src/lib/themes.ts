/**
 * Temele de culori ale aplicației. Alegerea se ține în browserul fiecărui
 * utilizator (localStorage, cheia „dlm-theme”). „classic” = aspectul de
 * până acum, fără niciun atribut pe <html>.
 *
 * Culorile din `preview` sunt folosite doar la mica previzualizare din Setări.
 */
export type ThemeKey =
  | "classic"
  | "glass"
  | "ocean"
  | "smarald"
  | "violet"
  | "grafit"
  | "carbune"
  | "minimal";

export type ThemeDef = {
  key: ThemeKey;
  label: string;
  hint: string;
  /** meniu lateral, accent, fundal pagină, fundal carduri */
  preview: { side: string; accent: string; bg: string; card: string };
};

export const THEMES: ThemeDef[] = [
  { key: "classic", label: "Clasic", hint: "Aspectul de până acum", preview: { side: "#ffffff", accent: "#1e4d8b", bg: "#f1f5f9", card: "#ffffff" } },
  { key: "glass", label: "Glass", hint: "Sticlă, fundal colorat", preview: { side: "#7d74e8", accent: "#22d3ee", bg: "#4a45b8", card: "#a9a4f3" } },
  { key: "ocean", label: "Ocean", hint: "Albastru închis", preview: { side: "#0f2a4a", accent: "#1d6fd8", bg: "#e9f0f8", card: "#ffffff" } },
  { key: "smarald", label: "Smarald", hint: "Verde închis", preview: { side: "#0e3b2c", accent: "#0f8a5f", bg: "#eef5f1", card: "#ffffff" } },
  { key: "violet", label: "Violet", hint: "Mov închis", preview: { side: "#2a1d5c", accent: "#6d3fd6", bg: "#f2f0fa", card: "#ffffff" } },
  { key: "grafit", label: "Grafit", hint: "Mod întunecat", preview: { side: "#0a0e13", accent: "#f59e0b", bg: "#0f141b", card: "#171d27" } },
  { key: "carbune", label: "Cărbune + portocaliu", hint: "Meniu negru, accent portocaliu", preview: { side: "#1c1917", accent: "#ea580c", bg: "#f4f2ef", card: "#ffffff" } },
  { key: "minimal", label: "Minimal alb-negru", hint: "Curat, fără culoare", preview: { side: "#ffffff", accent: "#111111", bg: "#f5f5f5", card: "#ffffff" } },
];

export const THEME_STORAGE_KEY = "dlm-theme";
export const THEME_EVENT = "dlm-theme-change";

export function isThemeKey(v: string | null | undefined): v is ThemeKey {
  return !!v && THEMES.some((t) => t.key === v);
}
