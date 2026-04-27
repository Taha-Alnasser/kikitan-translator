import { TabProps } from "./types";
import { Select, MenuItem, TextField, IconButton, FormGroup, FormControlLabel, Checkbox, Typography } from "@mui/material";
import { History } from "@mui/icons-material";
import { localization } from "../../util/localization";
import { speed_presets, DEFAULT_CONFIG } from "../../util/config";

export default function SettingsVRChat({ config, setConfig, lang }: TabProps) {
  const v = config.vrchat_settings;
  const set = (patch: Partial<typeof v>) => setConfig({ ...config, vrchat_settings: { ...v, ...patch } });
  const resetOsc = () => set({ osc_address: DEFAULT_CONFIG.vrchat_settings.osc_address, osc_port: DEFAULT_CONFIG.vrchat_settings.osc_port });
  const oscModified = v.osc_address !== DEFAULT_CONFIG.vrchat_settings.osc_address || v.osc_port !== DEFAULT_CONFIG.vrchat_settings.osc_port;

  return (
    <FormGroup className="flex flex-col gap-3">
      <FormControlLabel control={<Checkbox checked={v.enable_chatbox} onChange={(e) => set({ enable_chatbox: e.target.checked })} />} label="Send to VRChat chatbox" />
      <FormControlLabel control={<Checkbox checked={v.send_typing_status_while_talking} onChange={(e) => set({ send_typing_status_while_talking: e.target.checked })} />} label={localization.send_typing_while_talking[lang]} />
      <FormControlLabel control={<Checkbox checked={v.disable_kikitan_when_muted} onChange={(e) => set({ disable_kikitan_when_muted: e.target.checked })} />} label={localization.disable_kikitan_when_muted[lang]} />

      <div>
        <Typography variant="body2" className="mb-1">{localization.chatbox_update_speed[lang]}</Typography>
        <Select size="small" value={v.chatbox_update_speed} onChange={(e) => set({ chatbox_update_speed: parseInt(e.target.value.toString()) })}>
          <MenuItem value={speed_presets.slow}>{localization.slow[lang]}</MenuItem>
          <MenuItem value={speed_presets.medium}>{localization.medium[lang]}</MenuItem>
          <MenuItem value={speed_presets.fast}>{localization.fast[lang]}</MenuItem>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <TextField label={localization.osc_address[lang]} size="small" value={v.osc_address} onChange={(e) => set({ osc_address: e.target.value })} />
        <TextField label={localization.osc_port[lang]} size="small" type="number" value={v.osc_port} onChange={(e) => set({ osc_port: parseInt(e.target.value) })} />
        {oscModified && <IconButton onClick={resetOsc}><History /></IconButton>}
      </div>
    </FormGroup>
  );
}
