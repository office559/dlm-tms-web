import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1e4d8b",
          dark: "#123258",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
