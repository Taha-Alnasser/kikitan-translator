# Kikitan Polish Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Kikitan from "good for personal use" to production polish: fix five user-visible reliability bugs and unify the look-and-feel without rewriting recognizer / translator / Tauri code.

**Architecture:** Introduce a small theme-tokens module + MUI ThemeProvider so every surface respects light/dark consistently. Wrap every modal in one shared `Modal.tsx` shell. Centralize the 4-recognizer lifecycle in a single `recognizers.ts` helper so language/mode changes are deterministic. Decompose the 576-line `Kikitan.tsx` into a status strip + 3 cards, and split the 698-line `Settings.tsx` into per-tab files of ≤150 lines.

**Tech stack:** React 18 + TypeScript + MUI 6 + Tailwind 3 + Tauri 2. No new test framework — verification is TypeScript compile + dev run (`npm run devtauri`) + manual checklist (spec §10).

**Spec:** `docs/superpowers/specs/2026-04-26-kikitan-polish-pass-design.md`

---

## Verification rule

Every task that touches code ends with one of these as the failing/passing test:
- `npm run build` (must succeed) — proves TypeScript + Vite compile.
- `npm run devtauri` and visually verify the listed manual-checklist item from spec §10.

There is no Jest/Vitest in this codebase and the user did not request one — do not introduce a test framework.

---

## Task 1: Theme tokens + MUI theme + Tailwind extension

**Why:** Today every component hard-codes `bg-white` / `bg-slate-950` / `text-black` etc., and Settings forces `bg-white` regardless of light_mode. We need one source of truth before doing anything else.

**Files:**
- Create: `src/style/tokens.ts`
- Create: `src/style/theme.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/globals.css`

- [ ] **Step 1: Create the token map**

Write `src/style/tokens.ts`:

```ts
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
```

- [ ] **Step 2: Create the MUI theme**

Write `src/style/theme.ts`:

```ts
import { createTheme, Theme } from "@mui/material/styles";
import { tokensFor } from "./tokens";

export function makeMuiTheme(lightMode: boolean): Theme {
  const t = tokensFor(lightMode);
  return createTheme({
    palette: {
      mode: lightMode ? "light" : "dark",
      primary: { main: t.accent, contrastText: t.accentText },
      error: { main: t.danger },
      success: { main: t.success },
      warning: { main: t.warning },
      background: { default: t.surface, paper: t.surfaceElevated },
      text: { primary: t.text, secondary: t.textMuted, disabled: t.textDisabled },
      divider: t.border,
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: { borderColor: t.border },
          root: { color: t.text, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: t.borderStrong } },
        },
      },
      MuiSelect: { styleOverrides: { icon: { color: t.textMuted } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: t.surfaceElevated, color: t.text } } },
      MuiMenuItem: { styleOverrides: { root: { color: t.text } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiSwitch: { styleOverrides: { root: { /* MUI defaults follow palette */ } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: t.surfaceMuted, color: t.text, border: `1px solid ${t.border}` } } },
    },
  });
}
```

- [ ] **Step 3: Extend Tailwind to expose token CSS variables**

Edit `tailwind.config.ts` — add a `theme.extend.colors` section that maps semantic names to the CSS variables set in Step 1:

```ts
// inside theme.extend
colors: {
  surface: "var(--tk-surface)",
  "surface-elevated": "var(--tk-surface-elevated)",
  "surface-muted": "var(--tk-surface-muted)",
  border: "var(--tk-border)",
  "border-strong": "var(--tk-border-strong)",
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
```

Note: Tailwind already has its own `border` color utility. Our `border` here is the **color value** used as `bg-border`, `text-border`, etc. To override the default `border-DEFAULT`, also set `borderColor.DEFAULT: "var(--tk-border)"` under `theme.extend`. Verify by checking the existing config; if collisions are awkward, name ours `line` instead of `border`.

- [ ] **Step 4: Wire ThemeProvider + applyTokensToRoot in page.tsx**

In `src/page.tsx`, import `ThemeProvider` from `@mui/material/styles`, the `makeMuiTheme` helper, and `applyTokensToRoot` from `tokens.ts`. Wrap the entire returned JSX in `<ThemeProvider theme={makeMuiTheme(config.light_mode)}>`. Add a useEffect:

```tsx
React.useEffect(() => { applyTokensToRoot(config.light_mode); }, [config.light_mode]);
```

Place this above the existing useEffects.

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: build succeeds; no TypeScript errors. App still renders identically (we haven't replaced any colors yet).

- [ ] **Step 6: Commit**

```bash
git add src/style/ tailwind.config.ts src/page.tsx src/globals.css
git commit -m "feat(theme): add token system + MUI theme provider"
```

---

## Task 2: Modal shell component

**Why:** Six modals each duplicate the dim+blur+rounded-card pattern with diverging colors. Single shell = consistent.

**Files:**
- Create: `src/components/Modal.tsx`

- [ ] **Step 1: Implement the Modal component**

Write `src/components/Modal.tsx`:

```tsx
import * as React from "react";
import { IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

type Size = "sm" | "md" | "lg" | "xl";

const sizeCls: Record<Size, string> = {
  sm: "w-6/12 max-w-md",
  md: "w-8/12 max-w-2xl",
  lg: "w-10/12 max-w-4xl",
  xl: "w-11/12 max-w-6xl",
};

type Props = {
  open: boolean;
  onClose?: () => void;
  size?: Size;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** When true, the close button is hidden (e.g. updater progress). */
  hideClose?: boolean;
  /** When true, clicking the backdrop does NOT close the modal. */
  persistent?: boolean;
  /** Optional z-index override. */
  z?: number;
};

export default function Modal({ open, onClose, size = "md", title, children, hideClose, persistent, z = 30 }: Props) {
  return (
    <div
      className={`transition-all w-full h-screen flex backdrop-blur-sm justify-center items-center absolute ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ zIndex: z, background: "var(--tk-backdrop)" }}
      onClick={() => { if (!persistent && onClose) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col rounded-xl border ${sizeCls[size]} max-h-[85vh] overflow-hidden`}
        style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)", color: "var(--tk-text)" }}
      >
        {(title || (!hideClose && onClose)) && (
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--tk-border)" }}>
            <div className="font-semibold text-sm">{title}</div>
            {!hideClose && onClose && (
              <IconButton size="small" onClick={onClose} aria-label="Close">
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "feat(ui): add unified Modal shell"
```

---

## Task 3: Migrate existing modals to Modal shell

**Why:** Apply the unified shell so all modals look the same and respect the theme.

**Files:**
- Modify: `src/page.tsx` (settings, donate, google-error, updater modals)
- Modify: `src/pages/Kikitan.tsx` (message-history, text-input modals)

Note: the Quickstart and Changelogs modals are larger and re-styled in Task 13/16 — leave them on the existing wrapper for now, only the inner contents will be retoken-ed later.

- [ ] **Step 1: Replace settings modal in page.tsx**

Find the `settingsVisible` block in `page.tsx` (around line 206) and replace with:

```tsx
<Modal open={settingsVisible} onClose={() => setSettingsVisible(false)} size="lg" title="Settings">
  <SettingsPage lang={lang} config={config} setConfig={setConfig} closeCallback={() => setSettingsVisible(false)} />
</Modal>
```

Remove the surrounding `bg-white` div. Note: `SettingsPage` will get its own theme treatment in Task 12; here we just swap the wrapper.

- [ ] **Step 2: Replace updater, donate, google-error modals**

Updater (around line 168):

```tsx
<Modal open={updateVisible} size="md" hideClose persistent>
  <div className="flex items-center justify-center p-6 gap-4">
    <CircularProgress />
    <p className="text-2xl">{localization.updating[lang]}</p>
  </div>
</Modal>
```

Donate (around line 177): replace outer wrapper with `<Modal open={donateVisible && !quickstartVisible} onClose={() => setDonateVisible(false)} size="md" title={null}>` and unwrap the inner card div (Modal provides the card now).

Google-error (around line 195): same pattern, `size="md"`, title `localization.error[lang]` if available, otherwise omit.

- [ ] **Step 3: Replace message-history and text-input modals in Kikitan.tsx**

Find the two `transition-all z-20` blocks (around lines 386 and 412) and replace with `<Modal open={...} onClose={...} size="md" title=...>`. Unwrap the inner card.

- [ ] **Step 4: Verify**

Run: `npm run devtauri`
Open each modal in turn (Settings, Donate-by-localStorage trickery or manual testing, Message-history, Text-input). Verify: all have the same border + backdrop, all close via the X button or backdrop click, dark/light theme applies correctly.

- [ ] **Step 5: Commit**

```bash
git add src/page.tsx src/pages/Kikitan.tsx
git commit -m "refactor(ui): use Modal shell for app modals"
```

---

## Task 4: Recognizer lifecycle helper

**Why:** Today the same switch-on-`recognition_service` block is repeated four times in `Kikitan.tsx`, and stop/start ordering is ad hoc, which is a likely cause of the language-switch bug. We centralize the four recognizer roles into one helper that exposes `restart(role, opts)`. No recognizer behavior changes.

**Files:**
- Create: `src/util/recognizers.ts`

- [ ] **Step 1: Implement the helper**

Write `src/util/recognizers.ts`:

```ts
import { info, warn } from "@tauri-apps/plugin-log";
import { Recognizer } from "../recognizers/recognizer";
import { EdgeSTT } from "../recognizers/EdgeSTT";
import { VAD } from "../recognizers/VAD";
import { WebSpeech } from "../recognizers/WebSpeech";
import { Config } from "./config";
import { localization } from "./localization";
import { Lang } from "./constants";

export type RecognizerRole = "chatbox" | "desktop" | "overlay1" | "overlay2";

export type RecognizerOptions = {
  source: string;
  target: string;
  /** STT-only mode = true means transcription only, no translation. */
  sttOnly: boolean;
  /** Pass-through to recognizer constructors. */
  setSRLoading: ((loading: boolean) => void) | null;
  showNotification: (msg: string, sev?: "success" | "error" | "warning" | "info") => void;
  setConfig: (config: Config) => void;
  /** Result handler. Replaces any previous handler. */
  onResult: (result: string[], isFinal: boolean) => void;
};

const instances: Partial<Record<RecognizerRole, Recognizer>> = {};

function constructFor(
  service: number,
  role: RecognizerRole,
  opts: RecognizerOptions,
): Recognizer | null {
  // Desktop: source/target are deliberately swapped (reverse direction).
  // Match the existing semantics from Kikitan.tsx.
  const desktop = role === "desktop";
  const src = desktop ? opts.target : opts.source;
  const tgt = desktop ? opts.source : opts.target;
  switch (service) {
    case 0: return new EdgeSTT(src, tgt, desktop, opts.sttOnly, opts.setSRLoading, opts.showNotification, opts.setConfig);
    case 1: return new VAD(src, tgt, desktop, opts.sttOnly, opts.setSRLoading, opts.showNotification, opts.setConfig);
    case 2:
      if (desktop) {
        opts.showNotification(localization.cannot_use_webspeech_for_desktop_translation["en" as Lang] ?? "WebSpeech can't be used for desktop translation", "warning");
        return null;
      }
      return new WebSpeech(src, tgt, opts.sttOnly, opts.setSRLoading, opts.showNotification, opts.setConfig);
    default:
      return null;
  }
}

/** Stop the recognizer for `role` if running, and clear references. Idempotent. */
export function stop(role: RecognizerRole): void {
  const r = instances[role];
  if (!r) return;
  try { r.stop(); } catch (e) { warn(`[REC] ${role} stop threw: ${e}`); }
  instances[role] = undefined;
}

/** Stop everything. */
export function stopAll(): void {
  (Object.keys(instances) as RecognizerRole[]).forEach(stop);
}

/** Stop + reconstruct + start for `role` with new options. The single source of truth for restart. */
export function restart(role: RecognizerRole, service: number, opts: RecognizerOptions): void {
  stop(role);
  const r = constructFor(service, role, opts);
  if (!r) {
    info(`[REC] ${role} not started (service ${service} unsupported for this role)`);
    return;
  }
  r.onResult(opts.onResult);
  instances[role] = r;
  info(`[REC] ${role} starting: ${opts.source} → ${opts.target} (service=${service}, sttOnly=${opts.sttOnly})`);
  try { r.start(); } catch (e) { warn(`[REC] ${role} start threw: ${e}`); }
}

/** Start all currently-instantiated recognizers (used after pause). */
export function resumeAll(): void {
  (Object.keys(instances) as RecognizerRole[]).forEach((role) => {
    try { instances[role]?.start(); } catch (e) { warn(`[REC] ${role} resume threw: ${e}`); }
  });
}

/** Stop all currently-instantiated recognizers without clearing them (pause). */
export function pauseAll(): void {
  (Object.keys(instances) as RecognizerRole[]).forEach((role) => {
    try { instances[role]?.stop(); } catch (e) { warn(`[REC] ${role} pause threw: ${e}`); }
  });
}

/** Whether a role currently has an instance. */
export function isRunning(role: RecognizerRole): boolean {
  return instances[role] != null;
}

/** Forward a manual text trigger to the chatbox recognizer (for the type-message UI). */
export function triggerChatbox(text: string): void {
  instances.chatbox?.manual_trigger(text);
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: succeeds. `Recognizer` base class only has `start/stop/onResult/manual_trigger/status/name` — we use `start`, `stop`, `onResult`, `manual_trigger`. No new methods needed.

- [ ] **Step 3: Commit**

```bash
git add src/util/recognizers.ts
git commit -m "feat(rec): add centralized recognizer lifecycle helper"
```

---

## Task 5: Migrate Kikitan.tsx to use recognizers helper

**Why:** Remove the four module-level `let sr/sr1/sr2/desktopSR` globals, the four duplicate switch-on-service blocks, and the `languageUpdate` flag dance. This refactor changes no observable behavior on its own; the bug fixes come in Task 6.

**Files:**
- Modify: `src/pages/Kikitan.tsx`

- [ ] **Step 1: Remove module-level recognizer globals**

In `Kikitan.tsx`, delete the lines (around 73-83):

```ts
let sr: Recognizer | null = null;
let sr1: Recognizer | null = null;
let sr2: Recognizer | null = null;
let desktopSR: Recognizer | null = null;
// ... restartTimeout, lastQueuedText, lastQueuedTime can stay (queue-related)
```

Replace `restartTimeout` usage entirely (the timeout is no longer needed — see Task 6).

Add at the top:

```ts
import * as recognizers from "../util/recognizers";
```

- [ ] **Step 2: Replace `restartSR`**

Replace the existing `restartSR` function with:

```ts
const restartChatbox = () => {
  if ((config.translator_settings.translation_service == 2 || config.translator_settings.recognition_service == 1) && config.groq.api_key.length == 0) {
    showNotification(localization.no_api_key_configured_for_groq[lang], "warning");
  }
  // Reset live UI state so old text doesn't linger after a language/mode change
  setDetection(""); setTranslated(""); setResult([]);
  recognizers.restart("chatbox", config.translator_settings.recognition_service, {
    source: sourceLanguage,
    target: targetLanguage,
    sttOnly: config.mode === 1,
    setSRLoading,
    showNotification,
    setConfig,
    onResult: (result, isFinal) => {
      setDetecting(!isFinal);
      setResult(result);
    },
  });
};
```

- [ ] **Step 3: Replace `restartDesktopSR`**

```ts
const restartDesktop = () => {
  if (!config.translator_settings.desktop_translation) {
    recognizers.stop("desktop");
    setDesktopResult("");
    return;
  }
  setDesktopResult("");
  recognizers.restart("desktop", config.translator_settings.recognition_service, {
    source: sourceLanguage,
    target: targetLanguage,
    sttOnly: false,
    setSRLoading: null,
    showNotification,
    setConfig,
    onResult: async (result, isFinal) => {
      if (config.data_out.enable_desktop_data) {
        send_desktop_recognition(result[0], isFinal);
        if (isFinal) send_desktop_translation(result[1]);
      }
      if (isFinal) setDesktopResult(result[1]);
    },
  });
};
```

- [ ] **Step 4: Replace `restartOverlay1SR` / `restartOverlay2SR`**

```ts
const restartOverlay = (n: 1 | 2) => {
  const role = (n === 1 ? "overlay1" : "overlay2") as recognizers.RecognizerRole;
  const cfg = configRef.current;
  const ov = n === 1 ? cfg.screen_overlay : cfg.screen_overlay_2;
  const channel = n === 1 ? "screen-overlay" : "screen-overlay-2";
  if (!ov?.enabled) {
    recognizers.stop(role);
    if (n === 1) { setOv1Detection(""); setOv1Translation(""); }
    else        { setOv2Detection(""); setOv2Translation(""); }
    emitTo(channel, `${channel}:clear`);
    return;
  }
  // Clear stale state so language/mode switch shows fresh data
  if (n === 1) { setOv1Detection(""); setOv1Translation(""); }
  else        { setOv2Detection(""); setOv2Translation(""); }
  emitTo(channel, `${channel}:clear`);
  recognizers.restart(role, cfg.translator_settings.recognition_service, {
    source: ov.source_language,
    target: ov.target_language,
    sttOnly: false,
    setSRLoading: null,
    showNotification,
    setConfig,
    onResult: (result, isFinal) => {
      if (n === 1) setOv1Detection(result[0]); else setOv2Detection(result[0]);
      if (isFinal) {
        if (n === 1) setOv1Translation(result[1]); else setOv2Translation(result[1]);
        emitTo(channel, `${channel}:line`, { transcription: result[0], translation: result[1] });
      }
    },
  });
};
```

- [ ] **Step 5: Replace pause/resume handling**

Replace the `useEffect` that toggles on `srStatus` (around line 279) with:

```ts
React.useEffect(() => {
  info(`[SR] status=${srStatus}`);
  if (srStatus) recognizers.resumeAll();
  else recognizers.pauseAll();
}, [srStatus]);
```

- [ ] **Step 6: Replace the `triggerUpdate`/`textInputRef` manual_trigger calls**

Replace `sr?.manual_trigger(textInputValue)` with `recognizers.triggerChatbox(textInputValue)` in both call sites (text-input Send button + Enter key).

- [ ] **Step 7: Replace settings-visible-close restart effect**

Around line 352, replace:

```ts
React.useEffect(() => {
  if (settingsVisible == false && srStatus) {
    restartSR(); restartDesktopSR(); restartOverlay1SR(); restartOverlay2SR();
  }
}, [settingsVisible]);
```

with:

```ts
React.useEffect(() => {
  if (settingsVisible === false && srStatus) {
    restartChatbox();
    restartDesktop();
    restartOverlay(1);
    restartOverlay(2);
  }
}, [settingsVisible]);
```

- [ ] **Step 8: Replace overlay restart effects**

Replace lines 363-366 with:

```ts
React.useEffect(() => { restartOverlay(1); }, [config.screen_overlay?.enabled, config.screen_overlay?.source_language, config.screen_overlay?.target_language]);
React.useEffect(() => { restartOverlay(2); }, [config.screen_overlay_2?.enabled, config.screen_overlay_2?.source_language, config.screen_overlay_2?.target_language]);
```

(Note: enabling `enabled` and `source_language`/`target_language` triggers the same effect; `restartOverlay` handles the disabled case by stopping + clearing.)

- [ ] **Step 9: Wire up the disable-mic / disable-desktop listeners through helper**

Around line 322, replace:

```ts
listen<boolean>("disable-kikitan-desktop", (e) => { if (e.payload) desktopSR?.stop(); else desktopSR?.start(); });
```

with:

```ts
listen<boolean>("disable-kikitan-desktop", (e) => { if (e.payload) recognizers.stop("desktop"); else restartDesktop(); });
```

- [ ] **Step 10: Verify build + dev run**

Run: `npm run build`
Expected: succeeds.
Run: `npm run devtauri`
Expected: app launches; chatbox transcription works; overlays still work when enabled. **Behavior is unchanged from before this task.**

- [ ] **Step 11: Commit**

```bash
git add src/pages/Kikitan.tsx
git commit -m "refactor(rec): route Kikitan recognizers through helper"
```

---

## Task 6: Fix language-switch and mode-switch bugs

**Why:** The user must currently switch from translation to STT and back for a language change to apply. And mode switch reloads the entire window.

**Files:**
- Modify: `src/pages/Kikitan.tsx`
- Modify: `src/page.tsx`

- [ ] **Step 1: Replace the `languageUpdate` flag with a deterministic effect**

In `Kikitan.tsx`, remove the `languageUpdate` state and its effect (around lines 115 and 243-252). Replace with:

```ts
// Restart chatbox + desktop on any language / mode / service change.
// configRef.current is read inside restartChatbox/restartDesktop so we have fresh values.
React.useEffect(() => {
  if (!srStatus) return; // don't restart while paused
  restartChatbox();
  restartDesktop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  sourceLanguage,
  targetLanguage,
  config.mode,
  config.translator_settings.recognition_service,
  config.translator_settings.translation_service,
  config.translator_settings.desktop_translation,
]);
```

- [ ] **Step 2: Update language-change handlers**

In the source/target Selects and the swap IconButton handlers (around lines 443, 448, 451), remove `setLanguageUpdate(true)`. The handlers now just update local state + config; the effect from Step 1 handles the restart.

Example for the source Select:

```tsx
<Select size="small" value={sourceLanguage} sx={selSx} MenuProps={menuSx}
  onChange={(e) => {
    setSourceLanguage(e.target.value);
    setConfig({ ...config, source_language: e.target.value });
  }}>
```

(The `selSx`/`menuSx`/`miSx` blocks become legacy after Task 16 since theming is global; for now they harmlessly co-exist.)

- [ ] **Step 3: Remove window.location.reload from page.tsx mode change**

In `page.tsx`, find the mode `Select` `onChange` (around line 238):

```tsx
onChange={(e) => {
  setConfig({ ...config, mode: parseInt(e.target.value.toString()) })
  setTimeout(() => { setLoaded(false) }, 100)
  setTimeout(() => { window.location.reload() }, 300)
}}
```

Replace with:

```tsx
onChange={(e) => {
  setConfig({ ...config, mode: parseInt(e.target.value.toString()) });
}}
```

(Mode is moved to the status strip in Task 11; for now we keep the dropdown in the AppBar so existing users can find it. The reload is gone.)

- [ ] **Step 4: Verify language switch**

Run: `npm run devtauri`. Manual checklist:
- Speak a phrase, confirm transcription/translation. Stop talking.
- Change source language → speak. New language is recognized within ~1 second.
- Change target language → speak. Translation updates to new target.
- Swap source/target → speak. Both directions flipped.

- [ ] **Step 5: Verify mode switch**

While speaking:
- Toggle Mode from Translation to STT in the app bar. **No window reload.** Chatbox now sends source-only.
- Toggle back. Translation is sent again.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Kikitan.tsx src/page.tsx
git commit -m "fix(rec): language and mode changes apply without workaround"
```

---

## Task 7: Overlay clear event + stale-state fix

**Why:** Toggling an overlay off currently leaves ghost text in the main window's overlay card and in the overlay window itself. Task 5 already added the clear-event emit and local-state reset; this task adds the listener in the overlay window so its display empties.

**Files:**
- Modify: `src-overlay/Overlay.tsx`

- [ ] **Step 1: Add a `:clear` event listener**

In `src-overlay/Overlay.tsx`, after the `:line` listener useEffect (around line 125), add:

```tsx
useEffect(() => {
  if (!label) return;
  const unlisten = listen<void>(`${label}:clear`, () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setLines([]);
    setVisible(false);
  });
  return () => { unlisten.then((fn) => fn()); };
}, [label]);
```

- [ ] **Step 2: Verify overlay enable/disable**

Run: `npm run devtauri`. Manual checklist:
- Enable Overlay 1 → speak → live text appears in main-window card and in the overlay window.
- Disable Overlay 1 → both displays empty immediately. No ghost text on re-enable until you speak again.
- Repeat for Overlay 2.

- [ ] **Step 3: Commit**

```bash
git add src-overlay/Overlay.tsx
git commit -m "fix(overlay): clear display when disabled"
```

---

## Task 8: StatusStrip component

**Why:** Make recording state, languages, VRChat status, mic, mode, restart, and pause all visible at a glance — and move the mode toggle out of the app bar.

**Files:**
- Create: `src/components/StatusStrip.tsx`

- [ ] **Step 1: Implement the component**

Write `src/components/StatusStrip.tsx`:

```tsx
import * as React from "react";
import { Tooltip, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress } from "@mui/material";
import {
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  RestartAlt as RestartAltIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

type Props = {
  running: boolean;
  loading: boolean;
  paused: boolean;
  source: string;
  target: string;
  vrchatRunning: boolean;
  mic: string;
  mode: number; // 0 = translation, 1 = stt
  onModeChange: (mode: number) => void;
  onPauseToggle: () => void;
  onRestart: () => void;
  onMicClick: () => void; // opens settings -> audio
  modeLabels: { translation: string; stt: string };
};

export default function StatusStrip(props: Props) {
  const {
    running, loading, paused, source, target, vrchatRunning, mic, mode,
    onModeChange, onPauseToggle, onRestart, onMicClick, modeLabels,
  } = props;
  const livePillStyle: React.CSSProperties = paused
    ? { background: "var(--tk-surface-muted)", color: "var(--tk-text-muted)", border: "1px solid var(--tk-border)" }
    : { background: "color-mix(in srgb, var(--tk-live) 15%, transparent)", color: "var(--tk-live)", border: "1px solid var(--tk-live)" };
  const vrcPillStyle: React.CSSProperties = vrchatRunning
    ? { background: "color-mix(in srgb, var(--tk-accent) 15%, transparent)", color: "var(--tk-accent)", border: "1px solid var(--tk-accent)" }
    : { background: "var(--tk-surface-muted)", color: "var(--tk-text-muted)", border: "1px solid var(--tk-border)" };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)" }}>
      <span className="text-xs font-medium px-2 py-1 rounded-full" style={livePillStyle}>
        {paused ? "● Paused" : "● Live"} · {source.toUpperCase()} → {target.toUpperCase()}
      </span>
      <span className="text-xs font-medium px-2 py-1 rounded-full" style={vrcPillStyle}>
        VRChat {vrchatRunning ? "Connected" : "Not running"}
      </span>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_, v) => { if (v !== null) onModeChange(v); }}
        sx={{ ml: 1 }}
      >
        <ToggleButton value={0} sx={{ textTransform: "none", fontSize: 11, py: "2px", px: 1 }}>{modeLabels.translation}</ToggleButton>
        <ToggleButton value={1} sx={{ textTransform: "none", fontSize: 11, py: "2px", px: 1 }}>{modeLabels.stt}</ToggleButton>
      </ToggleButtonGroup>

      <Tooltip title={mic}>
        <button
          onClick={onMicClick}
          className="text-xs px-2 py-1 rounded-md border max-w-[140px] truncate"
          style={{ borderColor: "var(--tk-border)", color: "var(--tk-text-muted)", background: "transparent", cursor: "pointer" }}
        >
          🎙 {(mic.includes("(") && mic.includes(")")) ? mic.match(/\(([^)]+)\)/)?.[1] : mic}
        </button>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip title="Restart recognizer">
        <button
          onClick={onRestart}
          className="text-xs px-2 py-1 rounded-md border flex items-center gap-1"
          style={{ borderColor: "var(--tk-border)", color: "var(--tk-text)", background: "var(--tk-surface-muted)", cursor: "pointer" }}
        >
          <RestartAltIcon sx={{ fontSize: 14 }} /> Restart
        </button>
      </Tooltip>

      <IconButton size="small" onClick={onPauseToggle} disabled={loading} aria-label={running ? "Pause" : "Resume"}>
        {loading ? <CircularProgress size={14} /> : (running ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />)}
      </IconButton>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusStrip.tsx
git commit -m "feat(ui): add StatusStrip component"
```

---

## Task 9: Extract VRChatChatboxCard component

**Why:** Slim down `Kikitan.tsx`; reuse the card in tests and future layout tweaks.

**Files:**
- Create: `src/components/VRChatChatboxCard.tsx`
- Modify: `src/pages/Kikitan.tsx`

- [ ] **Step 1: Create the component**

The component renders the existing `VRChat Chatbox` card (Kikitan.tsx lines ~432-491). Props:

```ts
type Props = {
  config: Config;
  setConfig: (c: Config) => void;
  lang: Lang;
  sourceLanguage: string;
  setSourceLanguage: (s: string) => void;
  targetLanguage: string;
  setTargetLanguage: (s: string) => void;
  detection: string;
  translated: string;
  detecting: boolean;
  srStatus: boolean;
  onOpenTextInput: () => void;
  textInputDisabled: boolean;
  onShowHistory: () => void;
};
```

Move the JSX from the `{/* ── VRChat Chatbox ── */}` block into this component verbatim. Replace the Pause/Stop/Restart buttons section with: drop the Pause/Stop button (now in StatusStrip), drop the Restart button (now in StatusStrip), keep only the Text input button and History button.

Replace inline `selSx`/`menuSx`/`miSx` with empty objects (theming is now global). Where the original code used `${config.light_mode ? "outline-white" : "outline-slate-700"}` etc., use `style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)" }}`.

- [ ] **Step 2: Wire it into Kikitan.tsx**

Replace the chatbox block in `Kikitan.tsx` with:

```tsx
<VRChatChatboxCard
  config={config}
  setConfig={setConfig}
  lang={lang}
  sourceLanguage={sourceLanguage}
  setSourceLanguage={setSourceLanguage}
  targetLanguage={targetLanguage}
  setTargetLanguage={setTargetLanguage}
  detection={detection}
  translated={translated}
  detecting={detecting}
  srStatus={srStatus}
  onOpenTextInput={() => setTextInputVisible(true)}
  textInputDisabled={!srStatus}
  onShowHistory={() => setShowMessageHistory(true)}
/>
```

- [ ] **Step 3: Verify**

Run: `npm run devtauri`. Manual checklist: chatbox card renders identically; language pickers, swap, transcription/translation, type-message all work.

- [ ] **Step 4: Commit**

```bash
git add src/components/VRChatChatboxCard.tsx src/pages/Kikitan.tsx
git commit -m "refactor(ui): extract VRChatChatboxCard"
```

---

## Task 10: Extract OverlayCard component

**Why:** Same as Task 9; the two overlay cards are identical except their config key.

**Files:**
- Create: `src/components/OverlayCard.tsx`
- Modify: `src/pages/Kikitan.tsx`

- [ ] **Step 1: Create the component**

Props:

```ts
type Props = {
  label: string;
  config: Config;
  setConfig: (c: Config) => void;
  lang: Lang;
  ovKey: "screen_overlay" | "screen_overlay_2";
  detection: string;
  translation: string;
};
```

The body is the per-overlay JSX from `Kikitan.tsx` lines ~503-543, with `{...config[key]}` reads replaced by `config[ovKey]`. Replace inline `selSx`/etc. with global theming (CSS vars / Tailwind tokens).

- [ ] **Step 2: Wire into Kikitan.tsx**

```tsx
<div>
  <div className="flex items-center gap-2 mb-2 px-1">
    <MonitorIcon sx={{ fontSize: 14 }} className="opacity-50" />
    <span className="text-xs font-semibold tracking-widest uppercase text-fg-muted">Screen Overlays</span>
  </div>
  <div className="flex gap-3">
    <OverlayCard label="Overlay 1" config={config} setConfig={setConfig} lang={lang}
                 ovKey="screen_overlay" detection={ov1Detection} translation={ov1Translation} />
    <OverlayCard label="Overlay 2" config={config} setConfig={setConfig} lang={lang}
                 ovKey="screen_overlay_2" detection={ov2Detection} translation={ov2Translation} />
  </div>
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run devtauri`. Both overlay cards render correctly, language switches/swap/corner picker all work.

- [ ] **Step 4: Commit**

```bash
git add src/components/OverlayCard.tsx src/pages/Kikitan.tsx
git commit -m "refactor(ui): extract OverlayCard"
```

---

## Task 11: Compose new Kikitan layout with StatusStrip

**Why:** Wire the StatusStrip into the main screen, move the Mode toggle out of the app bar, remove the bottom mic dropdown, drop the icon-only restart from the chatbox card.

**Files:**
- Modify: `src/pages/Kikitan.tsx`
- Modify: `src/page.tsx`

- [ ] **Step 1: Add StatusStrip at top of Kikitan body**

Inside the `<div id="main">` in Kikitan.tsx, insert the StatusStrip as the first child:

```tsx
<StatusStrip
  running={srStatus}
  loading={srLoading}
  paused={!srStatus}
  source={sourceLanguage}
  target={targetLanguage}
  vrchatRunning={vrchatRunning}
  mic={config.microphone}
  mode={config.mode}
  onModeChange={(m) => setConfig({ ...config, mode: m })}
  onPauseToggle={() => {
    invoke("send_disable_mic", { data: !srStatus, address: config.vrchat_settings.osc_address, port: `${config.vrchat_settings.osc_port}` });
    setSRStatus(!srStatus);
  }}
  onRestart={() => { restartChatbox(); restartOverlay(1); restartOverlay(2); restartDesktop(); }}
  onMicClick={() => { /* opened via parent prop */ }}
  modeLabels={{ translation: localization.translation[lang], stt: localization.stt_only[lang] }}
/>
```

- [ ] **Step 2: Plumb `onMicClick` to open Settings → Audio tab**

Add a new prop to the existing `KikitanProps` (`openSettings: (tab?: string) => void`). In `page.tsx`, pass `openSettings={(tab) => { setSettingsVisible(true); setSettingsInitialTab(tab ?? "audio"); }}` (declare `settingsInitialTab` state). Pass `settingsInitialTab` into the Settings page (it'll be wired in Task 13).

In Kikitan, `onMicClick={() => openSettings("audio")}`.

- [ ] **Step 3: Remove the Mode select from the app bar in page.tsx**

Delete the Select around line 233-247 (the Translation/STT dropdown). The Mode toggle now lives in the StatusStrip.

- [ ] **Step 4: Remove the mic dropdown row from Kikitan**

Delete the `{/* ── Mic + Social ── */}` block's mic Select (lines ~549-559) but **keep the social buttons row**. The mic now lives in StatusStrip + Settings → Audio. Move the social row into a `SocialFooter` extraction (Task 12) — for now leave it inline.

- [ ] **Step 5: Remove duplicate Pause/Stop/Restart from chatbox card**

In `VRChatChatboxCard.tsx` (Task 9), remove the Pause/Stop button and the icon-only Restart button. Keep the Text input button and the History button.

- [ ] **Step 6: Verify**

Run: `npm run devtauri`. Manual checklist:
- Status strip shows live/paused state, languages, VRChat status, mode toggle, mic name, restart, pause.
- Clicking Pause stops recognition; clicking Resume starts again.
- Clicking Restart restarts all running recognizers.
- Clicking the mic name opens Settings; the Audio tab is selected (or whichever default until Task 13).
- Mode toggle in status strip switches translation ↔ STT without reload.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Kikitan.tsx src/page.tsx
git commit -m "feat(ui): wire StatusStrip into main layout"
```

---

## Task 12: Extract SocialFooter component

**Why:** Last loose extraction. Keeps Kikitan.tsx tight.

**Files:**
- Create: `src/components/SocialFooter.tsx`
- Modify: `src/pages/Kikitan.tsx`

- [ ] **Step 1: Implement**

Write `src/components/SocialFooter.tsx`:

```tsx
import { Button } from "@mui/material";
import { X as XIcon, GitHub as GitHubIcon, Favorite as FavoriteIcon } from "@mui/icons-material";
import { open } from "@tauri-apps/plugin-shell";

export default function SocialFooter() {
  return (
    <div className="flex justify-end gap-2 pb-2">
      <Button variant="contained" size="small" onClick={() => open("https://twitter.com/marquina_osu")}><XIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}><FavoriteIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}><GitHubIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://discord.gg/jpkYCgpBGV")}><img src="/discordlogo.webp" className="invert" width={18} alt="Discord" /></Button>
    </div>
  );
}
```

- [ ] **Step 2: Replace inline social row in Kikitan with `<SocialFooter />`**

- [ ] **Step 3: Verify + commit**

```bash
npm run build
git add src/components/SocialFooter.tsx src/pages/Kikitan.tsx
git commit -m "refactor(ui): extract SocialFooter"
```

---

## Task 13: SettingsShell + initial tab + initialTab prop

**Why:** Lay the groundwork for splitting Settings. The shell handles tabs; per-tab files will populate in Tasks 14-19.

**Files:**
- Create: `src/pages/settings/SettingsShell.tsx`
- Create: `src/pages/settings/types.ts`
- Modify: `src/pages/Settings.tsx` (becomes a thin re-export)

- [ ] **Step 1: Create shared types**

Write `src/pages/settings/types.ts`:

```ts
import { Config } from "../../util/config";
import { Lang } from "../../util/constants";

export type TabId = "audio" | "translation" | "vrchat" | "overlays" | "history" | "advanced" | "about";

export type TabProps = {
  config: Config;
  setConfig: (config: Config) => void;
  lang: Lang;
};
```

- [ ] **Step 2: Create the shell**

Write `src/pages/settings/SettingsShell.tsx`:

```tsx
import * as React from "react";
import { Tabs, Tab, Box } from "@mui/material";
import { TabId, TabProps } from "./types";
import SettingsAudio from "./SettingsAudio";
import SettingsTranslation from "./SettingsTranslation";
import SettingsVRChat from "./SettingsVRChat";
import SettingsOverlays from "./SettingsOverlays";
import SettingsHistory from "./SettingsHistory";
import SettingsAdvanced from "./SettingsAdvanced";
import SettingsAbout from "./SettingsAbout";

const TAB_ORDER: TabId[] = ["audio", "translation", "vrchat", "overlays", "history", "advanced", "about"];
const TAB_LABEL: Record<TabId, string> = {
  audio: "Audio",
  translation: "Translation",
  vrchat: "VRChat",
  overlays: "Overlays",
  history: "History",
  advanced: "Advanced",
  about: "About",
};

type Props = TabProps & {
  initialTab?: TabId;
  closeCallback: () => void;
};

export default function SettingsShell({ initialTab = "audio", closeCallback, ...tabProps }: Props) {
  const [active, setActive] = React.useState<TabId>(initialTab);
  React.useEffect(() => { setActive(initialTab); }, [initialTab]);

  return (
    <Box className="flex flex-col h-full">
      <Box sx={{ borderBottom: 1, borderColor: "divider" }} className="px-2">
        <Tabs value={TAB_ORDER.indexOf(active)} onChange={(_, v) => setActive(TAB_ORDER[v])} variant="scrollable" scrollButtons="auto">
          {TAB_ORDER.map((id) => <Tab key={id} label={TAB_LABEL[id]} />)}
        </Tabs>
      </Box>
      <Box className="flex-1 overflow-auto p-4">
        {active === "audio" && <SettingsAudio {...tabProps} />}
        {active === "translation" && <SettingsTranslation {...tabProps} />}
        {active === "vrchat" && <SettingsVRChat {...tabProps} />}
        {active === "overlays" && <SettingsOverlays {...tabProps} />}
        {active === "history" && <SettingsHistory {...tabProps} />}
        {active === "advanced" && <SettingsAdvanced {...tabProps} />}
        {active === "about" && <SettingsAbout {...tabProps} closeCallback={closeCallback} />}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Replace the existing `pages/Settings.tsx`**

Overwrite `src/pages/Settings.tsx` with:

```tsx
import SettingsShell from "./settings/SettingsShell";
export default SettingsShell;
```

The shell will fail to build until Tasks 14-19 supply each tab. Stub each tab file in this task with a placeholder (next step) so the build still passes after this commit.

- [ ] **Step 4: Stub all tab files**

For each of `SettingsAudio.tsx`, `SettingsTranslation.tsx`, `SettingsVRChat.tsx`, `SettingsOverlays.tsx`, `SettingsHistory.tsx`, `SettingsAdvanced.tsx`, `SettingsAbout.tsx`, create a stub at `src/pages/settings/<name>.tsx`:

```tsx
import { TabProps } from "./types";
export default function SettingsAudio(_: TabProps) { return <div>Audio (TODO Task 14)</div>; }
```

(Replace the name in each file. `SettingsAbout` takes `TabProps & { closeCallback: () => void }`.)

- [ ] **Step 5: Update SettingsPage prop usage in page.tsx**

Wire `initialTab` and `closeCallback`:

```tsx
<Modal open={settingsVisible} onClose={() => setSettingsVisible(false)} size="lg" title="Settings">
  <SettingsShell config={config} setConfig={setConfig} lang={lang}
                 initialTab={settingsInitialTab} closeCallback={() => setSettingsVisible(false)} />
</Modal>
```

(`SettingsShell` is the default export of `pages/Settings.tsx` now, so the existing import works.)

- [ ] **Step 6: Verify build**

Run: `npm run build`. Expected: succeeds. Settings now shows tab strip + placeholders.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Settings.tsx src/pages/settings/
git commit -m "refactor(settings): introduce SettingsShell with tab stubs"
```

---

## Task 14: SettingsAudio tab

**Why:** New tab. Mic selector lives here now.

**Files:**
- Modify: `src/pages/settings/SettingsAudio.tsx`

- [ ] **Step 1: Implement**

Replace the stub with:

```tsx
import * as React from "react";
import { Select, MenuItem, Typography, FormGroup } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { TabProps } from "./types";
import { localization } from "../../util/localization";

export default function SettingsAudio({ config, setConfig, lang }: TabProps) {
  const [mics, setMics] = React.useState<{ name: string; sample_rate: number }[]>([]);

  React.useEffect(() => {
    invoke<{ name: string; sample_rate: number }[]>("get_microphone_list").then(setMics);
  }, []);

  return (
    <FormGroup className="flex flex-col gap-4">
      <div>
        <Typography variant="body2" className="mb-1">Microphone</Typography>
        <Select fullWidth size="small" value={config.microphone}
          onChange={(e) => setConfig({ ...config, microphone: e.target.value as string })}>
          {mics.map((m) => <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>)}
        </Select>
      </div>
      <div>
        <Typography variant="body2" className="mb-1">{localization.recognition_service[lang]}</Typography>
        <Select fullWidth size="small" value={config.translator_settings.recognition_service}
          onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, recognition_service: parseInt(e.target.value.toString()) } })}>
          <MenuItem value={0}>Microsoft Bing ({localization.default[lang]})</MenuItem>
          <MenuItem value={1}>Groq Whisper-Large-V3 ({localization.requires_free_api_key[lang]})</MenuItem>
          <MenuItem value={2}>WebSpeech ({localization.legacy_not_recommended[lang]})</MenuItem>
        </Select>
      </div>
    </FormGroup>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build && npm run devtauri
# Open Settings → Audio. Confirm mic dropdown lists devices, recognition selector works.
git add src/pages/settings/SettingsAudio.tsx
git commit -m "feat(settings): Audio tab"
```

---

## Task 15: SettingsTranslation tab

**Files:**
- Modify: `src/pages/settings/SettingsTranslation.tsx`

- [ ] **Step 1: Implement**

Move the translation-service Select, the Groq API key TextField + "Get API Key" Button, and the Groq token-usage progress bar from the original `Settings.tsx` lines ~257-394 into this file. Use MUI components without inline `sx` color overrides — global theme handles them.

```tsx
import { TabProps } from "./types";
import { Select, MenuItem, TextField, Button, FormGroup, FormControlLabel, Checkbox, LinearProgress, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import { localization } from "../../util/localization";
import { DAILY_TOKEN_LIMIT } from "../../util/constants";

export default function SettingsTranslation({ config, setConfig, lang }: TabProps) {
  const groqRequired = config.translator_settings.translation_service === 2 || config.translator_settings.recognition_service === 1;
  return (
    <FormGroup className="flex flex-col gap-4">
      <div>
        <Typography variant="body2" className="mb-1">{localization.translation_service[lang]}</Typography>
        <Select fullWidth size="small" value={config.translator_settings.translation_service}
          onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, translation_service: parseInt(e.target.value.toString()) } })}>
          <MenuItem value={0}>Google Translate ({localization.default[lang]})</MenuItem>
          <MenuItem value={1}>Microsoft Bing</MenuItem>
          <MenuItem value={2}>Groq Llama3.3-70b ({localization.recommended[lang]})</MenuItem>
        </Select>
      </div>

      <FormControlLabel control={<Checkbox checked={config.vrchat_settings.translation_first}
        onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, translation_first: e.target.checked } })} />}
        label={localization.translation_first[lang]} />

      <FormControlLabel control={<Checkbox checked={config.vrchat_settings.only_translation}
        onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, only_translation: e.target.checked } })} />}
        label={localization.only_send_translation[lang]} />

      <div>
        <Typography variant="body2" className="mb-1">Groq {localization.api_key[lang]}</Typography>
        <div className="flex gap-2">
          <TextField fullWidth size="small" type="password"
            disabled={!groqRequired}
            value={config.groq.api_key}
            color={config.groq.api_key.length === 0 ? "warning" : "primary"}
            onChange={(e) => setConfig({ ...config, groq: { ...config.groq, api_key: e.target.value.trim() } })} />
          <Button variant="contained" disabled={!groqRequired} onClick={() => open("https://console.groq.com/keys")}>
            {localization.get_api_key[lang]}
          </Button>
        </div>
      </div>

      <div>
        <Typography variant="body2">{localization.groq_token_usage[lang]}: {config.groq.used_tokens}/{DAILY_TOKEN_LIMIT}</Typography>
        <LinearProgress variant="determinate" className="mt-1" value={(config.groq.used_tokens / DAILY_TOKEN_LIMIT) * 100} />
      </div>
    </FormGroup>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/pages/settings/SettingsTranslation.tsx
git commit -m "feat(settings): Translation tab"
```

---

## Task 16: SettingsVRChat tab

**Files:**
- Modify: `src/pages/settings/SettingsVRChat.tsx`

- [ ] **Step 1: Implement**

Move the VRChat-specific form fields from the original Settings tab 0 (lines ~111-187) — `enable_chatbox`, `send_typing_status_while_talking`, `disable_kikitan_when_muted`, `chatbox_update_speed`, plus OSC address/port (currently in tab 3) — into this file.

```tsx
import { TabProps } from "./types";
import { Select, MenuItem, TextField, IconButton, FormGroup, FormControlLabel, Checkbox, Typography } from "@mui/material";
import { History } from "@mui/icons-material";
import { localization } from "../../util/localization";
import { speed_presets, DEFAULT_CONFIG } from "../../util/config";

export default function SettingsVRChat({ config, setConfig, lang }: TabProps) {
  const v = config.vrchat_settings;
  const set = (patch: Partial<typeof v>) => setConfig({ ...config, vrchat_settings: { ...v, ...patch } });
  const resetOsc = () => set({ osc_address: DEFAULT_CONFIG.vrchat_settings.osc_address, osc_port: DEFAULT_CONFIG.vrchat_settings.osc_port });
  const oscModified = v.osc_address !== DEFAULT_CONFIG.vrchat_settings.osc_address || v.osc_port !== DEFAULT_CONFIG.vrchat_settings.osc_port;

  return (
    <FormGroup className="flex flex-col gap-3">
      <FormControlLabel control={<Checkbox checked={v.enable_chatbox} onChange={(e) => set({ enable_chatbox: e.target.checked })} />} label="Send to VRChat chatbox" />
      <FormControlLabel control={<Checkbox checked={v.send_typing_status_while_talking} onChange={(e) => set({ send_typing_status_while_talking: e.target.checked })} />} label={localization.send_typing_while_talking[lang]} />
      <FormControlLabel control={<Checkbox checked={v.disable_kikitan_when_muted} onChange={(e) => set({ disable_kikitan_when_muted: e.target.checked })} />} label={localization.disable_kikitan_when_muted[lang]} />

      <div>
        <Typography variant="body2" className="mb-1">{localization.chatbox_update_speed[lang]}</Typography>
        <Select size="small" value={v.chatbox_update_speed} onChange={(e) => set({ chatbox_update_speed: parseInt(e.target.value.toString()) })}>
          <MenuItem value={speed_presets.slow}>{localization.slow[lang]}</MenuItem>
          <MenuItem value={speed_presets.medium}>{localization.medium[lang]}</MenuItem>
          <MenuItem value={speed_presets.fast}>{localization.fast[lang]}</MenuItem>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <TextField label={localization.osc_address[lang]} size="small" value={v.osc_address} onChange={(e) => set({ osc_address: e.target.value })} />
        <TextField label={localization.osc_port[lang]} size="small" type="number" value={v.osc_port} onChange={(e) => set({ osc_port: parseInt(e.target.value) })} />
        {oscModified && <IconButton onClick={resetOsc}><History /></IconButton>}
      </div>
    </FormGroup>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/pages/settings/SettingsVRChat.tsx
git commit -m "feat(settings): VRChat tab"
```

---

## Task 17: SettingsOverlays tab

**Files:**
- Modify: `src/pages/settings/SettingsOverlays.tsx`

- [ ] **Step 1: Implement**

This tab combines the Screen Overlay + Overlay 2 advanced options (font sizes, fade timeout, max lines, colors, vrc_only). Since both overlays have identical option shapes (`ScreenOverlayConfig`), build a reusable inner block:

```tsx
import { TabProps } from "./types";
import { Slider, TextField, Switch, FormControlLabel, Typography, Divider } from "@mui/material";
import { Config, ScreenOverlayConfig } from "../../util/config";

function OverlayOptions({ ov, set }: { ov: ScreenOverlayConfig; set: (patch: Partial<ScreenOverlayConfig>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <FormControlLabel control={<Switch checked={ov.vrc_only} onChange={(e) => set({ vrc_only: e.target.checked })} />} label="Show only when VRChat is running" />
      <div>
        <Typography variant="body2">Transcription font size: {ov.transcription_font_size}px</Typography>
        <Slider min={12} max={48} step={1} value={ov.transcription_font_size} onChange={(_, v) => set({ transcription_font_size: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Translation font size: {ov.font_size}px</Typography>
        <Slider min={12} max={48} step={1} value={ov.font_size} onChange={(_, v) => set({ font_size: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Fade timeout: {ov.fade_timeout}s</Typography>
        <Slider min={2} max={20} step={1} value={ov.fade_timeout} onChange={(_, v) => set({ fade_timeout: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Max lines: {ov.max_lines}</Typography>
        <Slider min={1} max={8} step={1} value={ov.max_lines} onChange={(_, v) => set({ max_lines: v as number })} />
      </div>
      <div className="flex gap-3">
        <TextField label="Translation color" size="small" value={ov.text_color} onChange={(e) => set({ text_color: e.target.value })} placeholder="#ffffff" />
        <TextField label="Transcription color" size="small" value={ov.transcription_color} onChange={(e) => set({ transcription_color: e.target.value })} placeholder="#60a5fa" />
      </div>
    </div>
  );
}

export default function SettingsOverlays({ config, setConfig }: TabProps) {
  const set1 = (patch: Partial<ScreenOverlayConfig>) => setConfig({ ...config, screen_overlay: { ...config.screen_overlay, ...patch } });
  const set2 = (patch: Partial<ScreenOverlayConfig>) => setConfig({ ...config, screen_overlay_2: { ...config.screen_overlay_2, ...patch } });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Typography variant="subtitle1" className="mb-2 font-semibold">Overlay 1</Typography>
        <OverlayOptions ov={config.screen_overlay} set={set1} />
      </div>
      <Divider />
      <div>
        <Typography variant="subtitle1" className="mb-2 font-semibold">Overlay 2</Typography>
        <OverlayOptions ov={config.screen_overlay_2} set={set2} />
      </div>
    </div>
  );
}
```

(Per-overlay enable/source/target/corner stay on the **main screen** — they're more discoverable there. Settings only houses the secondary knobs.)

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/pages/settings/SettingsOverlays.tsx
git commit -m "feat(settings): Overlays tab"
```

---

## Task 18: SettingsHistory + SettingsAdvanced + SettingsAbout tabs

**Files:**
- Modify: `src/pages/settings/SettingsHistory.tsx`
- Modify: `src/pages/settings/SettingsAdvanced.tsx`
- Modify: `src/pages/settings/SettingsAbout.tsx`

- [ ] **Step 1: SettingsHistory**

Move the existing history controls (lines ~188-256 of original `Settings.tsx`) into the new file:

```tsx
import { TabProps } from "./types";
import { FormControlLabel, FormGroup, Checkbox, Slider, Typography, Button } from "@mui/material";
import { Delete } from "@mui/icons-material";
import { localization } from "../../util/localization";

export default function SettingsHistory({ config, setConfig, lang }: TabProps) {
  const m = config.message_history;
  const set = (patch: Partial<typeof m>) => setConfig({ ...config, message_history: { ...m, ...patch } });
  return (
    <FormGroup className="flex flex-col gap-4">
      <FormControlLabel control={<Checkbox checked={m.enabled} onChange={(e) => set({ enabled: e.target.checked })} />} label={localization.enable_history[lang]} />
      <div>
        <Typography variant="body2">{localization.max_history_items[lang]}: {m.max_items}</Typography>
        <Slider disabled={!m.enabled} value={m.max_items} min={10} max={200} step={10}
          onChange={(_, v) => set({ max_items: v as number })} valueLabelDisplay="auto" sx={{ width: 280 }} />
      </div>
      <Button variant="contained" color="error" startIcon={<Delete />}
        disabled={!m.enabled || m.items.length === 0}
        onClick={() => set({ items: [] })}>
        {localization.clear_history[lang]}
      </Button>
      <Typography variant="body2">{m.items.length} {localization.message_history[lang].toLowerCase()}</Typography>
    </FormGroup>
  );
}
```

- [ ] **Step 2: SettingsAdvanced**

Move the advanced toggles (data-out user/desktop, open logs, desktop_translation) from original lines ~396-470:

```tsx
import { TabProps } from "./types";
import { FormControlLabel, FormGroup, Checkbox, Button } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import { appLogDir } from "@tauri-apps/api/path";
import { localization } from "../../util/localization";

export default function SettingsAdvanced({ config, setConfig, lang }: TabProps) {
  return (
    <FormGroup className="flex flex-col gap-3">
      <FormControlLabel control={<Checkbox checked={config.translator_settings.desktop_translation}
        onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, desktop_translation: e.target.checked } })} />}
        label={localization.enable_desktop_capture[lang]} />
      <FormControlLabel control={<Checkbox checked={config.data_out.enable_user_data}
        onChange={(e) => setConfig({ ...config, data_out: { ...config.data_out, enable_user_data: e.target.checked } })} />}
        label={localization.enable_user_data[lang]} />
      <FormControlLabel control={<Checkbox checked={config.data_out.enable_desktop_data}
        onChange={(e) => setConfig({ ...config, data_out: { ...config.data_out, enable_desktop_data: e.target.checked } })} />}
        label={localization.enable_desktop_data[lang]} />
      <Button variant="outlined" onClick={async () => open(await appLogDir())}>{localization.open_logs[lang]}</Button>
    </FormGroup>
  );
}
```

- [ ] **Step 3: SettingsAbout**

```tsx
import { TabProps } from "./types";
import { Button, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import * as React from "react";
import { getVersion } from "@tauri-apps/api/app";

type Props = TabProps & { closeCallback: () => void };

export default function SettingsAbout(_: Props) {
  const [version, setVersion] = React.useState("");
  React.useEffect(() => { getVersion().then(setVersion); }, []);
  return (
    <div className="flex flex-col gap-3">
      <Typography variant="h6">Kikitan Translator</Typography>
      <Typography variant="body2">Version {version}</Typography>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outlined" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}>GitHub</Button>
        <Button variant="outlined" onClick={() => open("https://discord.gg/jpkYCgpBGV")}>Discord</Button>
        <Button variant="outlined" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}>Buy Me a Coffee</Button>
        <Button variant="outlined" onClick={() => open("https://booth.pm/en/items/6073050")}>Booth.pm</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
npm run build && npm run devtauri
# Open Settings; click each tab; confirm all controls work and the dark theme is consistent.
git add src/pages/settings/SettingsHistory.tsx src/pages/settings/SettingsAdvanced.tsx src/pages/settings/SettingsAbout.tsx
git commit -m "feat(settings): History, Advanced, About tabs"
```

---

## Task 19: Theme audit — Quickstart, Changelogs, residuals

**Why:** Quickstart and Changelogs were excluded from earlier modal migration. Audit them and any other surface still referencing hard-coded colors.

**Files:**
- Modify: `src/components/Quickstart.tsx`
- Modify: `src/pages/Changelogs.tsx`
- Modify: `src/page.tsx` (any residual color literals)
- Modify: `src/pages/Kikitan.tsx` (drop `selSx`/`menuSx`/`miSx` now that ThemeProvider is wired)

- [ ] **Step 1: Quickstart**

Read `Quickstart.tsx`. Replace every `bg-white` / `text-black` / `bg-slate-950` / `text-white` / `outline-white` with token-backed equivalents:
- `bg-surface-elevated` for card/panel surfaces
- `text-fg` for body
- `text-fg-muted` for secondary text
- `border-border` (or inline `style={{ borderColor: "var(--tk-border)" }}`)

Drop `config.light_mode ? ... : ...` ternaries that only switched colors — Tailwind tokens handle this via the CSS variable on `:root`.

- [ ] **Step 2: Changelogs**

Same audit pass on `Changelogs.tsx`.

- [ ] **Step 3: Residual sx blobs in Kikitan**

Delete the `selSx`, `menuSx`, `miSx`, `cardCls`, `lbl`, `box` constants (lines ~370-381) in `Kikitan.tsx` if all consumers have moved to extracted components. If any remain inline, replace them with global theme classes / CSS vars.

- [ ] **Step 4: Verify**

Run: `npm run devtauri`. Manual checklist item 10 from the spec:
- Toggle theme on the main screen.
- Open every modal in turn (Settings tabs Audio/Translation/VRChat/Overlays/History/Advanced/About, Quickstart via the Translate icon, Changelogs by clicking the version number, Donate by clearing localStorage `last_donation`, Google-error if reachable, Message-history, Text-input).
- Each surface uses the same dark or light palette consistently. No white-on-white. No unreadable text.

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "refactor(theme): audit residual color literals across surfaces"
```

---

## Task 20: Dev test-mode panel (optional but recommended)

**Why:** Manual verification without speaking. This was called out in spec §10.

**Files:**
- Modify: `src/util/recognizers.ts`
- Modify: `src/pages/settings/SettingsAdvanced.tsx`

- [ ] **Step 1: Add a `simulate(role, transcription, translation, isFinal)` export to `recognizers.ts`**

```ts
type Listener = (result: string[], isFinal: boolean) => void;
const listeners: Partial<Record<RecognizerRole, Listener>> = {};

// Inside `restart`, after `r.onResult(opts.onResult);` add:
listeners[role] = opts.onResult;

// Inside `stop`, before clearing instances[role]:
listeners[role] = undefined;

export function simulate(role: RecognizerRole, transcription: string, translation: string, isFinal = true): void {
  listeners[role]?.([transcription, translation], isFinal);
}
```

- [ ] **Step 2: Add a "Simulate" button under SettingsAdvanced**

```tsx
<Button variant="outlined" onClick={() => recognizers.simulate("chatbox", "Hello world", "こんにちは世界", true)}>
  Simulate chatbox phrase (dev)
</Button>
```

(Add similar buttons for `overlay1`, `overlay2`, `desktop` if useful.)

- [ ] **Step 3: Verify + commit**

```bash
npm run build && npm run devtauri
# Open Settings → Advanced → click Simulate. Confirm the chatbox card live boxes update.
git add src/util/recognizers.ts src/pages/settings/SettingsAdvanced.tsx
git commit -m "feat(dev): test-mode simulate buttons under Advanced"
```

---

## Task 21: Final manual verification + cleanup

**Why:** Run the full spec §10 checklist before declaring done.

**Files:** none (verification only).

- [ ] **Step 1: Run `npm run build` and `npm run lint` (if configured)**

Both must pass.

- [ ] **Step 2: Walk through spec §10 manual checklist items 1-13**

For each item:
1. Change source language while chatbox is live → applies within 1 s.
2. Change target language while chatbox is live → applies.
3. Swap source/target → applies.
4. Toggle Translation ↔ STT mid-speech → no reload, output adapts.
5. Enable Overlay 1 → live text appears in main + overlay window.
6. Disable Overlay 1 → both windows clear.
7. Repeat 5–6 for Overlay 2.
8. Stop chatbox recognizer → live boxes clear.
9. Restart button on status strip → restarts all running recognizers.
10. Theme toggle + every modal → no white-on-white, all themed.
11. First-run flow (clear localStorage `firstTimeSetupComplete`) → Quickstart works.
12. Switch microphone in Settings → Audio → mic restarts; status strip mic name updates.
13. VRChat connected pill turns green when VRChat is running, gray otherwise.

If any step fails, file as a bug and fix in a follow-up task before the final commit.

- [ ] **Step 3: Final commit**

If anything was tweaked during verification:

```bash
git commit -am "chore: polish-pass verification fixes"
```

Otherwise, skip.

---

## Self-review (post-write)

1. **Spec coverage:**
   - Theme/contrast (spec §4) → Tasks 1, 19 ✓
   - Main screen Layout A (spec §5) → Tasks 8, 9, 10, 11, 12 ✓
   - Settings tabs Layout B (spec §6) → Tasks 13, 14, 15, 16, 17, 18 ✓
   - Bug 7.1 language switch → Task 6 ✓
   - Bug 7.2 mode reload → Task 6 ✓
   - Bug 7.3 overlay enable/disable → Tasks 5, 7 ✓
   - Bug 7.4 restart button visibility → Task 8, 11 ✓
   - Bug 7.5 stale text → Tasks 5, 7 ✓
   - Modal shell (spec §8) → Tasks 2, 3 ✓
   - Recognizer helper (spec §9) → Task 4 ✓
   - Manual checklist (spec §10) → Task 21 ✓
   - Dev simulate (spec §10) → Task 20 ✓

2. **No placeholders:** every step has concrete code or an exact action. The "TODO Task N" stubs in Task 13 Step 4 are intentional — they exist for ≤1 commit before being filled by the next tasks.

3. **Type consistency:** `RecognizerRole`, `RecognizerOptions`, `TabId`, `TabProps`, `ScreenOverlayConfig`, `Config` used consistently. `restart` / `stop` / `pauseAll` / `resumeAll` / `simulate` / `triggerChatbox` are the only public exports of `recognizers.ts`. `restartChatbox` / `restartDesktop` / `restartOverlay(n)` are the only restart functions inside `Kikitan.tsx`.

4. **Risks acknowledged in plan:** Task 1 Step 3 calls out the Tailwind `border` namespace collision. Task 13 calls out the multi-step build-broken-then-fixed pattern (stubs).
