import { useMemo } from "react";

import type { TranslationView } from "../../../../../shared/ai";
import { getAppText } from "../../../i18n";
import type { AppLanguage } from "../../../i18n";
import { buildBilingualArticleHtml } from "../utils/buildBilingualArticleHtml";

interface BilingualTranslationViewProps {
  appLanguage: AppLanguage;
  articleHtml: string;
  translation?: TranslationView;
  isLoading?: boolean;
  errorMessage?: string;
  showEmptyMessage?: boolean;
  isSelection?: boolean;
}

export function BilingualTranslationView({
  appLanguage,
  articleHtml,
  translation,
  isLoading,
  errorMessage,
  showEmptyMessage = true,
  isSelection = false,
}: BilingualTranslationViewProps) {
  const text = getAppText(appLanguage);
  const translationText = text.reader.translationUi;
  const built = useMemo(() => {
    if (translation?.bilingualHtml) {
      return {
        html: translation.bilingualHtml,
        aligned: translation.bilingualAligned,
        expected: translation.bilingualExpected,
        placed: translation.bilingualPlaced,
      };
    }

    if (!translation?.segments.length) {
      return {
        html: articleHtml,
        aligned: true,
        expected: 0,
        placed: 0,
      };
    }
    return buildBilingualArticleHtml(articleHtml, translation.segments);
  }, [articleHtml, translation]);

  return (
    <div className="bilingual-translation">
      {translation?.translatedTitle ? (
        <header className="bilingual-title">
          <p>{translation.translatedTitle}</p>
        </header>
      ) : null}
      {errorMessage ? (
        <p className="summary-error" role="status">
          {formatTranslationError(errorMessage, appLanguage)}
        </p>
      ) : null}
      {isLoading ? (
        <p className="bilingual-status muted">
          {isSelection
            ? translationText.translatingSelected
            : translationText.translatingArticle}
        </p>
      ) : null}
      {!translation && !isLoading && showEmptyMessage ? (
        <p className="bilingual-status muted">{translationText.empty}</p>
      ) : null}
      {built.placed < built.expected ? (
        <p className="bilingual-align-warning" role="status">
          {translationText.alignWarning(built.placed, built.expected)}
        </p>
      ) : null}
      <div
        className="reader-content reader-content-md bilingual-content"
        dangerouslySetInnerHTML={{ __html: built.html }}
      />
    </div>
  );
}

function formatTranslationError(message: string, appLanguage: AppLanguage) {
  const text = getAppText(appLanguage).reader.translationUi;
  const normalized = message.toLowerCase();
  if (
    normalized.includes("model") &&
    (normalized.includes("not configured") ||
      normalized.includes("not set") ||
      normalized.includes("missing"))
  ) {
    return text.missingModel;
  }
  return text.failed(message);
}
