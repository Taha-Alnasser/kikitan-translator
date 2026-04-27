import * as React from "react";

import {
    Button,
    TextField,
    Snackbar,
    Alert,
    Slide
} from "@mui/material";

import { info } from "@tauri-apps/plugin-log";

import {
    Monitor as MonitorIcon,
} from "@mui/icons-material";

import { invoke } from "@tauri-apps/api/core";
import { listen, emitTo } from "@tauri-apps/api/event";

import {
    calculateMinWaitTime,
    Lang,
} from "../util/constants";

import { Config, load_config, MessageHistoryItem } from "../util/config";
import Modal from "../components/Modal";
import StatusStrip from "../components/StatusStrip";
import VRChatChatboxCard from "../components/VRChatChatboxCard";
import OverlayCard from "../components/OverlayCard";
import SocialFooter from "../components/SocialFooter";
import * as recognizers from "../util/recognizers";

import { localization } from "../util/localization";
import {
    send_desktop_recognition,
    send_desktop_translation,
    send_user_recognition,
    send_user_translation
} from "../util/data_out";
import { send_notification_text } from "../util/overlay";

type KikitanProps = {
    config: Config;
    setConfig: (config: Config) => void;
    lang: Lang;
    settingsVisible: boolean;
    vrchatRunning: boolean;
    openSettings?: (tab?: string) => void;
};

let detectionQueue: string[][] = [];
let lock = false;

// Dedup — EdgeSTT sometimes fires speech.phrase twice for the same utterance
let lastQueuedText = "";
let lastQueuedTime = 0;

export default function Kikitan({
    config,
    setConfig,
    lang,
    settingsVisible,
    vrchatRunning,
    openSettings,
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

    const [triggerUpdate, setTriggerUpdate] = React.useState(false);
    const configRef = React.useRef(config);
    configRef.current = config;

    const [sourceLanguage, setSourceLanguage] = React.useState(config.source_language);
    const [targetLanguage, setTargetLanguage] = React.useState(config.target_language);

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

    const restartChatbox = () => {
        if ((config.translator_settings.translation_service == 2 || config.translator_settings.recognition_service == 1) && config.groq.api_key.length == 0) {
            showNotification(localization.no_api_key_configured_for_groq[lang], "warning");
        }
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
                if (configRef.current.data_out.enable_desktop_data) {
                    send_desktop_recognition(result[0], isFinal);
                    if (isFinal) send_desktop_translation(result[1]);
                }
                if (isFinal) setDesktopResult(result[1]);
            },
        });
    };

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

    React.useEffect(() => {
        send_notification_text(desktopResult, (config.source_language == "ja" || config.source_language == "ko" || config.source_language == "zh"));
    }, [desktopResult]);

    // Restart chatbox + desktop on any language / mode / service change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => {
        if (!srStatus) return;
        restartChatbox();
        restartDesktop();
    }, [
        sourceLanguage,
        targetLanguage,
        config.mode,
        config.translator_settings.recognition_service,
        config.translator_settings.translation_service,
        config.translator_settings.desktop_translation,
    ]);

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
        if (srStatus) recognizers.resumeAll();
        else recognizers.pauseAll();
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
        listen<boolean>("disable-kikitan-desktop", (e) => { if (e.payload) recognizers.stop("desktop"); else restartDesktop(); });
        listen<boolean>("disable-kikitan-chatbox", (e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, enable_chatbox: !e.payload } }));

        invoke("get_microphone_list").then((data) => {
            const d = data as { name: string, sample_rate: number }[];
            if (d.filter(v => v.name == load_config().microphone).length == 0) {
                showNotification(localization.microphone_updated[lang], "warning");
                setConfig({ ...config, microphone: d[0].name });
            }
        });
        setInterval(() => {
            invoke("get_microphone_list").then((data) => {
                const d = data as { name: string, sample_rate: number }[];
                if (d.filter(v => v.name == load_config().microphone).length == 0) {
                    showNotification(localization.microphone_updated[lang], "warning");
                    setConfig({ ...config, microphone: d[0].name });
                }
            });
        }, 1000);
    }, []);

    React.useEffect(() => {
        if (settingsVisible === false && srStatus) {
            restartChatbox();
            restartDesktop();
            restartOverlay(1);
            restartOverlay(2);
        }
    }, [settingsVisible]);

    React.useEffect(() => { restartOverlay(1); }, [config.screen_overlay?.enabled, config.screen_overlay?.source_language, config.screen_overlay?.target_language]);
    React.useEffect(() => { restartOverlay(2); }, [config.screen_overlay_2?.enabled, config.screen_overlay_2?.source_language, config.screen_overlay_2?.target_language]);

    const formatTimestamp = (ts: number) => new Date(ts).toLocaleTimeString();

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
                        onKeyDown={(e) => { if (e.key == "Enter") { recognizers.triggerChatbox(textInputValue); setTextInputVisible(false); setTextInputValue(""); } }}
                        onChange={(e) => setTextInputValue(e.target.value)}
                    />
                    <Button variant="contained" onClick={() => { recognizers.triggerChatbox(textInputValue); setTextInputVisible(false); setTextInputValue(""); }}>{localization.send[lang]}</Button>
                    <Button variant="contained" color="error" onClick={() => { setTextInputVisible(false); setTextInputValue(""); }}>{localization.close_menu[lang]}</Button>
                </div>
            </Modal>

            {/* Main layout */}
            <div id="main" className="relative z-10 flex flex-col gap-3 w-full" style={{ maxWidth: 860 }}>

                {/* ── Status strip ── */}
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
                    onMicClick={() => openSettings?.("audio")}
                    modeLabels={{ translation: localization.translation[lang], stt: localization.stt_only[lang] }}
                />

                {/* ── VRChat Chatbox ── */}
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
                    onOpenTextInput={() => {
                        if (!textInputVisible) { textInputRef.current?.focus(); textInputRef.current?.select(); }
                        setTextInputVisible(!textInputVisible);
                    }}
                    textInputDisabled={!srStatus}
                    onShowHistory={() => setShowMessageHistory(true)}
                />

                {/* ── Screen Overlays ── */}
                <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <MonitorIcon sx={{ fontSize: 14 }} className="opacity-50" />
                        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--tk-text-muted)" }}>Screen Overlays</span>
                    </div>
                    <div className="flex gap-3">
                        <OverlayCard label="Overlay 1" config={config} setConfig={setConfig} lang={lang}
                            ovKey="screen_overlay" detection={ov1Detection} translation={ov1Translation} />
                        <OverlayCard label="Overlay 2" config={config} setConfig={setConfig} lang={lang}
                            ovKey="screen_overlay_2" detection={ov2Detection} translation={ov2Translation} />
                    </div>
                </div>

                {/* ── Social Footer ── */}
                <SocialFooter />
            </div>

            <Snackbar open={notification.open} autoHideDuration={5000} onClose={() => setNotification(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} TransitionComponent={Slide}>
                <Alert onClose={() => setNotification(prev => ({ ...prev, open: false }))} severity={notification.severity} variant="filled" sx={{ width: "100%" }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </>
    );
}
