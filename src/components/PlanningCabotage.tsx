import type { PlanningRow } from "@/components/planning-types";

const MAX = 3;

type Tone = { pill: string; filled: string; empty: string; text: string };

const TONES: Record<"green" | "amber" | "red", Tone> = {
  green: {
    pill: "border-green-300 bg-green-100 text-green-800",
    filled: "border-green-700 bg-green-700",
    empty: "border-green-700 bg-white",
    text: "text-slate-500",
  },
  amber: {
    pill: "border-amber-300 bg-amber-100 text-amber-800",
    filled: "border-amber-700 bg-amber-700",
    empty: "border-amber-700 bg-white",
    text: "text-slate-500",
  },
  red: {
    pill: "border-red-300 bg-red-100 text-red-800",
    filled: "border-red-700 bg-red-700",
    empty: "border-red-700 bg-white",
    text: "text-red-700",
  },
};

/** Coloana „Cabotaj": țara, 3 buline (câte curse interne are) și zilele rămase din cele 7. */
export function CabotageCell({ cabotage }: { cabotage: PlanningRow["cabotage"] }) {
  if (!cabotage) return <span className="text-slate-400">—</span>;

  const { country, count, daysLeft, expired } = cabotage;
  const warn = count >= MAX || expired;
  const tone = TONES[warn ? "red" : count === 2 ? "amber" : "green"];

  let sub = "";
  if (expired) sub = "7 zile expirate";
  else if (count > MAX) sub = "limită depășită";
  else if (count === MAX) sub = "limită atinsă";
  else if (daysLeft !== null) sub = `${daysLeft} zile rămase`;

  return (
    <div
      title={`Cabotaj în ${country}: ${count} din ${MAX} curse${
        daysLeft !== null ? `, ${daysLeft} zile rămase din 7` : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`rounded-md border px-1.5 text-[12.5px] font-extrabold ${tone.pill}`}>
          {country}
        </span>
        <span className="inline-flex gap-1">
          {Array.from({ length: MAX }).map((_, i) => (
            <i
              key={i}
              className={`inline-block h-[11px] w-[11px] rounded-full border-[1.5px] ${
                i < count ? tone.filled : tone.empty
              }`}
            />
          ))}
        </span>
        {warn && <b className="text-red-700">!</b>}
      </div>
      {sub && <div className={`mt-0.5 text-[11.5px] font-normal ${tone.text}`}>{sub}</div>}
    </div>
  );
}
