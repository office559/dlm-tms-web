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

/** Bifă dublă (ca în WhatsApp), pentru mesajul confirmat. */
function DoubleCheckIcon() {
  return (
    <svg
      viewBox="0 0 28 24"
      className="h-[13px] w-[17px] shrink-0 text-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12l5 5L18 6" />
      <path d="M11 17l1.5 1.5L24 6" />
    </svg>
  );
}

/** Ceas mic, pentru mesajul în așteptare. */
function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[13px] w-[13px] shrink-0 text-amber-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Starea mesajului WhatsApp: bifă dublă albastră = confirmat, ceas = în așteptare. Fără fundal, text normal. */
export function waBadge(state: "none" | "pending" | "confirmed", read: boolean) {
  if (state === "none") return <span className="text-slate-300 text-xs">—</span>;
  if (state === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-medium text-green-900">
        <DoubleCheckIcon />
        Confirmat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-medium text-amber-900">
      <ClockIcon />
      Pending
      {read && <span className="ml-1 text-[12.5px] font-normal text-slate-600">(citit)</span>}
    </span>
  );
}
