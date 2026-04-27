import { TabProps } from "./types";
import { FormControlLabel, FormGroup, Checkbox, Button } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import { appLogDir } from "@tauri-apps/api/path";
import { localization } from "../../util/localization";
import * as recognizers from "../../util/recognizers";

export default function SettingsAdvanced({ config, setConfig, lang }: TabProps) {
  return (
    <FormGroup className="flex flex-col gap-3">
      <FormControlLabel control={<Checkbox checked={config.translator_settings.desktop_translation}
        onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, desktop_translation: e.target.checked } })} />}
        label={localization.enable_desktop_capture[lang]} />
      <FormControlLabel control={<Checkbox checked={config.data_out.enable_user_data}
        onChange={(e) => setConfig({ ...config, data_out: { ...config.data_out, enable_user_data: e.target.checked } })} />}
        label={localization.enable_user_data[lang]} />
      <FormControlLabel control={<Checkbox checked={config.data_out.enable_desktop_data}
        onChange={(e) => setConfig({ ...config, data_out: { ...config.data_out, enable_desktop_data: e.target.checked } })} />}
        label={localization.enable_desktop_data[lang]} />
      <Button variant="outlined" onClick={async () => open(await appLogDir())}>{localization.open_logs[lang]}</Button>
      <Button variant="outlined" onClick={() => recognizers.simulate("chatbox", "Hello world", "こんにちは世界", true)}>
        Simulate chatbox phrase (dev)
      </Button>
    </FormGroup>
  );
}
