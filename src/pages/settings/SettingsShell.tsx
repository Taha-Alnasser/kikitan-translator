import * as React from "react";
import { Tabs, Tab, Box } from "@mui/material";
import { TabId, TabProps } from "./types";
import SettingsAudio from "./SettingsAudio";
import SettingsTranslation from "./SettingsTranslation";
import SettingsVRChat from "./SettingsVRChat";
import SettingsOverlays from "./SettingsOverlays";
import SettingsHistory from "./SettingsHistory";
import SettingsAdvanced from "./SettingsAdvanced";
import SettingsAbout from "./SettingsAbout";

const TAB_ORDER: TabId[] = ["audio", "translation", "vrchat", "overlays", "history", "advanced", "about"];
const TAB_LABEL: Record<TabId, string> = {
  audio: "Audio",
  translation: "Translation",
  vrchat: "VRChat",
  overlays: "Overlays",
  history: "History",
  advanced: "Advanced",
  about: "About",
};

type Props = TabProps & {
  initialTab?: TabId;
  closeCallback: () => void;
};

export default function SettingsShell({ initialTab = "audio", closeCallback, ...tabProps }: Props) {
  const [active, setActive] = React.useState<TabId>(initialTab);
  React.useEffect(() => { setActive(initialTab); }, [initialTab]);

  return (
    <Box className="flex flex-col h-full">
      <Box sx={{ borderBottom: 1, borderColor: "divider" }} className="px-2">
        <Tabs value={TAB_ORDER.indexOf(active)} onChange={(_, v) => setActive(TAB_ORDER[v])} variant="scrollable" scrollButtons="auto">
          {TAB_ORDER.map((id) => <Tab key={id} label={TAB_LABEL[id]} />)}
        </Tabs>
      </Box>
      <Box className="flex-1 overflow-auto p-4">
        {active === "audio" && <SettingsAudio {...tabProps} />}
        {active === "translation" && <SettingsTranslation {...tabProps} />}
        {active === "vrchat" && <SettingsVRChat {...tabProps} />}
        {active === "overlays" && <SettingsOverlays {...tabProps} />}
        {active === "history" && <SettingsHistory {...tabProps} />}
        {active === "advanced" && <SettingsAdvanced {...tabProps} />}
        {active === "about" && <SettingsAbout {...tabProps} closeCallback={closeCallback} />}
      </Box>
    </Box>
  );
}
