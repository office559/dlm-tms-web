import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgContext } from "@/lib/org";
import { AppShell } from "@/components/AppShell";
import { TachoFirmSettings, TachoPrint, TachoUpload } from "@/components/TachoTools";
import {
  getDriverMonth,
  getFirmMonthSummary,
  listFirmDrivers,
  listRecentFiles,
  listTachoCompanies,
  parseMonth,
  ruleOf,
} from "@/lib/tacho/pontaj";
import {
  DOW_SHORT,
  MONTHS_RO,
  hm,
  monthDays,
  totalsOf,
  weeksOf,
  type PontajDay,
  type PontajTotals,
} from "@/lib/tacho/pontaj-calc";

export const dynamic = "force-dynamic";

type SP = { firma?: string; sofer?: string; luna?: string };

function money(v: number, cur: string) {
  return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} ${cur === "EUR" ? "€" : cur}`;
}

function Pills({ list }: { list: string[] }) {
  return (
    <>
      {list.map((c) => (
        <span
          key={c}
          className={`mr-1 inline-block rounded-full px-1.5 py-px text-[11px] font-bold ${
            c === "RO" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"
          }`}
        >
          {c}
        </span>
      ))}
    </>
  );
}

function Kpis({ t, cur }: { t: PontajTotals; cur: string }) {
  const items: [string, string, boolean?][] = [
    ["Zile lucrate", String(t.daysWorked)],
    ["Condus", hm(t.drive)],
    ["Alte activități", hm(t.other)],
    ["Total muncă", hm(t.work)],
    ["Ore noapte", hm(t.night)],
    ["Ore sărbători", hm(t.holidayWork)],
    ["Zile diurnă", String(t.diurnaDays), true],
    ["Diurnă totală", money(t.diurna, cur), true],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {items.map(([l, v, hl]) => (
        <div key={l} className={`rounded-xl border px-4 py-3 ${hl ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{l}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{v}</div>
        </div>
      ))}
    </div>
  );
}

function DayTable({ days, cur }: { days: PontajDay[]; cur: string }) {
  const th = "px-2.5 py-2 text-[11px] font-semibold uppercase text-slate-600";
  const td = "px-2.5 py-1.5 tabular-nums";
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className={th}>Data</th>
            <th className={th}>Început</th>
            <th className={th}>Sfârșit</th>
            <th className={`${th} text-right`}>Condus</th>
            <th className={`${th} text-right`}>Alte act.</th>
            <th className={`${th} text-right`}>Disponib.</th>
            <th className={`${th} text-right`}>Total muncă</th>
            <th className={`${th} text-right`}>Pauze</th>
            <th className={`${th} text-right`}>Odihnă</th>
            <th className={`${th} text-right`}>Noapte</th>
            <th className={`${th} text-right`}>Sărbători</th>
            <th className={th}>Țări</th>
            <th className={th}>Camion</th>
            <th className={th}>Zi</th>
            <th className={`${th} text-right`}>Diurnă</th>
          </tr>
        </thead>
        <tbody>
          {weeksOf(days).map((week, wi) => {
            const t = totalsOf(week);
            return [
              ...week.map((d) => (
                <tr key={d.day} className={`border-t border-slate-100 ${d.worked ? "" : "bg-slate-50/60 text-slate-400"}`}>
                  <td className={td}>
                    {d.day.slice(8, 10)}.{d.day.slice(5, 7)} <span className="text-[11px] text-slate-400">{DOW_SHORT[d.dow]}</span>
                    {d.isHoliday && (
                      <span title={d.holidayName} className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                        SL
                      </span>
                    )}
                    {d.manual && (
                      <span title="Conține activități introduse manual de șofer" className="ml-1 text-[10px] font-bold text-violet-600">
                        M
                      </span>
                    )}
                  </td>
                  <td className={td}>{d.start}</td>
                  <td className={td}>{d.end}</td>
                  <td className={`${td} text-right`}>{hm(d.drive)}</td>
                  <td className={`${td} text-right`}>{hm(d.other)}</td>
                  <td className={`${td} text-right`}>{hm(d.avail)}</td>
                  <td className={`${td} text-right font-bold`}>{hm(d.work)}</td>
                  <td className={`${td} text-right`}>{hm(d.breaks)}</td>
                  <td className={`${td} text-right`}>{hm(d.rest)}</td>
                  <td className={`${td} text-right`}>{hm(d.night)}</td>
                  <td className={`${td} text-right`}>{d.isHoliday ? hm(d.holidayWork) : "–"}</td>
                  <td className={td}>
                    <Pills list={d.countries} />
                  </td>
                  <td className={td}>{d.vehicles.join(", ")}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-px text-[11px] font-semibold ${
                        d.worked ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {d.worked ? "lucru" : "liber"}
                    </span>
                  </td>
                  <td className={`${td} text-right font-bold ${d.worked ? "text-slate-900" : ""}`}>{d.diurna ? money(d.diurna, cur) : ""}</td>
                </tr>
              )),
              <tr key={`w${wi}`} className="border-t border-slate-200 bg-[#e8eef7] font-bold text-brand-dark">
                <td className={td} colSpan={3}>
                  Săptămâna
                </td>
                <td className={`${td} text-right`}>{hm(t.drive)}</td>
                <td className={`${td} text-right`}>{hm(t.other)}</td>
                <td className={`${td} text-right`}>{hm(t.avail)}</td>
                <td className={`${td} text-right`}>{hm(t.work)}</td>
                <td className={`${td} text-right`}>{hm(t.breaks)}</td>
                <td className={td}></td>
                <td className={`${td} text-right`}>{hm(t.night)}</td>
                <td className={`${td} text-right`}>{hm(t.holidayWork)}</td>
                <td className={td} colSpan={3}></td>
                <td className={`${td} text-right`}>{money(t.diurna, cur)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function TachoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const isAdmin = (await getOrgContext())?.isOrgAdmin ?? false;

  const sp = await searchParams;
  const { year, month } = parseMonth(sp.luna);
  const luna = `${year}-${String(month).padStart(2, "0")}`;
  const md = monthDays(year, month);

  const companies = await listTachoCompanies();
  const enabled = companies.filter((c) => c.tacho_enabled);
  const firm = enabled.find((c) => c.id === sp.firma) ?? enabled[0];
  const rule = ruleOf(firm);

  const drivers = firm ? await listFirmDrivers(firm.id, md[0], md[md.length - 1]) : [];
  const driver = drivers.find((d) => d.card_number === sp.sofer);

  const days = driver ? await getDriverMonth(driver.card_number, year, month, rule) : [];
  const summary = firm && !driver ? await getFirmMonthSummary(firm.id, year, month, rule) : [];
  const files = await listRecentFiles(12);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ luna, ...(firm ? { firma: firm.id } : {}), ...extra });
    return p.toString();
  };
  const sources = [...new Set(days.filter((d) => d.worked).map((d) => d.source))];

  return (
    <AppShell active="tacho" crumb="Pontaj tahograf" wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-semibold text-brand-dark">Pontaj tahograf</h1>

          <form method="get" className="flex flex-wrap items-center gap-2 print:hidden">
            <label className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              Firmă:{" "}
              <select name="firma" defaultValue={firm?.id ?? ""} className="bg-transparent font-semibold outline-none">
                {enabled.length === 0 && <option value="">— nicio firmă activă —</option>}
                {enabled.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              Șofer:{" "}
              <select name="sofer" defaultValue={driver?.card_number ?? ""} className="max-w-[220px] bg-transparent font-semibold outline-none">
                <option value="">Toți șoferii (sumar)</option>
                {drivers.map((d) => (
                  <option key={d.card_number} value={d.card_number}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              Luna: <input type="month" name="luna" defaultValue={luna} className="bg-transparent font-semibold outline-none" />
            </label>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">
              Arată
            </button>
          </form>

          <TachoUpload />
          {firm && (
            <a
              href={`/api/tacho/export?${qs(driver ? { sofer: driver.card_number } : {})}`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 print:hidden"
            >
              ⬇ Excel
            </a>
          )}
          <TachoPrint />
        </div>

        {enabled.length === 0 ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
            Nicio firmă nu are pontajul activat.{" "}
            {isAdmin ? "Bifează firmele (ex. DALES MOB, DLM TRANSPORTER) în „Setări pontaj” de mai jos." : "Roagă administratorul să activeze firmele."}
          </div>
        ) : driver ? (
          <>
            <div className="text-lg font-semibold text-slate-800">
              {driver.name} · {MONTHS_RO[month - 1]} {year}
              <span className="ml-2 text-sm font-normal text-slate-500">card {driver.card_number}</span>
            </div>
            <Kpis t={totalsOf(days)} cur={rule.currency} />
            <DayTable days={days} cur={rule.currency} />
            <p className="text-xs text-slate-500">
              Sursa:{" "}
              {sources.includes("card")
                ? "cardul șoferului (complet)"
                : sources.includes("vu")
                  ? "fișierele camioanelor — arată doar timpul lucrat pe camioanele încărcate; pentru pontaj complet încarcă și cardul șoferului"
                  : "nicio activitate în această lună"}
              {" · "}zi de lucru 00:00–24:00 UTC (03:00–03:00 vara / 02:00–02:00 iarna, ora RO) · noapte 22:00–06:00 · SL = sărbătoare
              legală · M = activități introduse manual · diurnă {money(rule.abroad, rule.currency)}/zi în străinătate
              {rule.ro ? `, ${money(rule.ro, rule.currency)}/zi în România` : ""}
            </p>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold text-slate-800">
              {firm?.name} · {MONTHS_RO[month - 1]} {year} · {summary.length} șoferi
            </div>
            <Kpis
              t={summary.reduce<PontajTotals>(
                (a, s) => ({
                  daysWorked: a.daysWorked + s.totals.daysWorked,
                  drive: a.drive + s.totals.drive,
                  other: a.other + s.totals.other,
                  avail: a.avail + s.totals.avail,
                  work: a.work + s.totals.work,
                  breaks: a.breaks + s.totals.breaks,
                  night: a.night + s.totals.night,
                  holidayWork: a.holidayWork + s.totals.holidayWork,
                  diurnaDays: a.diurnaDays + s.totals.diurnaDays,
                  diurna: a.diurna + s.totals.diurna,
                }),
                { daysWorked: 0, drive: 0, other: 0, avail: 0, work: 0, breaks: 0, night: 0, holidayWork: 0, diurnaDays: 0, diurna: 0 }
              )}
              cur={rule.currency}
            />
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-100 text-left text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Șofer</th>
                    <th className="px-3 py-2">Camioane</th>
                    <th className="px-3 py-2 text-right">Zile lucrate</th>
                    <th className="px-3 py-2 text-right">Condus</th>
                    <th className="px-3 py-2 text-right">Alte act.</th>
                    <th className="px-3 py-2 text-right">Total muncă</th>
                    <th className="px-3 py-2 text-right">Noapte</th>
                    <th className="px-3 py-2 text-right">Sărbători</th>
                    <th className="px-3 py-2 text-right">Zile diurnă</th>
                    <th className="px-3 py-2 text-right">Diurnă</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                        Nicio activitate de tahograf pe camioanele acestei firme în {MONTHS_RO[month - 1].toLowerCase()} {year}. Încarcă
                        fișierele DDD (și verifică să fie camioanele trecute la firma corectă în pagina Vehicule).
                      </td>
                    </tr>
                  )}
                  {summary.map((s) => (
                    <tr key={s.card_number} className="border-t border-slate-100 tabular-nums">
                      <td className="px-3 py-2">
                        <Link href={`/tacho?${qs({ sofer: s.card_number })}`} className="font-semibold text-blue-700 hover:underline">
                          {s.name}
                        </Link>
                        {!s.driver_id && <span className="ml-2 text-[11px] text-slate-400">(nelegat de un șofer din TMS)</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{s.plates.join(", ")}</td>
                      <td className="px-3 py-2 text-right">{s.totals.daysWorked}</td>
                      <td className="px-3 py-2 text-right">{hm(s.totals.drive)}</td>
                      <td className="px-3 py-2 text-right">{hm(s.totals.other)}</td>
                      <td className="px-3 py-2 text-right font-bold">{hm(s.totals.work)}</td>
                      <td className="px-3 py-2 text-right">{hm(s.totals.night)}</td>
                      <td className="px-3 py-2 text-right">{hm(s.totals.holidayWork)}</td>
                      <td className="px-3 py-2 text-right">{s.totals.diurnaDays}</td>
                      <td className="px-3 py-2 text-right font-bold">{money(s.totals.diurna, rule.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
          <summary className="cursor-pointer px-5 py-3 text-base font-semibold text-brand-dark">📁 Ultimele fișiere încărcate</summary>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Fișier</th>
                <th className="px-4 py-2">Tip</th>
                <th className="px-4 py-2">Camion / șofer</th>
                <th className="px-4 py-2">Perioada</th>
                <th className="px-4 py-2">Încărcat</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-slate-500">
                    Niciun fișier încă.
                  </td>
                </tr>
              )}
              {files.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">
                    {f.file_name}
                    {f.warnings && <span title={f.warnings} className="ml-1 text-amber-600">⚠</span>}
                  </td>
                  <td className="px-4 py-2">
                    {f.kind === "card" ? "Card șofer" : "Camion"} <span className="text-xs text-slate-400">gen. {f.generation}</span>
                  </td>
                  <td className="px-4 py-2">{f.kind === "card" ? f.holder_name : f.plate}</td>
                  <td className="px-4 py-2">
                    {f.first_day ? `${f.first_day.slice(8, 10)}.${f.first_day.slice(5, 7)} – ${f.last_day?.slice(8, 10)}.${f.last_day?.slice(5, 7)}.${f.last_day?.slice(0, 4)}` : "—"}{" "}
                    <span className="text-xs text-slate-400">({f.days_count} zile)</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(f.uploaded_at).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {isAdmin && (
          <TachoFirmSettings
            startOpen={enabled.length === 0}
            firms={companies.map((c) => ({
              id: c.id,
              name: c.name,
              tacho_enabled: c.tacho_enabled,
              diurna_abroad: c.diurna_abroad,
              diurna_ro: c.diurna_ro,
              diurna_currency: c.diurna_currency,
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
