"use client";

import { useEffect, useState } from "react";

const KEY = "dlm-theme";

/**
 * Buton mic „Clasic / Glass”. Alegerea se ține în browserul fiecărui
 * utilizator (tu și dispecerii puteți alege diferit).
 */
export function ThemeSwitch() {
  const [glass, setGlass] = useState(false);

  useEffect(() => {
    setGlass(document.documentElement.getAttribute("data-theme") === "glass");
  }, []);

  function toggle() {
    const next = !glass;
    setGlass(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "glass");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(KEY, next ? "glass" : "classic");
    } catch {
      /* ignorăm */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={glass ? "Treci la aspectul clasic" : "Treci la aspectul Glass"}
      className="fixed bottom-2 right-3 md:right-auto md:left-28 z-40 rounded-full border border-slate-300 bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-white"
    >
      {glass ? "Aspect: Glass" : "Aspect: Clasic"}
    </button>
  );
}
