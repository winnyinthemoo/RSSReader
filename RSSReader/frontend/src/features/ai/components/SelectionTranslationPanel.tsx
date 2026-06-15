import { Languages } from "lucide-react";

import { getAppText } from "../../../i18n";
import type { AppLanguage } from "../../../i18n";

type SelectionTranslationStatus = "idle" | "ready" | "loading" | "result" | "skipped" | "error";

interface SelectionTranslationPanelState {
  selectedText: string;
  status: SelectionTranslationStatus;
  translatedText?: string;
  message?: string;
  errorMessage?: string;
}

interface SelectionTranslationPanelProps {
  appLanguage: AppLanguage;
  disabled?: boolean;
  selectionTranslation: SelectionTranslationPanelState;
  translationTargetLanguage?: string;
  onTranslateSelection?: () => void;
}

export function SelectionTranslationPanel({
  appLanguage,
  disabled,
  selectionTranslation,
  translationTargetLanguage = "zh-Hans",
  onTranslateSelection,
}: SelectionTranslationPanelProps) {
  const text = getAppText(appLanguage);
  const translationText = text.reader.translationUi;
  const hasSelection = Boolean(selectionTranslation.selectedText);

  if (!hasSelection) {
    return null;
  }

  return (
    <aside className="selection-translation-topbar" aria-label={translationText.selectedTextAria}>
      <header className="selection-translation-topbar-header">
        <div className="selection-translation-title">
          <span className="selection-translation-icon" aria-hidden="true">
            <Languages size={15} />
          </span>
          <div>
            <strong>{translationText.title}</strong>
            <span>{translationLanguageLabel(translationTargetLanguage, appLanguage)}</span>
          </div>
        </div>
        {selectionTranslation.status === "ready" ? (
          <button
            className="secondary-button selection-translation-action"
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onTranslateSelection}
          >
            <Languages size={15} />
            {translationText.translate}
          </button>
        ) : null}
      </header>

      <blockquote>{selectionTranslation.selectedText}</blockquote>
      {selectionTranslation.message ? (
        <p className="selection-translation-note">{selectionTranslation.message}</p>
      ) : null}
      {selectionTranslation.status === "loading" ? (
        <p className="selection-translation-muted">
          {translationText.translatingSelected}
        </p>
      ) : null}
      {selectionTranslation.status === "result" ? (
        <p className="selection-translation-result">
          {selectionTranslation.translatedText}
        </p>
      ) : null}
      {selectionTranslation.status === "error" ? (
        <p className="selection-translation-error">
          {selectionTranslation.errorMessage ?? translationText.failedShort}
        </p>
      ) : null}
    </aside>
  );
}

function translationLanguageLabel(value: string, appLanguage: AppLanguage) {
  if (value === "zh-Hans") {
    return appLanguage === "zh-Hans" ? "简体中文" : "Simplified Chinese";
  }
  if (value === "zh-Hant") {
    return appLanguage === "zh-Hans" ? "繁體中文" : "Traditional Chinese";
  }
  if (value === "en") {
    return "English";
  }
  return value;
}
