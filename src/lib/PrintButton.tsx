"use client";

import { useEffect } from "react";

/** Deschide automat fereastra de tipărire (de acolo: „Salvează ca PDF"). */
export function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white print:hidden"
    >
      Printează / Salvează PDF
    </button>
  );
}
