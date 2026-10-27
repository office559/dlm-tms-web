"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchOption = { id: string; label: string };

/** Scoate spațiile, cratimele etc. și trece totul pe litere mari: „B 901-dlm” → „B901DLM”. */
function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Evidențiază în text partea căutată (comparând fără spații/cratime). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = norm(query);
  if (!q) return <>{text}</>;
  // construim textul normalizat și harta poziție normalizată → poziție originală
  const map: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toUpperCase();
    if (/[A-Z0-9]/.test(c)) {
      flat += c;
      map.push(i);
    }
  }
  const at = flat.indexOf(q);
  if (at < 0) return <>{text}</>;
  const from = map[at];
  const to = map[at + q.length - 1] + 1;
  return (
    <>
      {text.slice(0, from)}
      <mark className="rounded bg-yellow-200 px-0 text-slate-900">{text.slice(from, to)}</mark>
      {text.slice(to)}
    </>
  );
}

/**
 * Listă de alegere cu căutare prin scris (ex. număr de înmatriculare).
 * Scrii „901” și rămâne doar B901DLM. Merge și cu tastatura: ↑ ↓ Enter Esc.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  emptyLabel = "— Niciunul —",
  className = "",
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: SearchOption[];
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    const starts: SearchOption[] = [];
    const contains: SearchOption[] = [];
    for (const o of options) {
      const n = norm(o.label);
      if (n.startsWith(q)) starts.push(o);
      else if (n.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [options, query]);

  // rândul 0 = „— Niciunul —” (doar când nu căutăm nimic)
  const showEmpty = !norm(query);
  const rows: { id: string; label: string; isEmpty?: boolean }[] = useMemo(
    () => [...(showEmpty ? [{ id: "", label: emptyLabel, isEmpty: true }] : []), ...filtered],
    [filtered, showEmpty, emptyLabel],
  );

  // închide la click în afara listei
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ține rândul activ vizibil
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    const idx = Math.max(0, options.findIndex((o) => o.id === value) + 1);
    setActive(idx);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(id: string) {
    onChange(id);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // să nu trimită formularul
      const r = rows[active];
      if (r) pick(r.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      inputRef.current?.blur();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected ? selected.label : ""}
        placeholder={open ? (selected ? selected.label : "Scrie ca să cauți…") : selected ? "" : emptyLabel}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 outline-none focus:border-brand ${className}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-300 bg-white py-1 text-slate-900 shadow-lg"
        >
          {!showEmpty && filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Nimic găsit pentru „{query}”.</li>
          )}
          {rows.map((r, i) => (
            <li
              key={r.id || "__empty"}
              role="option"
              aria-selected={r.id === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // nu pierde focusul înainte de click
                pick(r.id);
              }}
              className={`flex cursor-pointer items-center justify-between px-3 py-1.5 ${
                i === active ? "bg-brand text-white" : r.isEmpty ? "text-slate-500" : ""
              }`}
            >
              <span className={r.id === value ? "font-bold" : ""}>
                {r.isEmpty ? r.label : <Highlight text={r.label} query={query} />}
              </span>
              {r.id === value && !r.isEmpty && <span className="text-xs">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
