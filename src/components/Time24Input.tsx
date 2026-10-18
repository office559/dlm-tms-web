"use client";

import { useEffect, useState } from "react";

/** "2030" / "20.3" / "20:30" → "20:30" (doar cifre, cu ":" după ora). */
function formatTyped(raw: string): string {
  const cleaned = raw.replace(/[^\d.:]/g, "");
  if (/[.:]/.test(cleaned)) {
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
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** "8" → "08:00", "830" → "08:30"; null dacă nu se poate completa. */
function completeTime(t: string): string | null {
  if (isValidTime(t)) return t;
  const digits = t.replace(/\D/g, "");
  let h = "";
  let m = "00";
  if (digits.length === 1 || digits.length === 2) h = digits.padStart(2, "0");
  else if (digits.length === 3) {
    h = digits.slice(0, 1).padStart(2, "0");
    m = digits.slice(1);
  } else if (digits.length === 4) {
    h = digits.slice(0, 2);
    m = digits.slice(2);
  } else return null;
  const out = `${h}:${m}`;
  return isValidTime(out) ? out : null;
}

/**
 * Oră în format 24h (ex. 20:30), în loc de selectorul cu AM/PM al browserului.
 * Valoarea rămâne "HH:MM" (sau "" când e goală), ca la câmpul vechi de tip „time”.
 * Se trimite mai departe doar o oră validă; la ieșirea din câmp, o oră
 * incompletă se completează (ex. 8 → 08:00) sau revine la ultima oră validă.
 */
export function Time24Input({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value);

  // Dacă valoarea se schimbă din afară (ex. la deschiderea ferestrei), ne aliniem.
  useEffect(() => {
    setText(value);
  }, [value]);

  const invalid = text !== "" && !isValidTime(text);

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      maxLength={5}
      value={text}
      disabled={disabled}
      aria-invalid={invalid}
      onChange={(e) => {
        const next = formatTyped(e.target.value);
        setText(next);
        if (isValidTime(next)) onChange(next);
      }}
      onBlur={() => {
        if (text === "" || isValidTime(text)) return;
        const done = completeTime(text);
        if (done) {
          setText(done);
          onChange(done);
        } else {
          setText(value); // revine la ultima oră validă
        }
      }}
      className={`${className ?? ""} ${invalid ? "border-red-400" : ""}`}
    />
  );
}
