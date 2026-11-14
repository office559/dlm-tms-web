"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES, THEME_EVENT, THEME_STORAGE_KEY, isThemeKey, type ThemeKey } from "@/lib/themes";

/** Tema activă, citită de pe <html> (setată înainte de afișare de scriptul din layout). */
function readTheme(): ThemeKey {
  const v = document.documentElement.getAttribute("data-theme");
  return isThemeKey(v) ? v : "classic";
}

/** Aplică tema, o ține minte în browser și anunță celelalte componente. */
function applyTheme(key: ThemeKey) {
  if (key === "classic") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", key);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, key);
  } catch {
    /* ignorăm */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function useTheme(): ThemeKey {
  const [theme, setTheme] = useState<ThemeKey>("classic");
  useEffect(() => {
    setTheme(readTheme());
    const sync = () => setTheme(readTheme());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return theme;
}

/** Mică previzualizare a unei teme: meniu lateral + fundal + card + accent. */
function Swatch({ preview, className = "" }: { preview: { side: string; accent: string; bg: string; card: string }; className?: string }) {
  return (
    <span
      className={`flex overflow-hidden rounded-md border border-slate-300 ${className}`}
      style={{ background: preview.bg }}
      aria-hidden="true"
    >
      <span className="block w-1/4" style={{ background: preview.side }} />
      <span className="flex flex-1 flex-col justify-center gap-1 p-1.5">
        <span className="block h-1.5 w-1/2 rounded-full" style={{ background: preview.accent }} />
        <span className="block h-2.5 rounded-sm" style={{ background: preview.card }} />
      </span>
    </span>
  );
}

/**
 * Buton mic „Aspect: …” din colțul ecranului: se deschide o listă cu toate
 * temele. Alegerea se ține în browserul fiecărui utilizator (tu și
 * dispecerii puteți alege diferit).
 */
export function ThemeSwitch() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  return (
    <div ref={boxRef} className="fixed bottom-2 right-3 lg:right-auto lg:left-28 z-40">
      {open && (
        <div className="absolute bottom-full mb-2 left-auto right-0 lg:left-0 lg:right-auto w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {THEMES.map((t) => {
            const on = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  applyTheme(t.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-100 ${
                  on ? "font-semibold text-slate-900" : "text-slate-700"
                }`}
              >
                <Swatch preview={t.preview} className="h-7 w-12 shrink-0" />
                <span className="flex-1 truncate">{t.label}</span>
                {on && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Alege aspectul aplicației"
        className="rounded-full border border-slate-300 bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-white"
      >
        Aspect: {current.label}
      </button>
    </div>
  );
}

/** Grila de teme din pagina Setări: apeși pe o temă și se aplică imediat. */
export function ThemePicker() {
  const theme = useTheme();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {THEMES.map((t) => {
        const on = t.key === theme;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTheme(t.key)}
            aria-pressed={on}
            className={`flex flex-col gap-2 rounded-xl border-2 bg-white p-2.5 text-left transition hover:border-slate-400 ${
              on ? "border-brand" : "border-slate-200"
            }`}
          >
            <Swatch preview={t.preview} className="h-14 w-full" />
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{t.label}</span>
              {on && <span className="text-xs font-semibold text-brand">✓ Activ</span>}
            </span>
            <span className="-mt-1.5 text-xs text-slate-500">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
