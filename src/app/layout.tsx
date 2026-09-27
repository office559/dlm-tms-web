import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { darkenHex } from "@/lib/color";

export const metadata: Metadata = {
  title: "DLM TMS",
  description: "Aplicație de management transport – DLM Trans",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Culorile alese în Setări (Culoare temă / Culoare fundal / Culoare
  // fundal meniu lateral) sunt injectate aici ca variabile CSS pe <html>,
  // ca să se aplice pe tot site-ul (vezi tailwind.config.ts și globals.css,
  // care le folosesc cu fallback la culorile implicite). Din "Culoare
  // temă" se generează automat și nuanța mai închisă de hover.
  let htmlStyle: Record<string, string> = {};
  try {
    const settings = await getSettings();
    const brand = settings?.theme_color || "#1e4d8b";
    htmlStyle = {
      "--brand-color": brand,
      "--brand-color-dark": darkenHex(brand, 0.25),
      "--page-bg": settings?.bg_color || "#f4f6fb",
      "--sidebar-bg": settings?.sidebar_color || "#ffffff",
    };
  } catch {
    htmlStyle = {};
  }

  return (
    <html lang="ro" style={htmlStyle as unknown as React.CSSProperties}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
