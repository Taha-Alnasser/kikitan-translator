import * as React from "react";
import { Select, MenuItem, Typography, FormGroup } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { TabProps } from "./types";
import { localization } from "../../util/localization";

export default function SettingsAudio({ config, setConfig, lang }: TabProps) {
  const [mics, setMics] = React.useState<{ name: string; sample_rate: number }[]>([]);

  React.useEffect(() => {
    invoke<{ name: string; sample_rate: number }[]>("get_microphone_list").then(setMics);
  }, []);

  return (
    <FormGroup className="flex flex-col gap-4">
      <div>
        <Typography variant="body2" className="mb-1">Microphone</Typography>
        <Select fullWidth size="small" value={config.microphone}
          onChange={(e) => setConfig({ ...config, microphone: e.target.value as string })}>
          {mics.map((m) => <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>)}
        </Select>
      </div>
      <div>
        <Typography variant="body2" className="mb-1">{localization.recognition_service[lang]}</Typography>
        <Select fullWidth size="small" value={config.translator_settings.recognition_service}
          onChange={(e) => setConfig({ ...config, translator_settings: { ...config.translator_settings, recognition_service: parseInt(e.target.value.toString()) } })}>
          <MenuItem value={0}>Microsoft Bing ({localization.default[lang]})</MenuItem>
          <MenuItem value={1}>Groq Whisper-Large-V3 ({localization.requires_free_api_key[lang]})</MenuItem>
          <MenuItem value={2}>WebSpeech ({localization.legacy_not_recommended[lang]})</MenuItem>
        </Select>
      </div>
    </FormGroup>
  );
}
