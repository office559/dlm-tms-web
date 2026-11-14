import type { Metadata } from "next";
import "./globals.css";
import "./themes.css";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export const metadata: Metadata = {
  title: "TMS",
  description: "Aplicație de management transport (TMS)",
};

// Se rulează înainte de afișarea paginii, ca să nu „clipească” tema.
// Implicit rămâne aspectul clasic; orice altă temă (glass, ocean, grafit etc.)
// se aplică doar dacă utilizatorul a ales-o din Setări sau din butonul „Aspect”.
const THEME_SCRIPT = `try{var t=localStorage.getItem("dlm-theme");if(t&&t!=="classic"&&/^[a-z]+$/.test(t)){document.documentElement.setAttribute("data-theme",t);}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        {children}
        <ThemeSwitch />
      </body>
    </html>
  );
}
