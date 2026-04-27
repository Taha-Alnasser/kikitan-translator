import { TabProps } from "./types";
import { Slider, TextField, Switch, FormControlLabel, Typography, Divider } from "@mui/material";
import { ScreenOverlayConfig } from "../../util/config";

function OverlayOptions({ ov, set }: { ov: ScreenOverlayConfig; set: (patch: Partial<ScreenOverlayConfig>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <FormControlLabel control={<Switch checked={ov.vrc_only} onChange={(e) => set({ vrc_only: e.target.checked })} />} label="Show only when VRChat is running" />
      <div>
        <Typography variant="body2">Transcription font size: {ov.transcription_font_size}px</Typography>
        <Slider min={12} max={48} step={1} value={ov.transcription_font_size} onChange={(_, v) => set({ transcription_font_size: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Translation font size: {ov.font_size}px</Typography>
        <Slider min={12} max={48} step={1} value={ov.font_size} onChange={(_, v) => set({ font_size: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Fade timeout: {ov.fade_timeout}s</Typography>
        <Slider min={2} max={20} step={1} value={ov.fade_timeout} onChange={(_, v) => set({ fade_timeout: v as number })} />
      </div>
      <div>
        <Typography variant="body2">Max lines: {ov.max_lines}</Typography>
        <Slider min={1} max={8} step={1} value={ov.max_lines} onChange={(_, v) => set({ max_lines: v as number })} />
      </div>
      <div className="flex gap-3">
        <TextField label="Translation color" size="small" value={ov.text_color} onChange={(e) => set({ text_color: e.target.value })} placeholder="#ffffff" />
        <TextField label="Transcription color" size="small" value={ov.transcription_color} onChange={(e) => set({ transcription_color: e.target.value })} placeholder="#60a5fa" />
      </div>
    </div>
  );
}

export default function SettingsOverlays({ config, setConfig }: TabProps) {
  const set1 = (patch: Partial<ScreenOverlayConfig>) => setConfig({ ...config, screen_overlay: { ...config.screen_overlay, ...patch } });
  const set2 = (patch: Partial<ScreenOverlayConfig>) => setConfig({ ...config, screen_overlay_2: { ...config.screen_overlay_2, ...patch } });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Typography variant="subtitle1" className="mb-2 font-semibold">Overlay 1</Typography>
        <OverlayOptions ov={config.screen_overlay} set={set1} />
      </div>
      <Divider />
      <div>
        <Typography variant="subtitle1" className="mb-2 font-semibold">Overlay 2</Typography>
        <OverlayOptions ov={config.screen_overlay_2} set={set2} />
      </div>
    </div>
  );
}
