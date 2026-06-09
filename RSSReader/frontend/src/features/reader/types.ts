import type { ArticleTag } from "../../../../shared/feed";

export type ViewMode = "markdown" | "source" | "compare";
export type ThemeBg = "white" | "sepia" | "dark" | "green";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type ReaderPanel = "tag" | "note";
export type DetectedContentLanguage = "zh" | "en" | "unknown";
export type SelectionTranslationStatus =
  | "idle"
  | "ready"
  | "loading"
  | "result"
  | "skipped"
  | "error";

export interface SelectionTranslationState {
  selectedText: string;
  status: SelectionTranslationStatus;
  translatedText?: string;
  message?: string;
  errorMessage?: string;
}

export interface ReaderPanelState {
  activePanel?: ReaderPanel;
  tags: ArticleTag[];
  tagInput: string;
  tagStatus?: string;
  noteContent: string;
  noteStatus?: string;
}
