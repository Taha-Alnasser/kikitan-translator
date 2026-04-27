import {
  Select,
  MenuItem,
  IconButton,
  Switch,
} from "@mui/material";
import {
  Mic as MicIcon,
  Translate as TranslateIcon,
  SwapHoriz as SwapHorizIcon,
} from "@mui/icons-material";
import { langSource, langTo, Lang } from "../util/constants";
import { Config } from "../util/config";

type Props = {
  label: string;
  config: Config;
  setConfig: (c: Config) => void;
  lang: Lang;
  ovKey: "screen_overlay" | "screen_overlay_2";
  detection: string;
  translation: string;
};

export default function OverlayCard({ label, config, setConfig, lang, ovKey, detection, translation }: Props) {
  const ov = config[ovKey];
  const lbl = `text-xs font-medium`;
  const box = `rounded-lg border px-3 py-2 h-12 text-sm font-medium overflow-hidden`;

  return (
    <div
      className={`flex-1 rounded-2xl border p-4 transition-opacity ${ov.enabled ? "" : "opacity-50"}`}
      style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm">{label}</span>
        <Switch size="small" checked={ov.enabled} onChange={(e) => setConfig({ ...config, [ovKey]: { ...ov, enabled: e.target.checked } })} />
      </div>
      <div className="flex items-center gap-1 mb-3">
        <Select size="small" value={ov.source_language}
          onChange={(e) => setConfig({ ...config, [ovKey]: { ...ov, source_language: e.target.value } })}>
          {langSource.map((l) => <MenuItem key={l.code} value={l.code}>{l.name[lang]}</MenuItem>)}
        </Select>
        <IconButton size="small" onClick={() => setConfig({ ...config, [ovKey]: { ...ov, source_language: ov.target_language, target_language: ov.source_language } })}>
          <SwapHorizIcon fontSize="small" />
        </IconButton>
        <Select size="small" value={ov.target_language}
          onChange={(e) => setConfig({ ...config, [ovKey]: { ...ov, target_language: e.target.value } })}>
          {langTo.map((l) => <MenuItem key={l.code} value={l.code}>{l.name[lang]}</MenuItem>)}
        </Select>
      </div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex flex-col gap-1">
          <span className={`${lbl} flex items-center gap-1`} style={{ color: "var(--tk-text-muted)" }}><MicIcon sx={{ fontSize: 11 }} /> Transcription</span>
          <div className={box} style={{ borderColor: "var(--tk-border)", color: "var(--tk-text)" }}>{detection}</div>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <span className={`${lbl} flex items-center gap-1`} style={{ color: "var(--tk-text-muted)" }}><TranslateIcon sx={{ fontSize: 11 }} /> Translation</span>
          <div className={box} style={{ borderColor: "var(--tk-border)", color: "var(--tk-text)" }}>{translation}</div>
        </div>
      </div>
      <Select size="small" fullWidth value={ov.corner}
        onChange={(e) => setConfig({ ...config, [ovKey]: { ...ov, corner: e.target.value as typeof ov.corner } })}>
        <MenuItem value="top-left">↖ Top Left</MenuItem>
        <MenuItem value="top-right">↗ Top Right</MenuItem>
        <MenuItem value="bottom-left">↙ Bottom Left</MenuItem>
        <MenuItem value="bottom-right">↘ Bottom Right</MenuItem>
      </Select>
    </div>
  );
}
