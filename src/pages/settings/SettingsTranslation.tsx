import { TabProps } from "./types";
import { Select, MenuItem, TextField, Button, FormGroup, FormControlLabel, Checkbox, LinearProgress, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import { localization } from "../../util/localization";
import { DAILY_TOKEN_LIMIT } from "../../util/constants";

export default function SettingsTranslation({ config, setConfig, lang }: TabProps) {
  const groqRequired = config.translator_settings.translation_service === 2 || config.translator_settings.recognition_service === 1;
  return (
    <FormGroup className="flex flex-col gap-4">
      <div>
        <Typography variant="body2" className="mb-1">{localization.translation_service[lang]}</Typography>
        <Select fullWidth size="small" value={config.translator_settings.translation_service}
          onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, translation_service: parseInt(e.target.value.toString()) } })}>
          <MenuItem value={0}>Google Translate ({localization.default[lang]})</MenuItem>
          <MenuItem value={1}>Microsoft Bing</MenuItem>
          <MenuItem value={2}>Groq Llama3.3-70b ({localization.recommended[lang]})</MenuItem>
        </Select>
      </div>

      <FormControlLabel control={<Checkbox checked={config.vrchat_settings.translation_first}
        onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, translation_first: e.target.checked } })} />}
        label={localization.translation_first[lang]} />

      <FormControlLabel control={<Checkbox checked={config.vrchat_settings.only_translation}
        onChange={(e) => setConfig({ ...config, vrchat_settings: { ...config.vrchat_settings, only_translation: e.target.checked } })} />}
        label={localization.only_send_translation[lang]} />

      <div>
        <Typography variant="body2" className="mb-1">Groq {localization.api_key[lang]}</Typography>
        <div className="flex gap-2">
          <TextField fullWidth size="small" type="password"
            disabled={!groqRequired}
            value={config.groq.api_key}
            color={config.groq.api_key.length === 0 ? "warning" : "primary"}
            onChange={(e) => setConfig({ ...config, groq: { ...config.groq, api_key: e.target.value.trim() } })} />
          <Button variant="contained" disabled={!groqRequired} onClick={() => open("https://console.groq.com/keys")}>
            {localization.get_api_key[lang]}
          </Button>
        </div>
      </div>

      <div>
        <Typography variant="body2">{localization.groq_token_usage[lang]}: {config.groq.used_tokens}/{DAILY_TOKEN_LIMIT}</Typography>
        <LinearProgress variant="determinate" className="mt-1" value={(config.groq.used_tokens / DAILY_TOKEN_LIMIT) * 100} />
      </div>
    </FormGroup>
  );
}
