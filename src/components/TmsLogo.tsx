/** Logo TMS (varianta E: chevroane înainte + cuvântul TMS), desenat direct în cod. */
export function TmsLogo() {
  return (
    <svg viewBox="0 0 340 96" className="block h-auto w-full" role="img" aria-label="TMS — Transport Management">
      <defs>
        <linearGradient id="tmsLogoGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <g transform="translate(2,6) scale(1.38)">
        <path d="M10 14 L28 32 L10 50" fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 14 L46 32 L28 50" fill="none" stroke="url(#tmsLogoGrad)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
        <path d="M44 22 L54 32 L44 42" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text
        x="104"
        y="60"
        fontFamily="Inter, ui-sans-serif, system-ui, Arial, sans-serif"
        fontWeight={900}
        fontSize="54"
        letterSpacing="-1.5"
        fill="#0f172a"
      >
        TMS
      </text>
      <text
        x="106"
        y="80"
        fontFamily="Inter, ui-sans-serif, system-ui, Arial, sans-serif"
        fontWeight={700}
        fontSize="11"
        letterSpacing="2.4"
        fill="#64748b"
      >
        TRANSPORT MANAGEMENT
      </text>
    </svg>
  );
}

/** Doar simbolul (chevroanele) — pentru meniul strâns. */
export function TmsMark() {
  return (
    <svg viewBox="6 10 52 44" className="block h-6 w-auto" role="img" aria-label="TMS">
      <defs>
        <linearGradient id="tmsMarkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M10 14 L28 32 L10 50" fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 14 L46 32 L28 50" fill="none" stroke="url(#tmsMarkGrad)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
      <path d="M44 22 L54 32 L44 42" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
