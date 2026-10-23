import type { Metadata } from "next";
import "./globals.css";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export const metadata: Metadata = {
  title: "DLM TMS",
  description: "Aplicație de management transport – DLM Trans",
};

// Se rulează înainte de afișarea paginii, ca să nu „clipească” tema.
// Implicit rămâne aspectul clasic; „glass” se aplică doar dacă utilizatorul l-a ales.
const THEME_SCRIPT = `try{if(localStorage.getItem("dlm-theme")==="glass"){document.documentElement.setAttribute("data-theme","glass");}}catch(e){}`;

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
