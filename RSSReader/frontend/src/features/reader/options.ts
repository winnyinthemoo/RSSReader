import type { FontSize, ThemeBg } from "./types";

export const themeBgOptions: { key: ThemeBg; label: string; color: string; text: string }[] = [
  { key: "white", label: "White", color: "#fcfdfb", text: "#2f312d" },
  { key: "sepia", label: "Sepia", color: "#f4f0e6", text: "#3a3226" },
  { key: "dark", label: "Dark", color: "#1e201d", text: "#d5ddd4" },
  { key: "green", label: "Green", color: "#eef5f0", text: "#2f312d" },
];

export const fontSizeOptions: { key: FontSize; label: string; value: string }[] = [
  { key: "sm", label: "S", value: "0.9rem" },
  { key: "md", label: "M", value: "1.05rem" },
  { key: "lg", label: "L", value: "1.2rem" },
  { key: "xl", label: "XL", value: "1.35rem" },
];

export const translationLanguageOptions = [
  { value: "zh-Hans", label: "Simplified Chinese" },
  { value: "zh-Hant", label: "Traditional Chinese" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "id", label: "Indonesian" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "tr", label: "Turkish" },
];

export function translationLanguageLabel(value: string) {
  return translationLanguageOptions.find((language) => language.value === value)?.label ?? value;
}
