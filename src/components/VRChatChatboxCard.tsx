import {
  Select,
  MenuItem,
  Button,
  IconButton,
  Switch,
  Tooltip,
} from "@mui/material";
import {
  Keyboard,
  History as HistoryIcon,
  Mic as MicIcon,
  Translate as TranslateIcon,
  SwapHoriz as SwapHorizIcon,
  SportsEsports as SportsEsportsIcon,
} from "@mui/icons-material";
import { langSource, langTo, Lang } from "../util/constants";
import { Config } from "../util/config";
import { localization } from "../util/localization";

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
  onOpenTextInput: () => void;
  textInputDisabled: boolean;
  onShowHistory: () => void;
};

export default function VRChatChatboxCard({
  config, setConfig, lang,
  sourceLanguage, setSourceLanguage,
  targetLanguage, setTargetLanguage,
  detection, translated, detecting,
  onOpenTextInput, textInputDisabled, onShowHistory,
}: Props) {
  const lbl = `text-xs font-medium`;
  const box = (dim: boolean) =>
    `rounded-lg border px-3 py-2 h-12 text-sm font-medium overflow-hidden transition-all ${dim ? "italic opacity-60" : ""}`;

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SportsEsportsIcon fontSize="small" className="opacity-60" />
          <span className="font-bold text-sm">VRChat Chatbox</span>
        </div>
        <Switch size="small" checked={config.vrchat_settings.enable_chatbox}
          onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, enable_chatbox: e.target.checked } })} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Select size="small" value={sourceLanguage}
          onChange={(e) => {
            setSourceLanguage(e.target.value);
            setConfig({ ...config, source_language: e.target.value });
          }}>
          {langSource.map((el) => <MenuItem key={el.code} value={el.code}>{el.name[lang]}</MenuItem>)}
        </Select>
        <IconButton size="small"
          onClick={() => {
            const t = sourceLanguage; const s = targetLanguage;
            setTargetLanguage(t); setSourceLanguage(s);
            setConfig({ ...config, source_language: s, target_language: t });
          }}>
          <SwapHorizIcon fontSize="small" />
        </IconButton>
        <Select size="small" value={targetLanguage}
          onChange={(e) => {
            setTargetLanguage(e.target.value);
            setConfig({ ...config, target_language: e.target.value });
          }}>
          {langTo.map((el) => <MenuItem key={el.code} value={el.code}>{el.name[lang]}</MenuItem>)}
        </Select>
      </div>
      <div className="flex gap-3 mb-3">
        <div className="flex-1 flex flex-col gap-1">
          <span className={`${lbl} flex items-center gap-1`} style={{ color: "var(--tk-text-muted)" }}><MicIcon sx={{ fontSize: 11 }} /> Transcription</span>
          <div className={box(detecting)} style={{ borderColor: "var(--tk-border)", color: "var(--tk-text)" }}>{detection}</div>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <span className={`${lbl} flex items-center gap-1`} style={{ color: "var(--tk-text-muted)" }}><TranslateIcon sx={{ fontSize: 11 }} /> Translation</span>
          <div className={box(false)} style={{ borderColor: "var(--tk-border)", color: "var(--tk-text)" }}>{translated}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outlined" size="small" disabled={textInputDisabled} onClick={onOpenTextInput}>
          {localization.text[lang]} <Keyboard className="ml-1" sx={{ fontSize: 16 }} />
        </Button>
        {config.message_history.enabled && (
          <Tooltip title={localization.message_history[lang]}>
            <Button variant="outlined" size="small" onClick={onShowHistory}>
              <HistoryIcon sx={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
