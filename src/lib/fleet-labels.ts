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
