import * as React from "react";
import { Tooltip, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress } from "@mui/material";
import {
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  RestartAlt as RestartAltIcon,
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
  onMicClick: () => void;
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
