import { useState, useEffect, useRef } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { primaryMonitor } from "@tauri-apps/api/window";

type OverlayLine = {
    id: number;
    transcription: string;
    translation: string;
};

type OverlayConfig = {
    font_size: number;
    fade_timeout: number;
    max_lines: number;
    text_color: string;
    transcription_color: string;
    corner: "bottom-right" | "bottom-left" | "top-right" | "top-left";
};

const DEFAULT_CONFIG: OverlayConfig = {
    font_size: 18,
    fade_timeout: 5,
    max_lines: 3,
    text_color: "#ffffff",
    transcription_color: "#60a5fa",
    corner: "bottom-right",
};

// Width/height of the overlay window itself (must match tauri.conf.json)
const OVERLAY_W = 600;
const OVERLAY_H = 300;
const MARGIN = 24;

async function positionWindow(corner: OverlayConfig["corner"]) {
    const monitor = await primaryMonitor();
    if (!monitor) return;

    const sw = monitor.size.width;
    const sh = monitor.size.height;
    const sf = monitor.scaleFactor;

    const lw = OVERLAY_W * sf;
    const lh = OVERLAY_H * sf;

    let x = 0, y = 0;
    const marginPx = MARGIN * sf;

    switch (corner) {
        case "bottom-right": x = sw - lw - marginPx; y = sh - lh - marginPx; break;
        case "bottom-left": x = marginPx; y = sh - lh - marginPx; break;
        case "top-right": x = sw - lw - marginPx; y = marginPx; break;
        case "top-left": x = marginPx; y = marginPx; break;
    }

    const appWindow = getCurrentWindow();
    await appWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
    await appWindow.setIgnoreCursorEvents(true);
}

export default function Overlay() {
    const [lines, setLines] = useState<OverlayLine[]>([]);
    const [visible, setVisible] = useState(true);
    const [config, setConfig] = useState<OverlayConfig>(DEFAULT_CONFIG);
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idRef = useRef(0);

    // On mount: request config from main window
    useEffect(() => {
        emitTo("main", "screen-overlay:config-request");
    }, []);

    // Receive full config snapshot
    useEffect(() => {
        const unlisten = listen<OverlayConfig>("screen-overlay:config", (event) => {
            setConfig(event.payload);
            positionWindow(event.payload.corner);
        });
        return () => { unlisten.then((fn) => fn()); };
    }, []);

    // Receive a new transcription+translation line
    useEffect(() => {
        const unlisten = listen<{ transcription: string; translation: string }>(
            "screen-overlay:line",
            (event) => {
                const { transcription, translation } = event.payload;
                if (!transcription && !translation) return;

                setLines((prev) => {
                    const next = [...prev, { id: idRef.current++, transcription, translation }];
                    return next.slice(-config.max_lines);
                });

                setVisible(true);
                if (fadeTimer.current) clearTimeout(fadeTimer.current);
                fadeTimer.current = setTimeout(() => setVisible(false), config.fade_timeout * 1000);
            }
        );
        return () => { unlisten.then((fn) => fn()); };
    }, [config.max_lines, config.fade_timeout]);

    const bgAlpha = 0.65;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "12px 16px",
                borderRadius: "10px",
                background: `rgba(15, 15, 30, ${bgAlpha})`,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                transition: "opacity 1s ease",
                opacity: visible ? 1 : 0,
                userSelect: "none",
                WebkitUserSelect: "none",
                pointerEvents: "none",
            }}
        >
            {lines.map((line, idx) => {
                const opacityStep = lines.length > 1 ? 0.55 / (lines.length - 1) : 0;
                const opacity = lines.length === 1 ? 1 : 0.45 + opacityStep * idx;
                return (
                    <div key={line.id} style={{ marginBottom: idx < lines.length - 1 ? "8px" : 0, opacity }}>
                        {line.transcription && (
                            <div style={{
                                fontSize: `${config.font_size * 0.82}px`,
                                color: config.transcription_color,
                                lineHeight: 1.35,
                            }}>
                                {line.transcription}
                            </div>
                        )}
                        {line.translation && (
                            <div style={{
                                fontSize: `${config.font_size}px`,
                                color: config.text_color,
                                lineHeight: 1.35,
                                marginTop: "2px",
                            }}>
                                {line.translation}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
