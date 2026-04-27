export type Mode = "light" | "dark";

export type Tokens = {
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDisabled: string;
  accent: string;
  accentText: string;
  success: string;
  danger: string;
  warning: string;
  live: string;
  backdrop: string;
};

export const TOKENS: Record<Mode, Tokens> = {
  dark: {
    surface: "#020617",          // slate-950
    surfaceElevated: "#0f172a",  // slate-900
    surfaceMuted: "#1e293b",     // slate-800
    border: "#334155",           // slate-700
    borderStrong: "#475569",     // slate-600
    text: "#e2e8f0",             // slate-200
    textMuted: "#94a3b8",        // slate-400
    textDisabled: "#64748b",     // slate-500
    accent: "#3b82f6",           // blue-500
    accentText: "#ffffff",
    success: "#10b981",          // emerald-500
    danger: "#dc2626",           // red-600
    warning: "#f59e0b",          // amber-500
    live: "#10b981",
    backdrop: "rgba(2, 6, 23, 0.65)",
  },
  light: {
    surface: "#ffffff",
    surfaceElevated: "#f8fafc",  // slate-50
    surfaceMuted: "#f1f5f9",     // slate-100
    border: "#cbd5e1",           // slate-300
    borderStrong: "#94a3b8",     // slate-400
    text: "#0f172a",             // slate-900
    textMuted: "#475569",        // slate-600
    textDisabled: "#94a3b8",     // slate-400
    accent: "#2563eb",           // blue-600
    accentText: "#ffffff",
    success: "#059669",          // emerald-600
    danger: "#dc2626",
    warning: "#d97706",          // amber-600
    live: "#059669",
    backdrop: "rgba(15, 23, 42, 0.35)",
  },
};

export function tokensFor(lightMode: boolean): Tokens {
  return lightMode ? TOKENS.light : TOKENS.dark;
}

// Apply tokens as CSS variables on :root so Tailwind utilities can reference them
export function applyTokensToRoot(lightMode: boolean) {
  const t = tokensFor(lightMode);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t)) {
    root.style.setProperty(`--tk-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, v);
  }
  root.dataset.theme = lightMode ? "light" : "dark";
}
