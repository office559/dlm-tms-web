import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DLM TMS",
  description: "Aplicație de management transport – DLM Trans",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
