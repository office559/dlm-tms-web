import { formatTimeInTz, zonedTimeToDate } from "@/lib/tz";

export async function patchVehicle(id: string, body: Record<string, unknown>) {
  await fetch(`/api/vehicles/${id}/quick`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function startPauseBody(hours: number, tz: string, startTime?: string): Record<string, unknown> {
  const now = startTime ? zonedTimeToDate(startTime, tz) : new Date();
  const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const fmt = (d: Date) => formatTimeInTz(d, tz);
  return {
    pause: true,
    restDurH: hours,
    restStart: fmt(now),
    restEnd: fmt(end),
    restStartAt: now.toISOString(),
    restEndAt: end.toISOString(),
    stateOverride: null,
  };
}

export function endPauseBody(): Record<string, unknown> {
  return {
    pause: false,
    restDurH: null,
    restStart: null,
    restEnd: null,
    restStartAt: null,
    restEndAt: null,
  };
}

/** "3h 42m" / "42m" dintr-o durată în milisecunde (minim 0). */
export function fmtCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
