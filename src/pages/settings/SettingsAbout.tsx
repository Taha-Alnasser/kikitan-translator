import * as React from "react";
import { Button, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { TabProps } from "./types";

type Props = TabProps & { closeCallback: () => void };

export default function SettingsAbout(_: Props) {
  const [version, setVersion] = React.useState("");
  React.useEffect(() => { getVersion().then(setVersion); }, []);
  return (
    <div className="flex flex-col gap-3">
      <Typography variant="h6">Kikitan Translator</Typography>
      <Typography variant="body2">Version {version}</Typography>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outlined" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}>GitHub</Button>
        <Button variant="outlined" onClick={() => open("https://discord.gg/jpkYCgpBGV")}>Discord</Button>
        <Button variant="outlined" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}>Buy Me a Coffee</Button>
        <Button variant="outlined" onClick={() => open("https://booth.pm/en/items/6073050")}>Booth.pm</Button>
      </div>
    </div>
  );
}
