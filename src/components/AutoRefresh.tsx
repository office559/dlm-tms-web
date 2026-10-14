"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reîmprospătează datele paginii la fiecare câteva secunde,
// doar cât timp fila este vizibilă.
export default function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);

  return null;
}
