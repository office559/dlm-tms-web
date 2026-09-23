import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listJobsBetween, listUnscheduledJobs } from "@/lib/planning";
import { listCustomers } from "@/lib/customers";
import { listDrivers } from "@/lib/drivers";
import { listVehicles } from "@/lib/vehicles";

const STATUS_STYLES: Record<string, string> = {
  planificare: "text-slate-600 bg-slate-100",
  activ: "text-blue-700 bg-blue-50",
  finalizat: "text-green-700 bg-green-50",
  anulat: "text-red-700 bg-red-50",
};

const DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const anchor = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : toISODate(new Date());
  const monday = mondayOf(anchor);
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const prevWeek = toISODate(addDays(monday, -7));
  const nextWeek = toISODate(addDays(monday, 7));

  const [jobs, unscheduled, customers, drivers, vehicles] = await Promise.all([
    listJobsBetween(toISODate(monday), toISODate(sunday)),
    listUnscheduledJobs(),
    listCustomers(),
    listDrivers(),
    listVehicles(),
  ]);

  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plate]));

  const jobsByDay = new Map<string, typeof jobs>();
  for (const day of days) jobsByDay.set(toISODate(day), []);
  for (const j of jobs) {
    if (!j.start_at) continue;
    const key = toISODate(new Date(j.start_at));
    if (jobsByDay.has(key)) jobsByDay.get(key)!.push(j);
  }

  const todayKey = toISODate(new Date());

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Planificare</h1>
          <p className="text-slate-600 mt-1">
            Săptămâna {toISODate(monday)} — {toISODate(sunday)}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/planning?week=${prevWeek}`} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
            ← Săptămâna trecută
          </a>
          <a href={`/planning?week=${todayKey}`} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
            Azi
          </a>
          <a href={`/planning?week=${nextWeek}`} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
            Săptămâna viitoare →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day, i) => {
          const key = toISODate(day);
          const dayJobs = jobsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className={`bg-white rounded-2xl border p-3 space-y-2 min-h-[160px] ${isToday ? "border-brand" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">{DAY_NAMES[i]}</p>
                <p className="text-xs text-slate-400">{day.getDate()}/{day.getMonth() + 1}</p>
              </div>
              <div className="space-y-2">
                {dayJobs.map((j) => (
                  <a key={j.id} href={`/jobs/${j.id}`} className="block rounded-lg border border-slate-100 bg-slate-50 p-2 hover:bg-slate-100 transition">
                    <p className="text-xs font-medium text-brand-dark truncate">
                      {j.load_place || "—"} → {j.unload_place || "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {j.client_id ? customerName.get(j.client_id) ?? "—" : "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {j.driver_id ? driverName.get(j.driver_id) ?? "—" : "—"}
                      {j.vehicle_id ? ` · ${vehiclePlate.get(j.vehicle_id) ?? "—"}` : ""}
                    </p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLES[j.status] ?? "text-slate-600 bg-slate-100"}`}>
                      {j.status}
                    </span>
                  </a>
                ))}
                {dayJobs.length === 0 && <p className="text-xs text-slate-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-medium text-brand-dark">Curse neprogramate</h2>
          <p className="text-xs text-slate-400">Curse fără dată de start (max. 20 cele mai recente)</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2">Traseu</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Șofer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {unscheduled.map((j) => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{j.load_place || "—"} → {j.unload_place || "—"}</td>
                <td className="px-4 py-2">{j.client_id ? customerName.get(j.client_id) ?? "—" : "—"}</td>
                <td className="px-4 py-2">{j.driver_id ? driverName.get(j.driver_id) ?? "—" : "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[j.status] ?? "text-slate-600 bg-slate-100"}`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <a href={`/jobs/${j.id}`} className="text-brand hover:text-brand-dark text-sm">
                    Editează
                  </a>
                </td>
              </tr>
            ))}
            {unscheduled.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nicio cursă neprogramată.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
