import { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        surface: "var(--tk-surface)",
        "surface-elevated": "var(--tk-surface-elevated)",
        "surface-muted": "var(--tk-surface-muted)",
        line: "var(--tk-border)",
        "line-strong": "var(--tk-border-strong)",
        fg: "var(--tk-text)",
        "fg-muted": "var(--tk-text-muted)",
        "fg-disabled": "var(--tk-text-disabled)",
        accent: "var(--tk-accent)",
        "accent-fg": "var(--tk-accent-text)",
        success: "var(--tk-success)",
        danger: "var(--tk-danger)",
        warning: "var(--tk-warning)",
        live: "var(--tk-live)",
        backdrop: "var(--tk-backdrop)",
      },
    },
  },
  plugins: [],
} satisfies Config;
