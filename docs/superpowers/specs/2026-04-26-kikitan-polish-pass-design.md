# Kikitan Translator — Polish Pass Design

**Date:** 2026-04-26
**Branch:** `main`
**Scope:** UI clarity + reliability bug fixes. No new features. No recognizer / translator / Tauri-side changes.

---

## 1. Goals

Move Kikitan from "good for personal use" to "production polish" by:

1. Fixing user-visible reliability bugs (most important: language switch requires a workaround).
2. Tightening the main-screen UI so status is obvious at a glance and controls are findable.
3. Making the Settings page non-overwhelming and theme-correct.
4. Making dark/light mode consistent across every surface — no white-on-white or unreadable text.

Out of scope: recognizer pipeline, translator services, OSC protocol, Rust/Tauri code, new features.

---

## 2. User-Confirmed Pain Points

**Bugs (confirmed by user):**

1. Language change in the chatbox requires switching to STT mode and back to take effect.
2. Mode switch (Translation ↔ STT) triggers a full window reload — jarring.
3. Toggling overlays on/off leaves stale state and ghost text in the main display.
4. Restart button exists in the code but is invisible/unfindable in the UI.
5. Stale transcription/translation text lingers after stopping or switching languages.

**UI clarity (confirmed by user):**

1. Overlays section is confusing — unclear what an "overlay" is at a glance, hard to tell which is enabled.
2. Modals stack weirdly and have inconsistent styling.
3. Dark/light mode is inconsistent — some sections (notably Settings) hard-code `bg-white`, producing white-on-white or unreadable text.
4. General lack of polish.

---

## 3. Design Direction

**User selections during brainstorming:**

- **Scope:** Bug fixes + visual polish (no full redesign).
- **Main screen layout:** Option A — polished current (stacked cards + new status strip).
- **Settings layout:** Option B — tabs across the top.

---

## 4. Theming & Contrast (cross-cutting)

### Problem

Components hard-code colors (`bg-white`, `text-black`, `outline-white`) regardless of `config.light_mode`. MUI components are themed inline at every call site (`selSx`, `menuSx`, `miSx`) with copy-pasted style objects, missing some surfaces.

### Fix

1. **Theme tokens module** (`src/style/tokens.ts`): a small object map of semantic tokens with light/dark values:
   - `surface`, `surface-elevated`, `border`, `border-strong`
   - `text`, `text-muted`, `text-disabled`
   - `accent`, `success`, `danger`, `warning`
   - `live-indicator` (used for "● Live")
2. **Single MUI `ThemeProvider`** at the app root, derived from the tokens, so MUI Selects, TextFields, Snackbars, Tooltips, Switches, Buttons inherit colors automatically.
3. **Tailwind theme extension** in `tailwind.config.ts` exposes the same tokens as utility classes (`bg-surface`, `text-muted`, etc.) so non-MUI markup uses the same palette.
4. **Audit + replace** every hard-coded `bg-white` / `text-black` / `outline-white` / `bg-slate-*` (used as a theme color) across:
   - `page.tsx` (modal panels: settings, donate, google-error, changelogs, updater)
   - `pages/Settings.tsx`
   - `pages/Kikitan.tsx`
   - `pages/Changelogs.tsx`
   - `components/Quickstart.tsx`
5. **Default to dark** for first-run users; keep the theme toggle.
6. **Optional contrast lint:** a small build-time script (`scripts/lint-theme.cjs`) that greps for color literals outside `tokens.ts` and warns. Not blocking; advisory only.

### Acceptance

Toggling the theme switch renders no white-on-white or low-contrast text in any modal, tab, card, or control.

---

## 5. Main Screen (Layout A polished)

### Structure (top → bottom)

1. **Slim app bar** — "Kikitan" + version on left, on right: theme toggle, quickstart-language toggle, settings icon. Mode selector is **moved out** of the app bar.
2. **Status strip** (new, sticky just below app bar):
   - Live state pill: `● Live · EN-US → JA` (gray + "Paused" when stopped).
   - VRChat status pill: green "Connected" / gray "Not running" (driven by existing `is_vrchat_running` poll).
   - **Mode segmented control**: Translation / STT — toggles in place, no reload.
   - **Mic name** (truncated with ellipsis); clicking it opens Settings → Audio.
   - **Restart** button (icon + label "Restart").
   - **Pause / Resume** button.
3. **VRChat Chatbox card** — keep current structure; remove duplicated restart-icon button (now in status strip); slightly larger live-text boxes.
4. **Screen Overlays row** — two cards side-by-side, each with: enable switch, source/target/swap, corner picker, live transcription + translation, font-size hint. **Disabled overlays collapse** to header + switch only.
5. **Footer row** — social buttons (X, BMC, GitHub, Discord), smaller and lower-weight.

### Component breakdown

- `components/StatusStrip.tsx` — new; pure presentational, props from Kikitan state.
- `components/VRChatChatboxCard.tsx` — extract from `Kikitan.tsx`.
- `components/OverlayCard.tsx` — extract; reused for Overlay 1 and Overlay 2.
- `components/SocialFooter.tsx` — extract.
- `pages/Kikitan.tsx` — shrinks to coordinating recognizers + queue, composing the cards.

### Removed UI elements

- Mode dropdown in app bar (moved to status strip as segmented control).
- Mic dropdown at the bottom of the main screen (moved to Settings → Audio; mic name still visible read-only in status strip).
- Icon-only "restart" button (replaced by the labeled one in the status strip).

### Behavior changes

- Mode switch never reloads the window. State change reconfigures the recognizer in place.
- All restart paths flow through one helper (`recognizers.ts`, see §7).

---

## 6. Settings Page (Tabs, Option B)

### Structure

A themed centered card modal (same shell as today, no `bg-white` hard-codes) with tabs across the top:

1. **Audio** — microphone selector, recognition service, per-service options (VAD threshold, sample rate, etc.), test-mic button.
2. **Translation** — translation service selector, per-service settings, API keys (Groq, Gemini), "show only translation", "translation first".
3. **VRChat** — enable chatbox, OSC address/port, chatbox update speed, send-typing-while-talking, disable-when-muted.
4. **Overlays** — per-overlay knobs (font sizes, fonts, corners) for both Overlay 1 and Overlay 2. Other layout/language controls live on the main screen.
5. **History** — message history toggle, max items, clear history.
6. **Advanced** — desktop translation, omnibar/notification settings, debug toggles, anything that doesn't fit elsewhere.
7. **About** — version, links, donate, license.

### File split

`pages/Settings.tsx` (currently 698 lines) splits into:

- `pages/settings/SettingsShell.tsx` — tab strip + dispatch
- `pages/settings/SettingsAudio.tsx`
- `pages/settings/SettingsTranslation.tsx`
- `pages/settings/SettingsVRChat.tsx`
- `pages/settings/SettingsOverlays.tsx`
- `pages/settings/SettingsHistory.tsx`
- `pages/settings/SettingsAdvanced.tsx`
- `pages/settings/SettingsAbout.tsx`

Each tab file targets ~80–150 lines.

---

## 7. Bug Fixes

### 7.1 Language switch doesn't take effect

**Suspected cause:** The current restart effect uses `setLanguageUpdate(true)` + 500 ms timeout + `if (sr) restartSR()` gate; combined with the recognizer's internal stop/start sequence, the new language pair is not always applied. The full-reload mode-switch workaround works because the recognizer is reconstructed from scratch on a fresh page.

**Fix:**
- Introduce a `recognizers.ts` helper exposing `getOrCreate(role, lang, opts)`, `restart(role, lang, opts)`, `stop(role)`, `clear(role)` for the four recognizer roles (`chatbox`, `desktop`, `overlay1`, `overlay2`).
- Inside `restart`, call `stop()`, await any pending teardown, then construct a new instance with the explicit `lang` argument (no closure dependence on component state).
- Replace the `languageUpdate` flag + timeout with a single deterministic `useEffect` that watches `[sourceLanguage, targetLanguage, mode, recognition_service]` and calls `restart('chatbox', …)`. Same pattern for overlays watching their own language fields.
- Ensure `restart` clears the recognizer's onResult callback before tearing down so the old instance can't fire late.

### 7.2 Mode switch reloads the window

**Cause:** `page.tsx` literally calls `window.location.reload()` after mode change.

**Fix:** Remove the reload. Mode change updates `config.mode` via `setConfig`. The chatbox-restart effect re-reads `mode` via the same path as language change. Translation-vs-STT branching in the queue handler reads `cfg.mode` from `configRef.current`.

### 7.3 Overlay enable/disable leaves stale state

**Cause:** Toggling `enabled` runs the existing `useEffect` that calls `restartOverlay1SR()`, but on disable it doesn't clear `ov1Detection` / `ov1Translation`, and doesn't tell the overlay window to clear its display.

**Fix:** On `enabled → false` for either overlay:
1. `recognizers.stop(roleN)`.
2. Clear local state: `setOvNDetection("")`, `setOvNTranslation("")`.
3. Emit `screen-overlay-N:clear` to the overlay window; the overlay window listens and empties its display.

### 7.4 Restart button invisible

Promoted to the status strip with icon + "Restart" text label (see §5). Tooltip retained.

### 7.5 Stale text after stop / language switch

**Fix:** Whenever any recognizer is stopped or restarted (chatbox, desktop, overlay 1, overlay 2), clear:
- `setDetection("")`, `setTranslated("")`, `setResult([])` for chatbox.
- `setDesktopResult("")` for desktop.
- `setOvNDetection("")`, `setOvNTranslation("")` for overlays, and emit clear to their windows.

Centralized in the `recognizers.ts` `restart`/`stop` helpers so callers don't have to remember.

---

## 8. Modals

All modals share one shell component: `components/Modal.tsx` — props for `open`, `title`, `onClose`, `children`. Provides:

- Themed backdrop blur layer
- Themed card surface (uses `surface-elevated` token)
- Themed border, themed close button
- Consistent sizing classes (`size="sm" | "md" | "lg"`)

Apply to: Settings, Quickstart (existing wrapper kept; only inner styles updated), Changelogs, Donate, Google-error, Updater-progress, Message-history, Text-input.

---

## 9. Architecture Notes

This is a polish pass. The user explicitly opted out of architectural rework. We accept:

- Module-level `let sr/sr1/sr2/desktopSR` globals remain.
- React state + `configRef` pattern remains.
- `Kikitan.tsx` keeps its useEffect-driven coordination (just split into smaller, named effects).

The only new abstraction is `recognizers.ts`, justified by §7 — needed to fix the language-switch bug cleanly without copy-pasting the switch-on-service-id block four times. It does not change recognizer behavior; it's a thin wrapper.

---

## 10. Testing

### Manual checklist (run before considering done)

1. Change source language while chatbox is live → new language takes effect within one second, no mode-toggle workaround needed.
2. Change target language while chatbox is live → ditto.
3. Swap source/target → ditto.
4. Toggle Translation ↔ STT mid-speech → no window reload, output adapts (chatbox sends source-only in STT mode).
5. Enable Overlay 1 → recognizer starts, live text appears in main window and overlay window.
6. Disable Overlay 1 → live text clears in both windows; recognizer stops.
7. Repeat 5–6 for Overlay 2.
8. Stop chatbox recognizer → transcription/translation boxes clear (no stale text).
9. Restart button on the status strip → all running recognizers restart.
10. Theme toggle in main screen, then open every modal in turn (Settings, Quickstart, Changelogs, Donate, Google-error, Message-history, Text-input) — verify every surface respects the theme; no white-on-white.
11. First-run flow (clear localStorage) — Quickstart still works and is themed.
12. Switch microphone in Settings → Audio → mic restarts cleanly; mic name updates in status strip.
13. VRChat connected pill turns green when VRChat is running; gray otherwise.

### Build-time

- `npm run build` clean (TypeScript + Vite).
- ESLint clean.
- Optional: `node scripts/lint-theme.cjs` reports 0 hard-coded color literals outside `tokens.ts`.

### Dev-only

A "test mode" toggle (under Advanced) injects fake recognition events on a timer so you can verify all UI paths without a microphone or VRChat running.

---

## 11. File Inventory

**New:**
- `src/style/tokens.ts`
- `src/style/theme.ts` (MUI theme derived from tokens)
- `src/components/Modal.tsx`
- `src/components/StatusStrip.tsx`
- `src/components/VRChatChatboxCard.tsx`
- `src/components/OverlayCard.tsx`
- `src/components/SocialFooter.tsx`
- `src/util/recognizers.ts`
- `src/pages/settings/SettingsShell.tsx`
- `src/pages/settings/SettingsAudio.tsx`
- `src/pages/settings/SettingsTranslation.tsx`
- `src/pages/settings/SettingsVRChat.tsx`
- `src/pages/settings/SettingsOverlays.tsx`
- `src/pages/settings/SettingsHistory.tsx`
- `src/pages/settings/SettingsAdvanced.tsx`
- `src/pages/settings/SettingsAbout.tsx`
- `scripts/lint-theme.cjs` (optional)

**Modified:**
- `src/page.tsx` (remove window reload, wrap in ThemeProvider, swap modal markup for Modal component)
- `src/pages/Kikitan.tsx` (decompose into status strip + extracted cards, route restart logic through `recognizers.ts`)
- `src/pages/Settings.tsx` → becomes a thin re-export of `SettingsShell`
- `src/pages/Changelogs.tsx` (theme tokens)
- `src/components/Quickstart.tsx` (theme tokens)
- `tailwind.config.ts` (theme extension)
- `src/globals.css` (only if needed for new token CSS variables)

**Untouched (out of scope):**
- `src/recognizers/*`
- `src/translators/*`
- `src/util/data_out.ts`, `src/util/overlay.ts`, `src/util/config.ts` (unless theme tokens require additions)
- `src-tauri/*`
- `src-overlay/*` (overlay window code) — receives one new event listener for `:clear`

---

## 12. Risks

- **Theme audit churn**: a lot of small edits across many files; visual regressions possible. Mitigation: manual checklist item 10 covers every modal.
- **Recognizer restart timing**: changing the restart sequence could expose latent races in EdgeSTT/VAD/WebSpeech. Mitigation: `recognizers.ts` keeps the existing service-specific construction logic; only the *gating* and *language passing* changes.
- **Settings split**: moving controls between tabs may cause "I can't find X" regressions for the user. Mitigation: tab labels are explicit; keep an in-app search box deferred (out of scope) but every existing setting is preserved.

---

## 13. Definition of Done

- All five bugs in §7 fixed and verified against the manual checklist.
- Theme is consistent across every modal and surface.
- Main screen renders the new status strip and Layout A as described.
- Settings is tabbed and split into per-tab files of ≤150 lines each.
- `Kikitan.tsx` is smaller than its current 576 lines after extraction.
- Build and ESLint clean.
- No regressions in existing features (chatbox sends, OSC protocol, overlay rendering, message history, donate flow, updater).
