"use client";

import { useEffect, useState } from "react";

/** "1555" / "15.5" / "15:55" → "15:55" (doar cifre, cu ":" după ora). */
function formatTyped(raw: string): string {
  const cleaned = raw.replace(/[^\d.:]/g, "");
  const hasSep = /[.:]/.test(cleaned);
  if (hasSep) {
    const [h = "", m = ""] = cleaned.split(/[.:]/);
    return `${h.replace(/\D/g, "").slice(0, 2)}:${m.replace(/\D/g, "").slice(0, 2)}`;
  }
  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** True pentru "HH:MM" valid (00:00 – 23:59). */
function isValidTime(t: string): boolean {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}

/**
 * Dată + oră în format 24h (ex. 15:55), în loc de selectorul cu AM/PM al
 * browserului. Valoarea rămâne în același format ca înainte
 * ("YYYY-MM-DDTHH:mm", sau "" când nu e completată), deci restul
 * formularului nu se schimbă.
 */
export function DateTime24Input({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const [datePart, rawTime] = value ? value.split("T") : ["", ""];
  const timePart = (rawTime ?? "").slice(0, 5); // fără secunde
  const [timeText, setTimeText] = useState(timePart);

  // Dacă valoarea se schimbă din afară (ex. completare automată din AI), ne aliniem.
  useEffect(() => {
    setTimeText(timePart);
  }, [timePart]);

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${nextDate}T${isValidTime(nextTime) ? nextTime : "00:00"}`);
  }

  const invalid = timeText !== "" && !isValidTime(timeText);

  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={datePart ?? ""}
        onChange={(e) => emit(e.target.value, timeText)}
        className={`${className ?? ""} min-w-0 flex-1`}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        maxLength={5}
        value={timeText}
        onChange={(e) => {
          const next = formatTyped(e.target.value);
          setTimeText(next);
          if (datePart && isValidTime(next)) emit(datePart, next);
        }}
        onBlur={() => {
          if (datePart && !isValidTime(timeText)) {
            setTimeText("00:00");
            emit(datePart, "00:00");
          }
        }}
        aria-invalid={invalid}
        className={`${className ?? ""} !w-24 shrink-0 text-center ${invalid ? "border-red-400" : ""}`}
      />
    </div>
  );
}
