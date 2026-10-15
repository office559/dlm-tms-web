"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_TIMEZONE } from "@/lib/tz";

const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

/** După cât timp plecat de pe pagină se face reîncărcare completă (ms). */
const FULL_RELOAD_AFTER_MS = 60 * 1000;
/** Sub această pauză între două reîmprospătări nu mai facem alta (ms). */
const MIN_GAP_MS = 4 * 1000;

function isTyping() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Ține aplicația mereu la zi: când deschizi tab-ul / revii pe pagină /
 * se trezește calculatorul din sleep / revine internetul, datele se
 * reîncarcă singure. Dacă ai lipsit mai mult de un minut, pagina se
 * reîncarcă complet (doar dacă nu scrii chiar atunci într-un câmp).
 */
function AutoFreshness() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);
  const lastRefresh = useRef<number>(Date.now());
  const lastTick = useRef<number>(Date.now());

  useEffect(() => {
    function refreshNow(awayMs: number) {
      const now = Date.now();
      if (now - lastRefresh.current < MIN_GAP_MS) return;
      lastRefresh.current = now;
      if (awayMs >= FULL_RELOAD_AFTER_MS && !isTyping()) {
        window.location.reload();
      } else {
        router.refresh();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else {
        const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        refreshNow(away);
      }
    }

    function onFocus() {
      refreshNow(hiddenAt.current ? Date.now() - hiddenAt.current : 0);
    }

    function onOnline() {
      refreshNow(0);
    }

    // pagină restaurată din cache-ul browserului (butonul Înapoi / tab restaurat)
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) window.location.reload();
    }

    // detectează "sleep": cronometrul se oprește, la trezire trece mult timp între două bătăi
    const timer = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTick.current;
      lastTick.current = now;
      if (gap > 45 * 1000 && document.visibilityState === "visible") {
        refreshNow(gap);
      }
    }, 15 * 1000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}

/** Pune fusul orar ales la dispoziția componentelor din pagină. */
export function TimezoneProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <TimezoneContext.Provider value={value}>
      <AutoFreshness />
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
