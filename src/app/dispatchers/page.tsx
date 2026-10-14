import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listDispatchers } from "@/lib/db";
import { InviteDispatcherForm } from "@/components/InviteDispatcherForm";
import { DeleteDispatcherButton } from "@/components/DeleteDispatcherButton";
import { AppShell } from "@/components/AppShell";
import {
  getDispatcherCounts,
  getDispatcherPricePerKm,
  type DispatcherCounts,
  type DispatcherPricePerKm,
} from "@/lib/dispatcher-stats";

/** Numele cu care apare contul principal (adminul) în pontaj. */
const ADMIN_LABEL = "Alex";

const PRESETS = [
  { key: "sapt", label: "Săptămâna aceasta" },
  { key: "sapt-trecuta", label: "Săptămâna trecută" },
  { key: "luna", label: "Luna aceasta" },
  { key: "luna-trecuta", label: "Luna trecută" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function presetRange(key: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (today.getDay() + 6) % 7; // luni = 0
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dow);

  if (key === "sapt") {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return { from: ymd(weekStart), to: ymd(end) };
  }
  if (key === "sapt-trecuta") {
    const start = new Date(weekStart);
    start.setDate(weekStart.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
  }
  if (key === "luna-trecuta") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: ymd(start), to: ymd(end) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: ymd(start), to: ymd(end) };
}

type Row = {
  id: string;
  name: string;
  active: boolean;
  counts: DispatcherCounts;
  prices: DispatcherPricePerKm[];
};

const EMPTY_COUNTS: DispatcherCounts = {
  dispatcherId: null,
  total: 0,
  finalizate: 0,
  tranzit: 0,
  planificate: 0,
  anulate: 0,
};

function sumCounts(list: DispatcherCounts[]): DispatcherCounts {
  return list.reduce(
    (acc, c) => ({
      dispatcherId: null,
      total: acc.total + c.total,
      finalizate: acc.finalizate + c.finalizate,
      tranzit: acc.tranzit + c.tranzit,
      planificate: acc.planificate + c.planificate,
      anulate: acc.anulate + c.anulate,
    }),
    EMPTY_COUNTS
  );
}

function mergePrices(list: DispatcherPricePerKm[]): DispatcherPricePerKm[] {
  const merged: DispatcherPricePerKm[] = [];
  for (const p of list) {
    const existing = merged.find((x) => x.currency === p.currency);
    if (existing) {
      existing.revenue += p.revenue;
      existing.km += p.km;
      existing.jobs += p.jobs;
    } else {
      merged.push({ ...p, dispatcherId: null });
    }
  }
  return merged;
}

function PricePerKmCell({ prices }: { prices: DispatcherPricePerKm[] }) {
  const usable = prices.filter((p) => p.km > 0);
  if (usable.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {usable.map((p) => (
        <span key={p.currency} className="whitespace-nowrap font-semibold text-slate-800">
          {(p.revenue / p.km).toFixed(2)} {p.currency}/km
        </span>
      ))}
    </div>
  );
}

export default async function DispatchersPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;

  let from: string;
  let to: string;
  let activePreset = "";
  if (isDate(params.from) && isDate(params.to)) {
    from = params.from;
    to = params.to;
    if (from > to) [from, to] = [to, from];
  } else {
    activePreset = PRESETS.some((p) => p.key === params.preset) ? (params.preset as string) : "luna";
    ({ from, to } = presetRange(activePreset));
  }

  const dispatchers = await listDispatchers();

  let counts: DispatcherCounts[] = [];
  let prices: DispatcherPricePerKm[] = [];
  let statsError = false;
  try {
    [counts, prices] = await Promise.all([
      getDispatcherCounts(from, to),
      getDispatcherPricePerKm(from, to),
    ]);
  } catch {
    statsError = true;
  }

  const countsById = new Map<string, DispatcherCounts>();
  for (const c of counts) countsById.set(c.dispatcherId ?? "", c);
  const pricesById = new Map<string, DispatcherPricePerKm[]>();
  for (const p of prices) {
    const key = p.dispatcherId ?? "";
    pricesById.set(key, [...(pricesById.get(key) ?? []), p]);
  }

  const knownIds = new Set(dispatchers.map((d) => String(d.id)));
  const adminId = String(session.user.id);
  const adminInList = knownIds.has(adminId);

  // Contul principal (Alex): cursele fără dispecer ales + cele trecute pe contul adminului.
  const isMine = (id: string | null) => !id || (!adminInList && id === adminId);
  const mineCounts = sumCounts(counts.filter((c) => isMine(c.dispatcherId)));
  const minePrices = mergePrices(prices.filter((p) => isMine(p.dispatcherId)));

  // Curse atribuite unui cont care nu mai e în lista de dispeceri (de ex. șters).
  const isOther = (id: string | null) => !!id && !isMine(id) && !knownIds.has(id);
  const otherCounts = sumCounts(counts.filter((c) => isOther(c.dispatcherId)));
  const otherPrices = mergePrices(prices.filter((p) => isOther(p.dispatcherId)));

  const rows: Row[] = dispatchers
    .map((d) => {
      const id = String(d.id);
      return {
        id,
        name: d.name,
        active: d.active,
        counts: countsById.get(id) ?? EMPTY_COUNTS,
        prices: pricesById.get(id) ?? [],
      };
    })
    .filter((r) => r.active || r.counts.total > 0);

  if (mineCounts.total > 0) {
    rows.push({
      id: "__admin__",
      name: ADMIN_LABEL,
      active: true,
      counts: mineCounts,
      prices: minePrices,
    });
  }

  rows.sort((a, b) => b.counts.total - a.counts.total || a.name.localeCompare(b.name));

  const total = sumCounts(counts);

  const pillOn = "rounded-full px-3 py-1.5 text-sm font-medium transition bg-brand text-white";
  const pillOff =
    "rounded-full px-3 py-1.5 text-sm font-medium transition bg-white border border-slate-200 text-slate-600 hover:border-brand";

  function kmJobs(list: DispatcherPricePerKm[]) {
    return list.reduce((s, p) => s + p.jobs, 0);
  }

  return (
    <AppShell active="dispatchers" crumb="Dispeceri">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Dispeceri</h1>
          <p className="text-slate-600 mt-1">
            Pontajul dispecerilor și adăugarea de dispeceri noi.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">Pontaj dispeceri</h2>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <a
                key={p.key}
                href={`/dispatchers?preset=${p.key}`}
                className={activePreset === p.key ? pillOn : pillOff}
              >
                {p.label}
              </a>
            ))}
            <form method="GET" action="/dispatchers" className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark transition"
              >
                Aplică
              </button>
            </form>
          </div>

          <p className="text-xs text-slate-500">
            Perioadă: {new Date(from).toLocaleDateString("ro-RO")} –{" "}
            {new Date(to).toLocaleDateString("ro-RO")}. Cursele sunt numărate după data de start.
            Prețul pe km = preț total (tarif + extra) / km, doar pentru cursele neanulate; km reali
            de pe bord, iar dacă lipsesc, distanța din cursă.
          </p>

          {statsError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Nu s-au putut calcula statisticile pentru această perioadă.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3">Dispecer</th>
                  <th className="px-4 py-3 text-right">Curse luate</th>
                  <th className="px-4 py-3 text-right">Finalizate</th>
                  <th className="px-4 py-3 text-right">Tranzit</th>
                  <th className="px-4 py-3 text-right">Planificate</th>
                  <th className="px-4 py-3 text-right">Anulate</th>
                  <th className="px-4 py-3">Preț mediu pe km</th>
                  <th className="px-4 py-3 text-right">Curse cu km</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">
                      {r.name}
                      {!r.active && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          Inactiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{r.counts.total}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{r.counts.finalizate}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{r.counts.tranzit}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.counts.planificate}</td>
                    <td className="px-4 py-3 text-right text-red-600">{r.counts.anulate}</td>
                    <td className="px-4 py-3">
                      <PricePerKmCell prices={r.prices} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{kmJobs(r.prices)}</td>
                  </tr>
                ))}
                {otherCounts.total > 0 && (
                  <tr className="border-t border-slate-100 text-slate-500">
                    <td className="px-4 py-3 italic">Alt cont / șters</td>
                    <td className="px-4 py-3 text-right font-semibold">{otherCounts.total}</td>
                    <td className="px-4 py-3 text-right">{otherCounts.finalizate}</td>
                    <td className="px-4 py-3 text-right">{otherCounts.tranzit}</td>
                    <td className="px-4 py-3 text-right">{otherCounts.planificate}</td>
                    <td className="px-4 py-3 text-right">{otherCounts.anulate}</td>
                    <td className="px-4 py-3">
                      <PricePerKmCell prices={otherPrices} />
                    </td>
                    <td className="px-4 py-3 text-right">{kmJobs(otherPrices)}</td>
                  </tr>
                )}
                {rows.length === 0 && otherCounts.total === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      Nicio cursă în această perioadă.
                    </td>
                  </tr>
                )}
              </tbody>
              {total.total > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{total.total}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{total.finalizate}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{total.tranzit}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{total.planificate}</td>
                    <td className="px-4 py-3 text-right text-red-600">{total.anulate}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">Adaugă dispecer</h2>
          <p className="text-slate-600 text-sm">
            Adaugă un dispecer nou și primește automat un email cu link de activare cont.
          </p>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <InviteDispatcherForm />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">Lista dispecerilor</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Adăugat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {dispatchers.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">{d.email}</td>
                    <td className="px-4 py-3">
                      {d.active ? (
                        <span className="text-green-700 bg-green-50 rounded-full px-2 py-0.5 text-xs">
                          Activ
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-xs">
                          Inactiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(d.created_at).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteDispatcherButton id={d.id} name={d.name} />
                    </td>
                  </tr>
                ))}
                {dispatchers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      Niciun dispecer încă. Trimite prima invitație mai sus.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
