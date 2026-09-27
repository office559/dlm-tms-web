import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Valorile implicite (după virgulă) sunt folosite doar dacă
        // variabilele CSS nu sunt setate — ele sunt injectate în
        // src/app/layout.tsx, pe baza culorii alese în Setări.
        brand: {
          DEFAULT: "var(--brand-color, #1e4d8b)",
          dark: "var(--brand-color-dark, #123258)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
