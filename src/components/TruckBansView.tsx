"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, SOURCES, type CountryCode, type CountryInfo } from "@/lib/truck-bans-data";
import {
  banDaysInMonth,
  dayNumber,
  monthLabel,
  statusFor,
  type BanDay,
  type BanKind,
} from "@/lib/truck-bans";

const KIND_STYLES: Record<BanKind, string> = {
  holiday: "bg-red-100 text-red-800",
  sunday: "bg-indigo-100 text-indigo-800",
  saturday: "bg-orange-100 text-orange-800",
  summer: "bg-yellow-100 text-yellow-800",
  eve: "bg-pink-100 text-pink-800",
  route: "bg-slate-100 text-slate-700",
};

function heat(n: number): string {
  if (n === 0) return "bg-slate-100 text-slate-400";
  if (n <= 4) return "bg-green-200 text-slate-900";
  if (n <= 7) return "bg-yellow-200 text-slate-900";
  if (n <= 10) return "bg-orange-200 text-slate-900";
  return "bg-red-300 text-slate-900";
}

function CodeBadge({ code }: { code: string }) {
  return (
    <span className="inline-grid h-6 w-8 shrink-0 place-items-center rounded-md bg-slate-800 text-[11px] font-extrabold tracking-wide text-white">
      {code}
    </span>
  );
}

function DayChips({ days, compact }: { days: BanDay[]; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {days.map((d) =>
        d.entries.map((e, i) => (
          <span
            key={`${d.date}-${i}`}
            title={`${e.label}${e.scope ? ` (${e.scope})` : ""}`}
            className={`rounded-lg px-2 py-1 text-xs font-bold ${KIND_STYLES[e.kind]}`}
          >
            {d.weekday} {dayNumber(d.date)} · {e.hours}
            {!compact && e.label ? ` · ${e.label}` : ""}
            {!compact && e.scope ? ` (${e.scope})` : ""}
          </span>
        )),
      )}
    </div>
  );
}

export function TruckBansView({ months, currentMonth }: { months: string[]; currentMonth: string }) {
  const [code, setCode] = useState<CountryCode | null>(null);
  const [month, setMonth] = useState(months[0]);

  // zilele cu interdicții, calculate o singură dată pentru toată matricea
  const grid = useMemo(() => {
    const out: Record<string, BanDay[]> = {};
    for (const c of COUNTRIES) for (const m of months) out[`${c.code}|${m}`] = banDaysInMonth(c.code, m);
    return out;
  }, [months]);

  const selected: CountryInfo | null = code ? COUNTRIES.find((c) => c.code === code) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="tb-panel overflow-x-auto p-3">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="min-w-[130px]" />
              {months.map((m) => (
                <th key={m} className="p-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCode(null);
                      setMonth(m);
                    }}
                    title="Vezi toate țările în luna aceasta"
                    className={`w-full rounded-lg px-1 py-1 text-[11px] font-bold leading-tight ${
                      m === month && !code ? "tb-active" : "tb-muted tb-hover"
                    } ${m === currentMonth ? "ring-2 ring-orange-400" : ""}`}
                  >
                    {monthLabel(m).split(" ")[0]}
                    <br />
                    <span className="font-medium opacity-60">{m.slice(2, 4)}</span>
                  </button>
                </th>
              ))}
              <th className="tb-muted hidden pl-3 text-left text-[11px] font-bold xl:table-cell">
                Regula permanentă
              </th>
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.map((c) => (
              <tr key={c.code}>
                <td className="whitespace-nowrap pr-2">
                  <button
                    type="button"
                    onClick={() => setCode(c.code)}
                    className="tb-text flex items-center gap-2 text-left font-bold hover:underline"
                  >
                    <CodeBadge code={c.code} />
                    {c.name}
                  </button>
                </td>
                {months.map((m) => {
                  const n = grid[`${c.code}|${m}`].length;
                  const st = statusFor(c, m);
                  const isSel = code === c.code && month === m;
                  const label = st === "unknown" ? "?" : n === 0 ? "—" : `${n}${st === "provisional" ? "*" : ""}`;
                  const color =
                    st === "unknown"
                      ? "border border-dashed border-slate-300 bg-white text-slate-500"
                      : heat(n);
                  return (
                    <td key={m} className="p-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCode(c.code);
                          setMonth(m);
                        }}
                        title={`${c.name} · ${monthLabel(m, true)}`}
                        className={`grid h-9 w-full min-w-[34px] place-items-center rounded-lg text-sm font-extrabold transition hover:brightness-95 ${color} ${
                          isSel ? "tb-ring" : ""
                        }`}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
                <td className="tb-muted hidden whitespace-nowrap pl-3 text-xs xl:table-cell">{c.permanent}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tb-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs">
          <span className="font-semibold">Zile cu interdicție pe lună:</span>
          <span className="rounded-md bg-green-200 px-2 py-0.5 font-bold text-slate-900">1–4</span>
          <span className="rounded-md bg-yellow-200 px-2 py-0.5 font-bold text-slate-900">5–7</span>
          <span className="rounded-md bg-orange-200 px-2 py-0.5 font-bold text-slate-900">8–10</span>
          <span className="rounded-md bg-red-300 px-2 py-0.5 font-bold text-slate-900">11+</span>
          <span>„—” nicio zi</span>
          <span>„*” estimat (calendar oficial nepublicat)</span>
          <span>„?” fără date încă</span>
        </div>
      </div>

      <div className="tb-panel p-5">
        {selected ? (
          <CountryDetail
            country={selected}
            month={month}
            days={grid[`${selected.code}|${month}`]}
            status={statusFor(selected, month)}
          />
        ) : (
          <AllCountries month={month} grid={grid} />
        )}
      </div>

      <div className="tb-panel tb-muted p-5 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="tb-text">Culori:</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.holiday}`}>sărbătoare legală</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.sunday}`}>duminică</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.saturday}`}>sâmbătă</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.summer}`}>vară</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.eve}`}>ajun de sărbătoare</span>
          <span className={`rounded-lg px-2 py-1 ${KIND_STYLES.route}`}>pe rută</span>
        </div>
        <p>
          Orele sunt în ora locală a țării, pentru camioane peste pragul de tonaj din fiecare țară. Datele sunt adunate
          din calendare oficiale și surse specializate și pot avea excepții (marfă perisabilă, transport combinat etc.).
          Verifică întotdeauna sursa oficială înainte de plecare.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="tb-link font-semibold underline">
              {s.label}
            </a>
          ))}
        </p>
      </div>
    </div>
  );
}

function AllCountries({ month, grid }: { month: string; grid: Record<string, BanDay[]> }) {
  return (
    <div>
      <h2 className="tb-title mb-3 text-xl font-extrabold">Toate țările · {monthLabel(month, true)}</h2>
      <div className="space-y-2">
        {COUNTRIES.map((c) => {
          const days = grid[`${c.code}|${month}`];
          const st = statusFor(c, month);
          return (
            <div key={c.code} className="grid gap-2 rounded-xl bg-slate-50 px-3 py-2.5 md:grid-cols-[190px_1fr]">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <CodeBadge code={c.code} />
                <span>{c.name}</span>
                <span className="text-xs font-medium text-slate-500">{c.weight.split(" (")[0]}</span>
              </div>
              <div>
                {st === "unknown" ? (
                  <span className="text-sm text-slate-500">Calendar nepublicat încă.</span>
                ) : days.length ? (
                  <>
                    <DayChips days={days} compact />
                    {st === "provisional" && <p className="mt-1 text-xs text-slate-500">* estimat din regula permanentă</p>}
                  </>
                ) : c.code === "BE" || c.code === "NL" ? (
                  <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
                    Fără interdicție generală
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">Nicio interdicție în luna aceasta.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountryDetail({
  country,
  month,
  days,
  status,
}: {
  country: CountryInfo;
  month: string;
  days: BanDay[];
  status: "known" | "provisional" | "unknown";
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <CodeBadge code={country.code} />
        <h2 className="tb-title text-xl font-extrabold">
          {country.name} · {monthLabel(month, true)}
        </h2>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{country.weight}</span>
      </div>
      <p className="tb-text mb-3 text-sm font-semibold">{country.permanent}</p>

      {status === "unknown" ? (
        <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Calendarul oficial pentru această perioadă nu e publicat încă.
        </p>
      ) : days.length ? (
        <div className="mb-3">
          <DayChips days={days} />
          {status === "provisional" && (
            <p className="tb-warn mt-2 text-xs font-semibold">
              * Estimat din regula permanentă — calendarul oficial pentru perioada aceasta nu e publicat încă.
            </p>
          )}
        </div>
      ) : (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          Nicio zi cu interdicție în luna aceasta.
        </p>
      )}

      <ul className="tb-muted list-disc space-y-1 pl-5 text-sm">
        {country.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
