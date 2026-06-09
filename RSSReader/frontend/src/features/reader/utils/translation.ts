import type { TranslationView } from "../../../../../shared/ai";
import { displayTranslationText } from "../../ai/utils/buildBilingualArticleHtml";
import { translationLanguageLabel } from "../options";
import type { DetectedContentLanguage } from "../types";

export function selectionTranslationText(view: TranslationView) {
  const segment = view.segments[0] as (TranslationView["segments"][number] & {
    translated_text?: string;
  }) | undefined;
  return displayTranslationText(segment?.translatedText ?? segment?.translated_text ?? "");
}

export function detectContentLanguage(text: string): DetectedContentLanguage {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (sample.length < 12) {
    return "unknown";
  }

  const chineseCount = (sample.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (sample.match(/[a-zA-Z]/g) ?? []).length;
  const signalCount = chineseCount + latinCount;
  if (signalCount < 8) {
    return "unknown";
  }
  if (chineseCount >= 6 && chineseCount / signalCount >= 0.35) {
    return "zh";
  }
  if (latinCount >= 18 && latinCount / signalCount >= 0.7) {
    return "en";
  }
  return "unknown";
}

export function targetLanguageFamily(language: string): DetectedContentLanguage {
  if (language === "en") {
    return "en";
  }
  if (language === "zh-Hans" || language === "zh-Hant") {
    return "zh";
  }
  return "unknown";
}

export function isSameLanguageTarget(
  sourceLanguage: DetectedContentLanguage,
  targetLanguage: string,
) {
  return sourceLanguage !== "unknown" && sourceLanguage === targetLanguageFamily(targetLanguage);
}

export function translationLanguageNotice(
  sourceLanguage: DetectedContentLanguage,
  targetLanguage: string,
  skippedSameLanguage: boolean,
) {
  if (sourceLanguage === "unknown") {
    return undefined;
  }

  const sourceLabel = sourceLanguage === "zh" ? "Chinese" : "English";
  const targetLabel = translationLanguageLabel(targetLanguage);
  if (skippedSameLanguage) {
    return `Detected ${sourceLabel} content. The selected target is also ${targetLabel}, so translation was skipped.`;
  }

  return `Detected ${sourceLabel} content. Translating to ${targetLabel}.`;
}
