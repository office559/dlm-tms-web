import type { PlanningRow } from "@/components/planning-types";

/** "15.10.2026 14:00" → "15.10 · 14:00" (fără an, ca să încapă în coloană). */
function shortDateTime(label: string): string {
  if (!label) return "—";
  return label.replace(/^(\d{2}\.\d{2})\.\d{4}\s+/, "$1 · ");
}

/** Coloana „ÎNC - DSC": încărcare și descărcare, cu data și ora; sau butonul „+” când vehiculul n-are cursă. */
export function RouteCell({ row: r }: { row: PlanningRow }) {
  if (!r.jobId) {
    return (
      <a
        href={"/jobs/new?vehicleId=" + r.vehicleId}
        title="Creează cursă pentru acest vehicul"
        className="inline-grid h-6 w-6 place-items-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-brand hover:text-brand transition"
      >
        +
      </a>
    );
  }
  return (
    <div className="relative pl-5 text-[13px] leading-6">
      <span className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-slate-300" />
      <div className="relative whitespace-nowrap">
        <span className="absolute -left-[19px] top-[7px] h-2.5 w-2.5 rounded-full border-2 border-green-600 bg-white" />
        <span className="mr-1.5 font-extrabold text-blue-700">{r.loadPlace || "—"}</span>
        <span className="text-slate-600">{shortDateTime(r.loadDateLabel)}</span>
      </div>
      <div className="relative whitespace-nowrap">
        <span className="absolute -left-[19px] top-[7px] h-2.5 w-2.5 rounded-full border-2 border-red-600 bg-white" />
        <span className="mr-1.5 font-extrabold text-blue-700">{r.unloadPlace || "—"}</span>
        <span className="text-slate-600">{shortDateTime(r.unloadDateLabel)}</span>
      </div>
    </div>
  );
}
