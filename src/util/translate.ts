import { Config } from "./config";
import translateGT from "../translators/google_translate";
import translateEdge from "../translators/edge_translate";
import translateGroq from "../translators/groq_translate";

export async function performTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    config: Config,
    showNotification: ((message: string, severity: "success" | "error" | "warning" | "info") => void) | null,
    setConfig: ((config: Config) => void) | null
): Promise<string> {
    if (!text) return "";

    let result: string | undefined;
    switch (config.translator_settings.translation_service) {
        case 1:
            result = await translateEdge(text, sourceLang, targetLang, showNotification);
            break;
        case 2:
            result = await translateGroq(text, sourceLang, targetLang, showNotification, setConfig);
            break;
        default: // 0 = Google Translate
            result = await translateGT(text, sourceLang, targetLang, showNotification);
    }

    return result ?? "";
}
