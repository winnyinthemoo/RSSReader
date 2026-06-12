import { useMemo } from "react";

import type { TranslationView } from "../../../../../shared/ai";
import { buildBilingualArticleHtml } from "../utils/buildBilingualArticleHtml";

interface BilingualTranslationViewProps {
  articleHtml: string;
  translation?: TranslationView;
  isLoading?: boolean;
  errorMessage?: string;
  showEmptyMessage?: boolean;
  isSelection?: boolean;
}

export function BilingualTranslationView({
  articleHtml,
  translation,
  isLoading,
  errorMessage,
  showEmptyMessage = true,
  isSelection = false,
}: BilingualTranslationViewProps) {
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
          {formatTranslationError(errorMessage)}
        </p>
      ) : null}
      {isLoading ? (
        <p className="bilingual-status muted">
          {isSelection
            ? "Translating selected text..."
            : "Translating article by segment (may take a few minutes)..."}
        </p>
      ) : null}
      {!translation && !isLoading && showEmptyMessage ? (
        <p className="bilingual-status muted">No translation yet.</p>
      ) : null}
      {built.placed < built.expected ? (
        <p className="bilingual-align-warning" role="status">
          Some segments could not be aligned with the article layout (
          {built.placed}/{built.expected} placed).
        </p>
      ) : null}
      <div
        className="reader-content bilingual-content"
        dangerouslySetInnerHTML={{ __html: built.html }}
      />
    </div>
  );
}

function formatTranslationError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("model") &&
    (normalized.includes("not configured") ||
      normalized.includes("not set") ||
      normalized.includes("missing"))
  ) {
    return "Translation model is not configured. Please set a model in Settings > Agents. Showing original content.";
  }
  return `Translation failed: ${message}. Showing original content.`;
}
