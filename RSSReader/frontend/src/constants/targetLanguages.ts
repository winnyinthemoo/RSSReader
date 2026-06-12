export type TargetLanguageOption = {
  value: string;
  label: string;
};

// Labels use each language's own name (endonym) for dropdown display.
export const targetLanguageOptions: TargetLanguageOption[] = [
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "hi", label: "हिन्दी" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "th", label: "ไทย" },
  { value: "tr", label: "Türkçe" },
];

export function targetLanguageLabel(value: string) {
  return targetLanguageOptions.find((language) => language.value === value)?.label ?? value;
}
