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

type Listener = (result: string[], isFinal: boolean) => void;
const listeners: Partial<Record<RecognizerRole, Listener>> = {};

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
  listeners[role] = undefined;
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
  listeners[role] = opts.onResult;
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

export function simulate(role: RecognizerRole, transcription: string, translation: string, isFinal = true): void {
  listeners[role]?.([transcription, translation], isFinal);
}
