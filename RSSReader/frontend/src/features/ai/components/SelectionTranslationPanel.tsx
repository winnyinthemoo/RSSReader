import { Languages } from "lucide-react";

type SelectionTranslationStatus = "idle" | "ready" | "loading" | "result" | "skipped" | "error";

interface SelectionTranslationPanelState {
  selectedText: string;
  status: SelectionTranslationStatus;
  translatedText?: string;
  message?: string;
  errorMessage?: string;
}

interface SelectionTranslationPanelProps {
  disabled?: boolean;
  selectionTranslation: SelectionTranslationPanelState;
  translationTargetLanguage?: string;
  onTranslateSelection?: () => void;
}

export function SelectionTranslationPanel({
  disabled,
  selectionTranslation,
  translationTargetLanguage = "zh-Hans",
  onTranslateSelection,
}: SelectionTranslationPanelProps) {
  const hasSelection = Boolean(selectionTranslation.selectedText);

  if (!hasSelection) {
    return null;
  }

  return (
    <aside className="selection-translation-topbar" aria-label="Selected text translation">
      <header className="selection-translation-topbar-header">
        <div className="selection-translation-title">
          <span className="selection-translation-icon" aria-hidden="true">
            <Languages size={15} />
          </span>
          <div>
            <strong>Translation</strong>
            <span>{translationLanguageLabel(translationTargetLanguage)}</span>
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
            Translate
          </button>
        ) : null}
      </header>

      <blockquote>{selectionTranslation.selectedText}</blockquote>
      {selectionTranslation.message ? (
        <p className="selection-translation-note">{selectionTranslation.message}</p>
      ) : null}
      {selectionTranslation.status === "loading" ? (
        <p className="selection-translation-muted">
          {selectionLoadingLabel(translationTargetLanguage)}
        </p>
      ) : null}
      {selectionTranslation.status === "result" ? (
        <p className="selection-translation-result">
          {selectionTranslation.translatedText}
        </p>
      ) : null}
      {selectionTranslation.status === "error" ? (
        <p className="selection-translation-error">
          {selectionTranslation.errorMessage ?? "Translation failed."}
        </p>
      ) : null}
    </aside>
  );
}

function translationLanguageLabel(value: string) {
  if (value === "zh-Hans") {
    return "简体中文";
  }
  if (value === "zh-Hant") {
    return "繁體中文";
  }
  if (value === "en") {
    return "English";
  }
  return value;
}

function selectionLoadingLabel(targetLanguage: string) {
  if (targetLanguage === "zh-Hans" || targetLanguage === "zh-Hant") {
    return "正在翻译选中文本...";
  }
  return "Translating selected text...";
}
