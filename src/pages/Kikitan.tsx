import * as React from "react";

import {
    Select,
    MenuItem,
    Button,
    TextField,
    IconButton,
    Switch,
    Tooltip,
    CircularProgress,
    Snackbar,
    Alert,
    Slide
} from "@mui/material";

import { error, info, warn } from "@tauri-apps/plugin-log";

import {
    X as XIcon,
    GitHub as GitHubIcon,
    Favorite as FavoriteIcon,
    KeyboardVoice as KeyboardVoiceIcon,
    PlayArrow as PlayArrowIcon,
    Pause as PauseIcon,
    Keyboard,
    History as HistoryIcon,
    Mic as MicIcon,
    Translate as TranslateIcon,
    SwapHoriz as SwapHorizIcon,
    SportsEsports as SportsEsportsIcon,
    Monitor as MonitorIcon,
    RestartAlt as RestartAltIcon,
} from "@mui/icons-material";

import { invoke } from "@tauri-apps/api/core";
import { listen, emitTo } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";

import {
    calculateMinWaitTime,
    Lang,
    langSource,
    langTo,
} from "../util/constants";

import { Config, load_config, MessageHistoryItem } from "../util/config";
import Modal from "../components/Modal";
import { Recognizer } from "../recognizers/recognizer";
import { EdgeSTT } from "../recognizers/EdgeSTT";

import { localization } from "../util/localization";
import {
    send_desktop_recognition,
    send_desktop_translation,
    send_user_recognition,
    send_user_translation
} from "../util/data_out";
import { send_notification_text } from "../util/overlay";
import { VAD } from "../recognizers/VAD";
import { WebSpeech } from "../recognizers/WebSpeech";

type KikitanProps = {
    config: Config;
    setConfig: (config: Config) => void;
    lang: Lang;
    settingsVisible: boolean;
    vrchatRunning: boolean;
};

// Three independent recognizers sharing one ref-counted audio capture stream.
// audiocapture.ts ensures stopping one does not kill the others.
let sr: Recognizer | null = null;
let sr1: Recognizer | null = null;
let sr2: Recognizer | null = null;
let desktopSR: Recognizer | null = null;
let detectionQueue: string[][] = [];
let lock = false;
let restartTimeout: NodeJS.Timeout | null = null;

// Dedup — EdgeSTT sometimes fires speech.phrase twice for the same utterance
let lastQueuedText = "";
let lastQueuedTime = 0;

export default function Kikitan({
    config,
    setConfig,
    lang,
    settingsVisible,
}: KikitanProps) {
    const [detecting, setDetecting] = React.useState(false);
    const [srStatus, setSRStatus] = React.useState(true);
    const [srLoading, setSRLoading] = React.useState(false);
    const [vrcMuted, setVRCMuted] = React.useState(false);
    const [startedSpeaking, setStartedSpeaking] = React.useState(false);

    const [result, setResult] = React.useState<string[]>([]);
    const [detection, setDetection] = React.useState<string>("");
    const [translated, setTranslated] = React.useState("");
    const [desktopResult, setDesktopResult] = React.useState("");

    const [ov1Detection, setOv1Detection] = React.useState("");
    const [ov1Translation, setOv1Translation] = React.useState("");
    const [ov2Detection, setOv2Detection] = React.useState("");
    const [ov2Translation, setOv2Translation] = React.useState("");

    const [microphones, setMicrophones] = React.useState<{ name: string, sample_rate: number }[]>([]);

    const [triggerUpdate, setTriggerUpdate] = React.useState(false);
    const configRef = React.useRef(config);
    configRef.current = config;

    const [sourceLanguage, setSourceLanguage] = React.useState(config.source_language);
    const [targetLanguage, setTargetLanguage] = React.useState(config.target_language);
    const [languageUpdate, setLanguageUpdate] = React.useState(false);

    const [showMessageHistory, setShowMessageHistory] = React.useState(false);
    const [textInputVisible, setTextInputVisible] = React.useState(false);
    const [textInputValue, setTextInputValue] = React.useState("");
    const textInputRef = React.useRef<HTMLInputElement>(null);

    const [notification, setNotification] = React.useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "warning" | "info";
    }>({ open: false, message: "", severity: "info" });

    const showNotification = (msg: string, sev: "success" | "error" | "warning" | "info" = "info") => {
        setNotification({ open: true, message: msg, severity: sev });
    };

    const enableDesktopCapture = () => {
        desktopSR?.stop();
        switch (config.translator_settings.recognition_service) {
            case 0:
                desktopSR = new EdgeSTT(targetLanguage, sourceLanguage, true, false, null, showNotification, setConfig);
                break;
            case 1:
                desktopSR = new VAD(targetLanguage, sourceLanguage, true, false, null, showNotification, setConfig);
                break;
            case 2:
                showNotification(localization.cannot_use_webspeech_for_desktop_translation[lang], "warning");
                return;
            default:
                return;
        }
        desktopSR.onResult(async (result: string[], isFinal: boolean) => {
            if (config.data_out.enable_desktop_data) {
                send_desktop_recognition(result[0], isFinal);
                if (isFinal) send_desktop_translation(result[1]);
            }
            if (isFinal) setDesktopResult(result[1]);
        });
        desktopSR.start();
    };

    const restartSR = () => {
        sr?.stop();
        info(`[SR] Restarting: ${sourceLanguage} → ${targetLanguage}`);
        if ((config.translator_settings.translation_service == 2 || config.translator_settings.recognition_service == 1) && config.groq.api_key.length == 0) {
            showNotification(localization.no_api_key_configured_for_groq[lang], "warning");
        }
        switch (config.translator_settings.recognition_service) {
            case 0: sr = new EdgeSTT(sourceLanguage, targetLanguage, false, config.mode == 1, setSRLoading, showNotification, setConfig); break;
            case 1: sr = new VAD(sourceLanguage, targetLanguage, false, config.mode == 1, setSRLoading, showNotification, setConfig); break;
            case 2: sr = new WebSpeech(sourceLanguage, targetLanguage, config.mode == 1, setSRLoading, showNotification, setConfig); break;
            default: error(`[SR] Unknown recognizer: ${config.translator_settings.recognition_service}`); return;
        }
        sr.onResult((result: string[], isFinal: boolean) => {
            setDetecting(!isFinal);
            setResult(result);
        });
        sr?.start();
    };

    const restartDesktopSR = () => {
        const cfg = load_config();
        if (cfg.translator_settings.desktop_translation) enableDesktopCapture();
        else { desktopSR?.stop(); desktopSR = null; }
    };

    // Overlay 1 — independent recognizer with its own language pair.
    // Uses configRef.current (always fresh) instead of load_config() to
    // avoid the localStorage race where the React state update hasn't been
    // persisted to storage yet when this fires.
    const restartOverlay1SR = () => {
        sr1?.stop();
        sr1 = null;
        const cfg = configRef.current;
        if (!cfg.screen_overlay?.enabled) return;
        const ov = cfg.screen_overlay;
        info(`[SR1] Starting: ${ov.source_language} → ${ov.target_language}`);
        switch (cfg.translator_settings.recognition_service) {
            case 0: sr1 = new EdgeSTT(ov.source_language, ov.target_language, false, false, null, showNotification, setConfig); break;
            case 1: sr1 = new VAD(ov.source_language, ov.target_language, false, false, null, showNotification, setConfig); break;
            case 2: sr1 = new WebSpeech(ov.source_language, ov.target_language, false, null, showNotification, setConfig); break;
            default: return;
        }
        sr1.onResult((result: string[], isFinal: boolean) => {
            setOv1Detection(result[0]);
            if (isFinal && configRef.current.screen_overlay?.enabled) {
                setOv1Translation(result[1]);
                emitTo("screen-overlay", "screen-overlay:line", {
                    transcription: result[0],
                    translation: result[1],
                });
            }
        });
        sr1.start();
    };

    // Overlay 2 — independent recognizer, same pattern as overlay 1
    const restartOverlay2SR = () => {
        sr2?.stop();
        sr2 = null;
        const cfg = configRef.current;
        if (!cfg.screen_overlay_2?.enabled) return;
        const ov = cfg.screen_overlay_2;
        info(`[SR2] Starting: ${ov.source_language} → ${ov.target_language}`);
        switch (cfg.translator_settings.recognition_service) {
            case 0: sr2 = new EdgeSTT(ov.source_language, ov.target_language, false, false, null, showNotification, setConfig); break;
            case 1: sr2 = new VAD(ov.source_language, ov.target_language, false, false, null, showNotification, setConfig); break;
            case 2: sr2 = new WebSpeech(ov.source_language, ov.target_language, false, null, showNotification, setConfig); break;
            default: return;
        }
        sr2.onResult((result: string[], isFinal: boolean) => {
            setOv2Detection(result[0]);
            if (isFinal && configRef.current.screen_overlay_2?.enabled) {
                setOv2Translation(result[1]);
                emitTo("screen-overlay-2", "screen-overlay-2:line", {
                    transcription: result[0],
                    translation: result[1],
                });
            }
        });
        sr2.start();
    };

    React.useEffect(() => {
        send_notification_text(desktopResult, (config.source_language == "ja" || config.source_language == "ko" || config.source_language == "zh"));
    }, [desktopResult]);

    React.useEffect(() => {
        if (!languageUpdate) return;
        if (sr) {
            sr?.stop();
            desktopSR?.stop();
            if (restartTimeout) clearTimeout(restartTimeout);
            restartTimeout = setTimeout(() => { restartSR(); restartDesktopSR(); }, 500);
        }
        setLanguageUpdate(false);
    }, [languageUpdate]);

    React.useEffect(() => {
        if (vrcMuted && !startedSpeaking && config.vrchat_settings.disable_kikitan_when_muted) return;
        setDetection(result[0]);
        setStartedSpeaking(detecting);
        if ((config.mode == 1 || config.vrchat_settings.send_typing_status_while_talking) && config.vrchat_settings.enable_chatbox) {
            invoke("send_typing", { address: config.vrchat_settings.osc_address, port: `${config.vrchat_settings.osc_port}` });
        }
        if (config.data_out.enable_user_data) {
            send_user_recognition(result[0], !detecting);
            if (!detecting && config.mode == 0) send_user_translation(result[1]);
        }
        if (config.mode == 1 && config.vrchat_settings.enable_chatbox && !detecting) {
            invoke("send_message", { address: config.vrchat_settings.osc_address, port: `${config.vrchat_settings.osc_port}`, msg: result[0] });
        }
        if (config.mode === 0 && !detecting && result.length != 0 && result[1].length != 0) {
            const now = Date.now();
            if (result[0] !== lastQueuedText || now - lastQueuedTime > 5000) {
                lastQueuedText = result[0];
                lastQueuedTime = now;
                detectionQueue = [...detectionQueue, result];
                info(`[QUEUE] Enqueued, length=${detectionQueue.length}`);
            }
        }
    }, [result, detecting]);

    React.useEffect(() => {
        info(`[SR] status=${srStatus}`);
        if (sr == null) { warn("[SR] SR is null, ignoring"); return; }
        if (srStatus) { sr.start(); desktopSR?.start(); sr1?.start(); sr2?.start(); }
        else          { sr.stop();  desktopSR?.stop();  sr1?.stop();  sr2?.stop();  }
    }, [srStatus]);

    React.useEffect(() => {
        (async () => {
            if (detectionQueue.length == 0 || lock) return;
            const current = detectionQueue[0];
            detectionQueue = detectionQueue.slice(1);
            lock = true;
            const cfg = configRef.current;
            const current_detection = current[0];
            const current_translation = current[1];

            // VRChat chatbox only — overlays feed themselves via their own recognizers
            if (cfg.vrchat_settings.enable_chatbox && current_translation.length > 0) {
                invoke("send_message", {
                    address: cfg.vrchat_settings.osc_address,
                    port: `${cfg.vrchat_settings.osc_port}`,
                    msg: cfg.vrchat_settings.only_translation
                        ? current_translation
                        : cfg.vrchat_settings.translation_first
                            ? `${current_translation} (${current_detection})`
                            : `${current_detection} (${current_translation})`,
                });
            }

            if (cfg.mode == 0) setTranslated(current_translation);

            if (cfg.message_history.enabled) {
                const item: MessageHistoryItem = { source: current_detection, translation: current_translation, timestamp: Date.now() };
                setConfig({ ...cfg, message_history: { ...cfg.message_history, items: [item, ...cfg.message_history.items].slice(0, cfg.message_history.max_items) } });
            }

            await new Promise((r) => setTimeout(r, calculateMinWaitTime(current_translation, cfg.vrchat_settings.chatbox_update_speed)));
            lock = false;
        })();
        setTimeout(() => setTriggerUpdate(!triggerUpdate), 100);
    }, [triggerUpdate]);

    React.useEffect(() => {
        listen<boolean>("vrchat-mute", (e) => setVRCMuted(e.payload));
        listen<boolean>("disable-kikitan-mic", (e) => setSRStatus(!e.payload));
        listen<boolean>("disable-kikitan-desktop", (e) => { if (e.payload) desktopSR?.stop(); else desktopSR?.start(); });
        listen<boolean>("disable-kikitan-chatbox", (e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, enable_chatbox: !e.payload } }));

        if (sr == null) {
            invoke("get_microphone_list").then((data) => {
                const d = data as { name: string, sample_rate: number }[];
                if (d.filter(v => v.name == load_config().microphone).length == 0) {
                    showNotification(localization.microphone_updated[lang], "warning");
                    setConfig({ ...config, microphone: d[0].name });
                    restartSR();
                }
                setMicrophones(d);
            });
            setInterval(() => {
                invoke("get_microphone_list").then((data) => {
                    const d = data as { name: string, sample_rate: number }[];
                    if (d.filter(v => v.name == load_config().microphone).length == 0) {
                        showNotification(localization.microphone_updated[lang], "warning");
                        setConfig({ ...config, microphone: d[0].name });
                        restartSR();
                    }
                    setMicrophones(d);
                });
            }, 1000);
        }
    }, []);

    React.useEffect(() => {
        if (settingsVisible == false && srStatus) {
            restartSR();
            restartDesktopSR();
            restartOverlay1SR();
            restartOverlay2SR();
        }
    }, [settingsVisible]);

    // Restart overlay recognizers when their settings change.
    // configRef.current is always up-to-date so these pick up the new language instantly.
    React.useEffect(() => { restartOverlay1SR(); }, [config.screen_overlay?.enabled]);
    React.useEffect(() => { if (sr1) restartOverlay1SR(); }, [config.screen_overlay?.source_language, config.screen_overlay?.target_language]);
    React.useEffect(() => { restartOverlay2SR(); }, [config.screen_overlay_2?.enabled]);
    React.useEffect(() => { if (sr2) restartOverlay2SR(); }, [config.screen_overlay_2?.source_language, config.screen_overlay_2?.target_language]);

    const formatTimestamp = (ts: number) => new Date(ts).toLocaleTimeString();

    const selSx = {
        color: config.light_mode ? "black" : "white",
        "& .MuiOutlinedInput-notchedOutline": { borderColor: config.light_mode ? "#cbd5e1" : "#475569" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: config.light_mode ? "#94a3b8" : "#64748b" },
        "& .MuiSvgIcon-root": { color: config.light_mode ? "black" : "#94A3B8" },
    };
    const menuSx = { sx: { "& .MuiPaper-root": { backgroundColor: config.light_mode ? "white" : "#020617" } } };
    const miSx = { color: config.light_mode ? "black" : "white" };
    const cardCls = `rounded-2xl border p-4 ${config.light_mode ? "border-slate-200 bg-white shadow-sm" : "border-slate-700 bg-slate-900"}`;
    const lbl = `text-xs font-medium ${config.light_mode ? "text-slate-500" : "text-slate-400"}`;
    const box = (dim: boolean) =>
        `rounded-lg border px-3 py-2 h-12 text-sm font-medium overflow-hidden transition-all ${dim ? "italic opacity-60" : ""} ${config.light_mode ? "border-slate-200 text-slate-800" : "border-slate-700 text-slate-200"}`;

    return (
        <>
            {/* Message History Modal */}
            <Modal open={showMessageHistory} onClose={() => setShowMessageHistory(false)} size="md" title={localization.message_history[lang]} z={20}>
                <div className="p-4 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                    {config.message_history.items.length === 0 ? (
                        <div className="flex items-center justify-center h-20">
                            <span className="text-sm italic" style={{ color: "var(--tk-text-muted)" }}>{localization.no_history[lang]}</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {config.message_history.items.map((item, i) => (
                                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--tk-surface-muted)" }}>
                                    <div className="text-xs mb-1" style={{ color: "var(--tk-text-muted)" }}>{formatTimestamp(item.timestamp)}</div>
                                    <div className="font-medium text-sm">{item.source}</div>
                                    <div className="mt-1 text-sm" style={{ color: "var(--tk-text-muted)" }}>{item.translation}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Text Input Modal */}
            <Modal open={textInputVisible} onClose={() => { setTextInputVisible(false); setTextInputValue(""); }} size="sm" title={localization.type_here[lang]} z={20}>
                <div className="flex flex-row justify-center gap-2 px-4 py-4">
                    <TextField
                        inputRef={textInputRef} placeholder={localization.type_here[lang]} className="mt-2 w-48"
                        value={textInputValue} variant="outlined"
                        onKeyDown={(e) => { if (e.key == "Enter") { sr?.manual_trigger(textInputValue); setTextInputVisible(false); setTextInputValue(""); } }}
                        onChange={(e) => setTextInputValue(e.target.value)}
                    />
                    <Button variant="contained" onClick={() => { sr?.manual_trigger(textInputValue); setTextInputVisible(false); setTextInputValue(""); }}>{localization.send[lang]}</Button>
                    <Button variant="contained" color="error" onClick={() => { setTextInputVisible(false); setTextInputValue(""); }}>{localization.close_menu[lang]}</Button>
                </div>
            </Modal>

            {/* Main layout */}
            <div id="main" className="relative z-10 flex flex-col gap-3 w-full" style={{ maxWidth: 860 }}>

                {/* ── VRChat Chatbox ── */}
                <div className={cardCls}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <SportsEsportsIcon fontSize="small" className="opacity-60" />
                            <span className="font-bold text-sm">VRChat Chatbox</span>
                        </div>
                        <Switch size="small" checked={config.vrchat_settings.enable_chatbox}
                            onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, enable_chatbox: e.target.checked } })} />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                        <Select size="small" value={sourceLanguage} sx={selSx} MenuProps={menuSx}
                            onChange={(e) => { setSourceLanguage(e.target.value); setLanguageUpdate(true); setConfig({ ...config, source_language: e.target.value }); }}>
                            {langSource.map((el) => <MenuItem key={el.code} value={el.code} sx={miSx}>{el.name[lang]}</MenuItem>)}
                        </Select>
                        <IconButton size="small" disabled={languageUpdate}
                            onClick={() => { const t = sourceLanguage; const s = targetLanguage; setTargetLanguage(t); setSourceLanguage(s); setLanguageUpdate(true); setConfig({ ...config, source_language: s, target_language: t }); }}>
                            <SwapHorizIcon fontSize="small" />
                        </IconButton>
                        <Select size="small" value={targetLanguage} sx={selSx} MenuProps={menuSx}
                            onChange={(e) => { setTargetLanguage(e.target.value); setLanguageUpdate(true); setConfig({ ...config, target_language: e.target.value }); }}>
                            {langTo.map((el) => <MenuItem key={el.code} value={el.code} sx={miSx}>{el.name[lang]}</MenuItem>)}
                        </Select>
                    </div>
                    <div className="flex gap-3 mb-3">
                        <div className="flex-1 flex flex-col gap-1">
                            <span className={`${lbl} flex items-center gap-1`}><MicIcon sx={{ fontSize: 11 }} /> Transcription</span>
                            <div className={box(detecting)}>{detection}</div>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <span className={`${lbl} flex items-center gap-1`}><TranslateIcon sx={{ fontSize: 11 }} /> Translation</span>
                            <div className={box(false)}>{translated}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outlined" size="small" disabled={!srStatus}
                            onClick={() => { if (!textInputVisible) { textInputRef.current?.focus(); textInputRef.current?.select(); } setTextInputVisible(!textInputVisible); }}>
                            {localization.text[lang]} <Keyboard className="ml-1" sx={{ fontSize: 16 }} />
                        </Button>
                        <Button variant="outlined" size="small"
                            color={srStatus ? !srLoading ? "error" : "inherit" : "success"} disabled={srLoading}
                            sx={{ '&.Mui-disabled': { borderColor: config.light_mode ? 'rgba(0,0,0,0.4)' : 'rgba(148,163,184,0.5)', color: config.light_mode ? 'rgba(0,0,0,0.4)' : 'rgba(148,163,184,0.5)' } }}
                            onClick={() => { invoke("send_disable_mic", { data: !srStatus, address: config.vrchat_settings.osc_address, port: `${config.vrchat_settings.osc_port}` }); setSRStatus(!srStatus); }}>
                            {!srStatus ? localization.start[lang] : !srLoading ? localization.stop[lang] : ""}
                            {srStatus ? !srLoading ? <PauseIcon sx={{ fontSize: 16 }} /> : <CircularProgress color="inherit" size={14} /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                        </Button>
                        <Tooltip title="Restart recognizer — use after changing language">
                            <Button variant="outlined" size="small" onClick={() => { restartSR(); restartOverlay1SR(); restartOverlay2SR(); }}>
                                <RestartAltIcon sx={{ fontSize: 16 }} />
                            </Button>
                        </Tooltip>
                        {config.message_history.enabled && (
                            <Tooltip title={localization.message_history[lang]}>
                                <Button variant="outlined" size="small" onClick={() => setShowMessageHistory(true)}>
                                    <HistoryIcon sx={{ fontSize: 16 }} />
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* ── Screen Overlays ── */}
                <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <MonitorIcon sx={{ fontSize: 14 }} className="opacity-50" />
                        <span className={`text-xs font-semibold tracking-widest uppercase ${config.light_mode ? "text-slate-500" : "text-slate-400"}`}>Screen Overlays</span>
                    </div>
                    <div className="flex gap-3">
                        {([
                            { label: "Overlay 1", key: "screen_overlay" as const, det: ov1Detection, trans: ov1Translation },
                            { label: "Overlay 2", key: "screen_overlay_2" as const, det: ov2Detection, trans: ov2Translation },
                        ]).map(({ label, key, det, trans }) => {
                            const ov = config[key];
                            return (
                                <div key={key} className={`flex-1 rounded-2xl border p-4 transition-opacity ${ov.enabled ? "" : "opacity-50"} ${config.light_mode ? "border-slate-200 bg-white shadow-sm" : "border-slate-700 bg-slate-900"}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-semibold text-sm">{label}</span>
                                        <Switch size="small" checked={ov.enabled} onChange={(e) => setConfig({ ...config, [key]: { ...ov, enabled: e.target.checked } })} />
                                    </div>
                                    <div className="flex items-center gap-1 mb-3">
                                        <Select size="small" value={ov.source_language} sx={selSx} MenuProps={menuSx}
                                            onChange={(e) => setConfig({ ...config, [key]: { ...ov, source_language: e.target.value } })}>
                                            {langSource.map((l) => <MenuItem key={l.code} value={l.code} sx={miSx}>{l.name[lang]}</MenuItem>)}
                                        </Select>
                                        <IconButton size="small" onClick={() => setConfig({ ...config, [key]: { ...ov, source_language: ov.target_language, target_language: ov.source_language } })}>
                                            <SwapHorizIcon fontSize="small" />
                                        </IconButton>
                                        <Select size="small" value={ov.target_language} sx={selSx} MenuProps={menuSx}
                                            onChange={(e) => setConfig({ ...config, [key]: { ...ov, target_language: e.target.value } })}>
                                            {langTo.map((l) => <MenuItem key={l.code} value={l.code} sx={miSx}>{l.name[lang]}</MenuItem>)}
                                        </Select>
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className={`${lbl} flex items-center gap-1`}><MicIcon sx={{ fontSize: 11 }} /> Transcription</span>
                                            <div className={box(false)}>{det}</div>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className={`${lbl} flex items-center gap-1`}><TranslateIcon sx={{ fontSize: 11 }} /> Translation</span>
                                            <div className={box(false)}>{trans}</div>
                                        </div>
                                    </div>
                                    <Select size="small" fullWidth value={ov.corner} sx={selSx} MenuProps={menuSx}
                                        onChange={(e) => setConfig({ ...config, [key]: { ...ov, corner: e.target.value as typeof ov.corner } })}>
                                        <MenuItem value="top-left" sx={miSx}>↖ Top Left</MenuItem>
                                        <MenuItem value="top-right" sx={miSx}>↗ Top Right</MenuItem>
                                        <MenuItem value="bottom-left" sx={miSx}>↙ Bottom Left</MenuItem>
                                        <MenuItem value="bottom-right" sx={miSx}>↘ Bottom Right</MenuItem>
                                    </Select>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Mic + Social ── */}
                <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                        <KeyboardVoiceIcon fontSize="small" className="opacity-50" />
                        <Select size="small" value={config.microphone} className="w-52" sx={selSx} MenuProps={menuSx}
                            onChange={(e) => { setConfig({ ...config, microphone: e.target.value as string }); setTimeout(() => restartSR(), 250); }}>
                            {microphones.map((el) => (
                                <MenuItem key={el.name} value={el.name} sx={miSx}>
                                    {(el.name.includes("(") && el.name.includes(")")) ? el.name.match(/\(([^)]+)\)/)?.[1] : el.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="contained" size="small" onClick={() => open("https://twitter.com/marquina_osu")}><XIcon fontSize="small" /></Button>
                        <Button variant="contained" size="small" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}><FavoriteIcon fontSize="small" /></Button>
                        <Button variant="contained" size="small" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}><GitHubIcon fontSize="small" /></Button>
                        <Button variant="contained" size="small" onClick={() => open("https://discord.gg/jpkYCgpBGV")}><img src="/discordlogo.webp" className="invert" width={18} /></Button>
                    </div>
                </div>
            </div>

            <Snackbar open={notification.open} autoHideDuration={5000} onClose={() => setNotification(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} TransitionComponent={Slide}>
                <Alert onClose={() => setNotification(prev => ({ ...prev, open: false }))} severity={notification.severity} variant="filled" sx={{ width: "100%" }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </>
    );
}
