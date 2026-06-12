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

export {
  targetLanguageLabel as translationLanguageLabel,
  targetLanguageOptions as translationLanguageOptions,
} from "../../constants/targetLanguages";
