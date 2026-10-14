"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/tz";

const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

/** Pune fusul orar ales la dispoziția componentelor din pagină. */
export function TimezoneProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
