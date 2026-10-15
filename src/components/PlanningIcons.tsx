"use client";

/** Iconiță simplă de camion, pentru coloana Vehicul. */
export function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 17h1a1 1 0 0 0 1-1v-2.5a1 1 0 0 0-.29-.7l-2.5-2.5a1 1 0 0 0-.71-.3H10" />
      <path d="M3 6h9v10H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

/** Săgeată mică (chevron) decorativă, lângă numărul de înmatriculare. */
export function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Iconiță „mâner de tragere" (⠿), arată că antetul coloanei se poate muta. */
export function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="currentColor">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

/** Iconiță de resetare (săgeți circulare), pentru butonul „Resetează coloanele". */
export function ResetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 21v-6h6" />
    </svg>
  );
}

export function waBadge(state: "none" | "pending" | "confirmed", read: boolean) {
  if (state === "none") return <span className="text-slate-300 text-xs">—</span>;
  if (state === "confirmed") {
    return (
      <span className="whitespace-nowrap rounded-full bg-green-300 px-3 py-[3px] text-[13px] font-extrabold text-green-900">
        Confirmat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="rounded-full bg-amber-300 px-3 py-[3px] text-[13px] font-extrabold text-amber-900">
        Pending
      </span>
      {read && <span className="text-[12.5px] font-bold text-slate-600">(citit)</span>}
    </span>
  );
}
