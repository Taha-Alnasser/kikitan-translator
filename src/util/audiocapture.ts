import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Reference-counted mic multiplexor.
// Multiple recognizers (sr, sr1, sr2) share ONE Rust audio capture stream.
// Stopping one recognizer no longer kills the capture for the others —
// the Rust capture only stops when the last consumer releases it.
let micRefCount = 0;
let micUnlisten: (() => void) | null = null;
let micCurrentMic = "";
const micCallbacks = new Set<(chunk: Float32Array, sampleRate: number) => void>();

export async function setupMicrophoneCapture(
  callback: (chunk: Float32Array, sampleRate: number) => void,
  mic: string
): Promise<() => Promise<void>> {
  micCallbacks.add(callback);

  if (micRefCount === 0) {
    // First consumer — register the shared Tauri listener and start capture
    const unlisten = await listen("mic-audio-chunk", (event) => {
      const { chunk, sampleRate } = event.payload as { chunk: string; sampleRate: number };
      const raw = atob(chunk);
      const buf = new ArrayBuffer(raw.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
      const float32 = new Float32Array(buf);
      // Fan out to every active recognizer callback
      micCallbacks.forEach(cb => { try { cb(float32, sampleRate); } catch { /* ignore */ } });
    });
    await invoke("start_microphone_audio_capture", { mic });
    micUnlisten = unlisten;
    micCurrentMic = mic;
  } else if (mic !== micCurrentMic) {
    // Mic device changed — restart the Rust capture (listener stays the same)
    try { await invoke("stop_microphone_audio_capture"); } catch { /* ignore */ }
    await invoke("start_microphone_audio_capture", { mic });
    micCurrentMic = mic;
  }

  micRefCount++;

  // Returned cleanup: removes this callback and stops capture only when last consumer exits
  return async () => {
    micCallbacks.delete(callback);
    micRefCount = Math.max(0, micRefCount - 1);
    if (micRefCount === 0) {
      try { await invoke("stop_microphone_audio_capture"); } catch { /* ignore */ }
      micUnlisten?.();
      micUnlisten = null;
      micCurrentMic = "";
    }
  };
}

export async function setupSystemAudioCapture(
  callback: (chunk: Float32Array, sampleRate: number) => void
) {
  const unlisten = await listen("audio-chunk", (event) => {
    const { chunk, sampleRate } = event.payload as { chunk: string; sampleRate: number };
    const raw = atob(chunk);
    const buf = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    const float32 = new Float32Array(buf);
    callback(float32, sampleRate);
  });

  await invoke("start_desktop_audio_capture");

  return async () => {
    await invoke("stop_desktop_audio_capture");
    unlisten();
  };
}
