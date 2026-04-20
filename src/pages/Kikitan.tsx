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
    Close as CloseIcon,
    Mic as MicIcon,
    Translate as TranslateIcon,
    SwapHoriz as SwapHorizIcon,
    SportsEsports as SportsEsportsIcon,
    Monitor as MonitorIcon,
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
import { performTranslation } from "../util/translate";
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

let sr: Recognizer | null = null;
let sr2: Recognizer | null = null;
let desktopSR: Recognizer | null = null;
let detectionQueue: string[][] = [];
let lock = false;
let restartTimeout: NodeJS.Timeout | null = null;

export default function Kikitan({
    config,
    setConfig,
    lang,
    settingsVisible,
}: KikitanProps) {
    const [detecting, setDetecting] = React.useState(false);
    const [srStatus, setSRStatus] = React.useState(true);
    const [srLoading, setSRLoading] = React.useState(false)
    const [vrcMuted, setVRCMuted] = React.useState(false);
    const [startedSpeaking, setStartedSpeaking] = React.useState(false);

    const [result, setResult] = React.useState<string[]>([]);
    const [detection, setDetection] = React.useState<string>("");
    const [translated, setTranslated] = React.useState("");
    const [desktopResult, setDesktopResult] = React.useState("");

    const [microphones, setMicrophones] = React.useState<{ name: string, sample_rate: number }[]>([])

    const [triggerUpdate, setTriggerUpdate] = React.useState(false);
    const configRef = React.useRef(config);
    configRef.current = config;

    const [sourceLanguage, setSourceLanguage] = React.useState(
        config.source_language
    );
    const [targetLanguage, setTargetLanguage] = React.useState(
        config.target_language
    );

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

    const showNotification = (message: string, severity: "success" | "error" | "warning" | "info" = "info") => {
        setNotification({ open: true, message, severity });
    };

    const enableDesktopCapture = () => {
        desktopSR?.stop();

        switch (config.translator_settings.recognition_service) {
            case 0: // Microsoft Bing
                desktopSR = new EdgeSTT(targetLanguage, sourceLanguage, true, false, null, showNotification, setConfig)
                info(`[DESKTOP CAPTURE] Using EdgeSTT for recognition`);

                break;
            case 1: // Groq
                desktopSR = new VAD(targetLanguage, sourceLanguage, true, false, null, showNotification, setConfig)
                info(`[DESKTOP CAPTURE] Using Groq for recognition`);

                break;
            case 2: // WebSpeech, legacy
                error(`[DESKTOP CAPTURE] Cannot use WebSpeech for desktop capture!`);

                showNotification(localization.cannot_use_webspeech_for_desktop_translation[lang], "warning")
                return;
            default:
                error(`[DESKTOP CAPTURE] Unknown recognizer! ${config.translator_settings.recognition_service}`);

                return;
        }

        desktopSR.onResult(async (result: string[], isFinal: boolean) => {
            if (config.data_out.enable_desktop_data) {
                send_desktop_recognition(result[0], isFinal);

                if (isFinal) send_desktop_translation(result[1]);
            }

            if (isFinal) {
                setDesktopResult(result[1]);
            }
        });

        desktopSR.start();
    };

    const restartSR = () => {
        sr?.stop();

        info(`[SR] Initializing SR...`);

        if ((config.translator_settings.translation_service == 2 || config.translator_settings.recognition_service == 1) && config.groq.api_key.length == 0) {
            showNotification(localization.no_api_key_configured_for_groq[lang], "warning")
        }

        switch (config.translator_settings.recognition_service) {
            case 0: // Microsoft Bing
                sr = new EdgeSTT(sourceLanguage, targetLanguage, false, config.mode == 1, setSRLoading, showNotification, setConfig)
                info(`[SR] Using EdgeSTT for recognition`);

                break;
            case 1: // Groq
                sr = new VAD(sourceLanguage, targetLanguage, false, config.mode == 1, setSRLoading, showNotification, setConfig)
                info(`[SR] Using Groq for recognition`);

                break;
            case 2: // WebSpeech, legacy
                sr = new WebSpeech(sourceLanguage, targetLanguage, config.mode == 1, setSRLoading, showNotification, setConfig)
                info(`[SR] Using WebSoeech for recognition`);

                break;
            default:
                error(`[SR] Unknown recognizer! ${config.translator_settings.recognition_service}`);

                return;
        }

        sr.onResult((result: string[], isFinal: boolean) => {
            setDetecting(!isFinal);

            setResult(result);
        });

        info("[SR] Starting recognition");
        sr?.start();
    };

    const restartDesktopSR = () => {
        const cfg = load_config();

        if (cfg.translator_settings.desktop_translation) {
            info("[DESKTOP CAPTURE] Starting desktop capture...");

            enableDesktopCapture();
        } else {
            desktopSR?.stop();
            desktopSR = null;
        }
    };

    const restartOverlay2SR = () => {
        sr2?.stop();
        sr2 = null;

        const cfg = load_config();
        if (!cfg.screen_overlay_2?.enabled) return;

        const ov2 = cfg.screen_overlay_2;

        switch (cfg.translator_settings.recognition_service) {
            case 0: // Microsoft Bing
                sr2 = new EdgeSTT(ov2.source_language, ov2.target_language, false, false, null, showNotification, setConfig);
                info(`[SR2] Using EdgeSTT (${ov2.source_language} → ${ov2.target_language})`);
                break;
            case 1: // Groq
                sr2 = new VAD(ov2.source_language, ov2.target_language, false, false, null, showNotification, setConfig);
                info(`[SR2] Using Groq (${ov2.source_language} → ${ov2.target_language})`);
                break;
            case 2: // WebSpeech, legacy
                sr2 = new WebSpeech(ov2.source_language, ov2.target_language, false, null, showNotification, setConfig);
                info(`[SR2] Using WebSpeech (${ov2.source_language} → ${ov2.target_language})`);
                break;
            default:
                error(`[SR2] Unknown recognizer!`);
                return;
        }

        sr2.onResult((result: string[], isFinal: boolean) => {
            if (isFinal && configRef.current.screen_overlay_2?.enabled) {
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
        info(
            `[LANGUAGE] Changing language (${sourceLanguage} - ${targetLanguage}) - sr=${sr != null
            }`
        );

        if (sr) {
            sr?.stop();
            desktopSR?.stop();

            if (restartTimeout) {
                clearTimeout(restartTimeout);
            }

            restartTimeout = setTimeout(() => {
                restartSR();
                restartDesktopSR();
            }, 500);
        }

        setLanguageUpdate(false);
    }, [languageUpdate]);

    React.useEffect(() => {
        if (vrcMuted && !startedSpeaking && config.vrchat_settings.disable_kikitan_when_muted) {
            console.log("Skipping this");

            return;
        }

        setDetection(result[0]);
        setStartedSpeaking(detecting);

        if ((config.mode == 1 || config.vrchat_settings.send_typing_status_while_talking) && config.vrchat_settings.enable_chatbox) {
            invoke("send_typing", {
                address: config.vrchat_settings.osc_address,
                port: `${config.vrchat_settings.osc_port}`,
            });
        }

        if (config.data_out.enable_user_data) {
            send_user_recognition(result[0], !detecting);

            if (!detecting && config.mode == 0) send_user_translation(result[1]);
        }

        if (config.mode == 1 && config.vrchat_settings.enable_chatbox && !detecting) {
            invoke("send_message", {
                address: config.vrchat_settings.osc_address,
                port: `${config.vrchat_settings.osc_port}`,
                msg: result[0],
            })
        }

        if (!detecting && result.length != 0 && (result[1].length != 0 || config.screen_overlay?.enabled || config.screen_overlay_2?.enabled)) {
            detectionQueue = [...detectionQueue, result];

            info(
                `[QUEUE] Updating queue. Current queue length: ${detectionQueue.length}`
            );
        }
    }, [result, detecting]);

    React.useEffect(() => {
        info(`[SR] SR status=${srStatus}`);

        if (sr == null) {
            warn("[SR] SR is currently null, so ignoring the changes");

            return;
        }

        if (srStatus) {
            info("[SR] Starting SR...");
            sr.start();
            desktopSR?.start();
            sr2?.start();
        } else {
            info("[SR] Stopping SR...");
            sr.stop();
            desktopSR?.stop();
            sr2?.stop();
        }
    }, [srStatus]);

    React.useEffect(() => {
        (async () => {
            if (detectionQueue.length == 0 || lock) return;

            const current = detectionQueue[0];
            detectionQueue = detectionQueue.slice(1);

            lock = true;

            // Always read current config from ref — avoids stale closure bugs
            const cfg = configRef.current;

            info(
                `[QUEUE] Processing the queue. Current queue length: ${detectionQueue.length}`
            );

            const current_detection = current[0];
            const current_translation = current[1];

            // VRChat chatbox: uses main translation, independent of overlay state
            if (cfg.mode === 0 && cfg.vrchat_settings.enable_chatbox && current_translation.length > 0) {
                info("[TRANSLATION] Sending main translation to chatbox...");
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

            // Overlay 1: translate with its own language pair and display (no VRChat)
            if (cfg.screen_overlay?.enabled) {
                if (cfg.mode === 0) {
                    performTranslation(
                        current_detection,
                        cfg.screen_overlay.source_language,
                        cfg.screen_overlay.target_language,
                        cfg,
                        null,
                        null
                    ).then((translation1) => {
                        emitTo("screen-overlay", "screen-overlay:line", {
                            transcription: current_detection,
                            translation: translation1,
                        });
                    });
                } else {
                    emitTo("screen-overlay", "screen-overlay:line", {
                        transcription: current_detection,
                        translation: "",
                    });
                }
            }

            // Overlay 2 is fed by sr2 (its own mic recognizer) — not the mic queue

            if (cfg.mode == 0) setTranslated(current_translation);

            if (cfg.message_history.enabled) {
                const newHistoryItem: MessageHistoryItem = {
                    source: current_detection,
                    translation: current_translation,
                    timestamp: Date.now(),
                };

                const updatedItems = [
                    newHistoryItem,
                    ...cfg.message_history.items,
                ].slice(0, cfg.message_history.max_items);

                setConfig({
                    ...cfg,
                    message_history: {
                        ...cfg.message_history,
                        items: updatedItems,
                    },
                });
            }


            await new Promise((r) =>
                setTimeout(
                    r,
                    calculateMinWaitTime(
                        current_translation,
                        cfg.vrchat_settings.chatbox_update_speed
                    )
                )
            );

            lock = false;
        })();

        setTimeout(() => {
            setTriggerUpdate(!triggerUpdate);
        }, 100);
    }, [triggerUpdate]);

    React.useEffect(() => {
        listen<boolean>("vrchat-mute", (event) => {
            info(`[OSC] Received mute status ${event.payload}`);
            setVRCMuted(event.payload);
        });

        listen<boolean>("disable-kikitan-mic", (event) => {
            info(`[OSC] Received disable mic ${event.payload}`);

            setSRStatus(!event.payload);
        });

        listen<boolean>("disable-kikitan-desktop", (event) => {
            info(`[OSC] Received disable desktop capture ${event.payload}`);

            if (event.payload) desktopSR?.stop();
            else desktopSR?.start();
        });

        listen<boolean>("disable-kikitan-chatbox", (event) => {
            info(`[OSC] Received disable chatbox ${event.payload}`);

            setConfig({
                ...config,
                vrchat_settings: {
                    ...config.vrchat_settings,
                    enable_chatbox: !event.payload,
                },
            });
        });

        if (sr == null) {
            invoke("get_microphone_list").then((data) => {
                const d = data as { name: string, sample_rate: number }[];
                if (d.filter(val => val.name == load_config().microphone).length == 0) {
                    showNotification(localization.microphone_updated[lang], "warning")

                    setConfig({
                        ...config,
                        microphone: d[0].name
                    })
                    restartSR();
                }

                setMicrophones(d)
            })

            setInterval(() => {
                invoke("get_microphone_list").then((data) => {
                    const d = data as { name: string, sample_rate: number }[];
                    if (d.filter(val => val.name == load_config().microphone).length == 0) {
                        showNotification(localization.microphone_updated[lang], "warning")

                        setConfig({
                            ...config,
                            microphone: d[0].name
                        })
                        restartSR();
                    }

                    setMicrophones(d)
                })
            }, 1000)
        }
    }, []);

    React.useEffect(() => {
        if (settingsVisible == false && srStatus) {
            restartSR();
            restartDesktopSR();
            restartOverlay2SR();
        }
    }, [settingsVisible]);

    // Restart overlay 2's mic recognizer when its settings change
    React.useEffect(() => {
        restartOverlay2SR();
    }, [config.screen_overlay_2?.enabled]);

    React.useEffect(() => {
        if (sr2) restartOverlay2SR();
    }, [config.screen_overlay_2?.source_language, config.screen_overlay_2?.target_language]);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    // Shared select styles
    const selSx = {
        color: config.light_mode ? "black" : "white",
        "& .MuiOutlinedInput-notchedOutline": { borderColor: config.light_mode ? "#cbd5e1" : "#475569" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: config.light_mode ? "#94a3b8" : "#64748b" },
        "& .MuiSvgIcon-root": { color: config.light_mode ? "black" : "#94A3B8" },
    };
    const menuSx = { sx: { "& .MuiPaper-root": { backgroundColor: config.light_mode ? "white" : "#020617" } } };
    const menuItemSx = { color: config.light_mode ? "black" : "white" };
    const cardCls = `rounded-2xl border p-5 ${config.light_mode ? "border-slate-200 bg-white shadow-sm" : "border-slate-700 bg-slate-900"}`;
    const labelCls = `text-xs font-medium ${config.light_mode ? "text-slate-500" : "text-slate-400"}`;

    return (
        <>
            {/* Message History Modal */}
            <div
                className={
                    "transition-all z-20 w-full h-64 flex backdrop-blur-sm bg-transparent justify-center items-center absolute" +
                    (showMessageHistory ? " opacity-100" : " opacity-0 pointer-events-none")
                }
            >
                <div className={`flex flex-col w-10/12 h-96 outline outline-1 ${config.light_mode ? "outline-white" : "outline-slate-900"} rounded-xl ${config.light_mode ? "bg-white" : "bg-slate-950"} p-4 overflow-hidden`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className={`text-base font-bold ${config.light_mode ? "text-black" : "text-white"}`}>
                            {localization.message_history[lang]}
                        </h2>
                        <IconButton onClick={() => setShowMessageHistory(false)} sx={{ color: config.light_mode ? "rgba(0,0,0,0.87)" : "#ffffff" }}>
                            <CloseIcon />
                        </IconButton>
                    </div>
                    <div className="overflow-y-auto flex-grow mb-4" style={{ maxHeight: "calc(100% - 4rem)" }}>
                        {config.message_history.items.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <span className={`text-sm italic ${config.light_mode ? "text-gray-500" : "text-gray-400"}`}>
                                    {localization.no_history[lang]}
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {config.message_history.items.map((item, index) => (
                                    <div key={index} className={`p-3 rounded-lg ${config.light_mode ? "bg-gray-100" : "bg-slate-900"}`}>
                                        <div className={`text-xs mb-1 ${config.light_mode ? "text-gray-500" : "text-gray-400"}`}>
                                            {formatTimestamp(item.timestamp)}
                                        </div>
                                        <div className={`font-medium text-sm ${config.light_mode ? "text-black" : "text-white"}`}>
                                            {item.source}
                                        </div>
                                        <div className={`mt-1 text-sm ${config.light_mode ? "text-gray-700" : "text-gray-300"}`}>
                                            {item.translation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Text Input Modal */}
            <div className={"transition-all z-20 w-full h-64 flex bg-transparent justify-center items-center absolute" + (textInputVisible ? " opacity-100" : " opacity-0 pointer-events-none")}>
                <div className={`flex flex-col justify-center w-7/12 h-2/6 outline outline-1 ${config.light_mode ? "outline-slate-200" : "outline-slate-800"} rounded-xl ${config.light_mode ? "bg-white" : "bg-slate-950"}`}>
                    <div className="flex flex-row justify-center gap-2 px-4">
                        <TextField
                            slotProps={{ inputLabel: { style: { color: config.light_mode ? "black" : "#94A3B8" } }, htmlInput: { style: { color: config.light_mode ? "black" : "#fff" } } }}
                            inputRef={textInputRef}
                            placeholder={localization.type_here[lang]}
                            className="mt-2 w-48"
                            value={textInputValue}
                            id="outlined-basic"
                            variant="outlined"
                            onKeyDown={(e) => { if (e.key == "Enter") { sr?.manual_trigger(textInputValue); setTextInputVisible(false); setTextInputValue(""); } }}
                            onChange={(e) => setTextInputValue(e.target.value)}
                        />
                        <Button variant="contained" onClick={() => { sr?.manual_trigger(textInputValue); setTextInputVisible(false); setTextInputValue(""); }}>
                            {localization.send[lang]}
                        </Button>
                        <Button variant="contained" color="error" onClick={() => { setTextInputVisible(false); setTextInputValue(""); }}>
                            {localization.close_menu[lang]}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main layout */}
            <div id="main" className="relative z-10 flex flex-col gap-4 w-full" style={{ maxWidth: 860 }}>

                {/* ── VRChat Chatbox Card ── */}
                <div className={cardCls}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <SportsEsportsIcon fontSize="small" className="opacity-60" />
                            <span className="font-bold text-sm tracking-wide">VRChat Chatbox</span>
                        </div>
                        <Switch
                            size="small"
                            checked={config.vrchat_settings.enable_chatbox}
                            onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, enable_chatbox: e.target.checked } })}
                        />
                    </div>

                    {/* Language pair */}
                    <div className="flex items-center gap-2 mb-4">
                        <Select
                            size="small"
                            value={sourceLanguage}
                            onChange={(e) => { setSourceLanguage(e.target.value); setLanguageUpdate(true); setConfig({ ...config, source_language: e.target.value }); }}
                            sx={selSx}
                            MenuProps={menuSx}
                        >
                            {langSource.map((el) => <MenuItem key={el.code} value={el.code} sx={menuItemSx}>{el.name[lang]}</MenuItem>)}
                        </Select>
                        <IconButton
                            size="small"
                            disabled={languageUpdate}
                            onClick={() => {
                                const newT = sourceLanguage;
                                const newS = targetLanguage;
                                setTargetLanguage(newT);
                                setSourceLanguage(newS);
                                setLanguageUpdate(true);
                                setConfig({ ...config, source_language: newS, target_language: newT });
                            }}
                        >
                            <SwapHorizIcon fontSize="small" />
                        </IconButton>
                        <Select
                            size="small"
                            value={targetLanguage}
                            onChange={(e) => { setTargetLanguage(e.target.value); setLanguageUpdate(true); setConfig({ ...config, target_language: e.target.value }); }}
                            sx={selSx}
                            MenuProps={menuSx}
                        >
                            {langTo.map((el) => <MenuItem key={el.code} value={el.code} sx={menuItemSx}>{el.name[lang]}</MenuItem>)}
                        </Select>
                    </div>

                    {/* Display boxes */}
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 flex flex-col gap-1">
                            <span className={`${labelCls} flex items-center gap-1`}>
                                <MicIcon sx={{ fontSize: 11 }} /> Transcription
                            </span>
                            <div className={`rounded-lg border px-3 py-2 min-h-16 text-sm font-medium transition-all ${detecting ? "italic opacity-60" : ""} ${!srStatus ? config.light_mode ? "bg-slate-100" : "bg-slate-800" : ""} ${config.light_mode ? "border-slate-200 text-slate-800" : "border-slate-700 text-slate-200"}`}>
                                {detection}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <span className={`${labelCls} flex items-center gap-1`}>
                                <TranslateIcon sx={{ fontSize: 11 }} /> Translation
                            </span>
                            <div className={`rounded-lg border px-3 py-2 min-h-16 text-sm font-medium transition-all ${!srStatus ? config.light_mode ? "bg-slate-100" : "bg-slate-800" : ""} ${config.light_mode ? "border-slate-200 text-slate-800" : "border-slate-700 text-slate-200"}`}>
                                {translated}
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2">
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={!srStatus}
                            onClick={() => { if (!textInputVisible) { textInputRef.current?.focus(); textInputRef.current?.select(); } setTextInputVisible(!textInputVisible); }}
                        >
                            {localization.text[lang]} <Keyboard className="ml-1" sx={{ fontSize: 16 }} />
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            color={srStatus ? !srLoading ? "error" : "inherit" : "success"}
                            disabled={srLoading}
                            sx={{ '&.Mui-disabled': { borderColor: config.light_mode ? 'rgba(0,0,0,0.4)' : 'rgba(148,163,184,0.5)', color: config.light_mode ? 'rgba(0,0,0,0.4)' : 'rgba(148,163,184,0.5)' } }}
                            onClick={() => { invoke("send_disable_mic", { data: !srStatus, address: config.vrchat_settings.osc_address, port: `${config.vrchat_settings.osc_port}` }); setSRStatus(!srStatus); }}
                        >
                            {!srStatus ? localization.start[lang] : !srLoading ? localization.stop[lang] : ""}
                            {srStatus ? !srLoading ? <PauseIcon sx={{ fontSize: 16 }} /> : <CircularProgress color="inherit" size={14} /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                        </Button>
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
                        <span className={`text-xs font-semibold tracking-widest uppercase ${config.light_mode ? "text-slate-500" : "text-slate-400"}`}>
                            Screen Overlays
                        </span>
                    </div>
                    <div className="flex gap-3">
                        {([
                            { label: "Overlay 1", key: "screen_overlay" as const, note: "" },
                            { label: "Overlay 2", key: "screen_overlay_2" as const, note: "" },
                        ] as const).map(({ label, key, note }) => {
                            const ov = config[key];
                            return (
                                <div key={key} className={`flex-1 rounded-2xl border p-4 transition-opacity ${ov.enabled ? "" : "opacity-50"} ${config.light_mode ? "border-slate-200 bg-white shadow-sm" : "border-slate-700 bg-slate-900"}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{label}</span>
                                            {note && <span className={`text-xs px-1.5 py-0.5 rounded ${config.light_mode ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"}`}>{note}</span>}
                                        </div>
                                        <Switch
                                            size="small"
                                            checked={ov.enabled}
                                            onChange={(e) => setConfig({ ...config, [key]: { ...ov, enabled: e.target.checked } })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 mb-2">
                                        <Select size="small" value={ov.source_language} onChange={(e) => setConfig({ ...config, [key]: { ...ov, source_language: e.target.value } })} sx={selSx} MenuProps={menuSx}>
                                            {langSource.map((l) => <MenuItem key={l.code} value={l.code} sx={menuItemSx}>{l.name[lang]}</MenuItem>)}
                                        </Select>
                                        <IconButton size="small" onClick={() => setConfig({ ...config, [key]: { ...ov, source_language: ov.target_language, target_language: ov.source_language } })}>
                                            <SwapHorizIcon fontSize="small" />
                                        </IconButton>
                                        <Select size="small" value={ov.target_language} onChange={(e) => setConfig({ ...config, [key]: { ...ov, target_language: e.target.value } })} sx={selSx} MenuProps={menuSx}>
                                            {langTo.map((l) => <MenuItem key={l.code} value={l.code} sx={menuItemSx}>{l.name[lang]}</MenuItem>)}
                                        </Select>
                                    </div>
                                    <Select size="small" fullWidth value={ov.corner} onChange={(e) => setConfig({ ...config, [key]: { ...ov, corner: e.target.value as typeof ov.corner } })} sx={selSx} MenuProps={menuSx}>
                                        <MenuItem value="top-left" sx={menuItemSx}>↖ Top Left</MenuItem>
                                        <MenuItem value="top-right" sx={menuItemSx}>↗ Top Right</MenuItem>
                                        <MenuItem value="bottom-left" sx={menuItemSx}>↙ Bottom Left</MenuItem>
                                        <MenuItem value="bottom-right" sx={menuItemSx}>↘ Bottom Right</MenuItem>
                                    </Select>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Microphone + Social ── */}
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <KeyboardVoiceIcon fontSize="small" className="opacity-50" />
                        <Select
                            size="small"
                            value={config.microphone}
                            onChange={(e) => { setConfig({ ...config, microphone: e.target.value as string }); setTimeout(() => restartSR(), 250); }}
                            sx={selSx}
                            MenuProps={menuSx}
                            className="w-52"
                        >
                            {microphones.map((element) => (
                                <MenuItem key={element.name} value={element.name} sx={menuItemSx}>
                                    {(element.name.includes("(") && element.name.includes(")")) ? element.name.match(/\(([^)]+)\)/)?.[1] : element.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="contained" size="small" onClick={() => open("https://twitter.com/marquina_osu")}>
                            <XIcon fontSize="small" />
                        </Button>
                        <Button variant="contained" size="small" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}>
                            <FavoriteIcon fontSize="small" />
                        </Button>
                        <Button variant="contained" size="small" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}>
                            <GitHubIcon fontSize="small" />
                        </Button>
                        <Button variant="contained" size="small" onClick={() => open("https://discord.gg/jpkYCgpBGV")}>
                            <img src="/discordlogo.webp" className="invert" width={18} />
                        </Button>
                    </div>
                </div>
            </div>

            <Snackbar
                open={notification.open}
                autoHideDuration={5000}
                onClose={() => setNotification(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                TransitionComponent={Slide}
            >
                <Alert onClose={() => setNotification(prev => ({ ...prev, open: false }))} severity={notification.severity} variant="filled" sx={{ width: "100%" }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </>
    );
}
