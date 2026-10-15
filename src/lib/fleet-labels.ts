export type FleetState =
  | "disponibil"
  | "indisponibil"
  | "pauza"
  | "alocat"
  | "tranzit"
  | "stationare"
  | "pending";

export const FLEET_STATE_LABELS: Record<FleetState, string> = {
  disponibil: "Disponibil",
  indisponibil: "Indisponibil",
  pauza: "Pauză",
  alocat: "Viitor",
  tranzit: "Tranzit",
  stationare: "Staționare",
  pending: "Pending",
};

export const FLEET_STATE_STYLES: Record<FleetState, string> = {
  disponibil: "text-slate-900 bg-green-50",
  indisponibil: "text-slate-900 bg-red-50",
  pauza: "text-slate-900 bg-sky-50",
  alocat: "text-slate-900 bg-amber-50",
  tranzit: "text-slate-900 bg-orange-50",
  stationare: "text-slate-900 bg-red-50",
  pending: "text-slate-900 bg-violet-100",
};

/**
 * Culoarea de fundal a întregului rând din Planificare, în funcție de
 * starea vehiculului — la fel ca în aplicația de referință (TruckTMS):
 * Viitor = galben, Tranzit = portocaliu, Disponibil = verde, Pauză =
 * albastru, Pending = mov deschis (așteaptă decizia dispecerului).
 * Indisponibil/Staționare rămân neutre (fără evidențiere).
 */
export const FLEET_ROW_STYLES: Record<FleetState, string> = {
  disponibil: "bg-green-200",
  indisponibil: "",
  pauza: "bg-blue-200",
  alocat: "bg-yellow-200",
  tranzit: "bg-orange-200",
  stationare: "",
  pending: "bg-violet-100",
};
