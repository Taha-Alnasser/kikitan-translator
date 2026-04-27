import { TabProps } from "./types";
import { FormControlLabel, FormGroup, Checkbox, Slider, Typography, Button } from "@mui/material";
import { Delete } from "@mui/icons-material";
import { localization } from "../../util/localization";

export default function SettingsHistory({ config, setConfig, lang }: TabProps) {
  const m = config.message_history;
  const set = (patch: Partial<typeof m>) => setConfig({ ...config, message_history: { ...m, ...patch } });
  return (
    <FormGroup className="flex flex-col gap-4">
      <FormControlLabel control={<Checkbox checked={m.enabled} onChange={(e) => set({ enabled: e.target.checked })} />} label={localization.enable_history[lang]} />
      <div>
        <Typography variant="body2">{localization.max_history_items[lang]}: {m.max_items}</Typography>
        <Slider disabled={!m.enabled} value={m.max_items} min={10} max={200} step={10}
          onChange={(_, v) => set({ max_items: v as number })} valueLabelDisplay="auto" sx={{ width: 280 }} />
      </div>
      <Button variant="contained" color="error" startIcon={<Delete />}
        disabled={!m.enabled || m.items.length === 0}
        onClick={() => set({ items: [] })}>
        {localization.clear_history[lang]}
      </Button>
      <Typography variant="body2">{m.items.length} {localization.message_history[lang].toLowerCase()}</Typography>
    </FormGroup>
  );
}
