import { Config } from "../../util/config";
import { Lang } from "../../util/constants";

export type TabId = "audio" | "translation" | "vrchat" | "overlays" | "history" | "advanced" | "about";

export type TabProps = {
  config: Config;
  setConfig: (config: Config) => void;
  lang: Lang;
};
