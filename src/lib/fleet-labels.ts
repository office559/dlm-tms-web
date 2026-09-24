export type FleetState =
  | "disponibil"
  | "indisponibil"
  | "pauza"
  | "alocat"
  | "tranzit"
  | "stationare";

export const FLEET_STATE_LABELS: Record<FleetState, string> = {
  disponibil: "Disponibil",
  indisponibil: "Indisponibil",
  pauza: "Pauză",
  alocat: "Viitor",
  tranzit: "Tranzit",
  stationare: "Staționare",
};

export const FLEET_STATE_STYLES: Record<FleetState, string> = {
  disponibil: "text-green-700 bg-green-50",
  indisponibil: "text-red-700 bg-red-50",
  pauza: "text-sky-700 bg-sky-50",
  alocat: "text-amber-700 bg-amber-50",
  tranzit: "text-orange-700 bg-orange-50",
  stationare: "text-red-700 bg-red-50",
};

/**
 * Culoarea de fundal a întregului rând din Planificare, în funcție de
 * starea vehiculului — la fel ca în aplicația de referință (TruckTMS):
 * Viitor = galben, Tranzit = portocaliu, Disponibil = verde, Pauză =
 * albastru. Indisponibil/Staționare rămân neutre (fără evidențiere).
 */
export const FLEET_ROW_STYLES: Record<FleetState, string> = {
  disponibil: "bg-green-50",
  indisponibil: "",
  pauza: "bg-sky-100",
  alocat: "bg-yellow-100",
  tranzit: "bg-orange-100",
  stationare: "",
};
