import { useMemo } from "react";

import type { TranslationView } from "../../../../../shared/ai";
import { buildBilingualArticleHtml } from "../utils/buildBilingualArticleHtml";

interface BilingualTranslationViewProps {
  articleHtml: string;
  translation?: TranslationView;
  isLoading?: boolean;
  errorMessage?: string;
}

export function BilingualTranslationView({
  articleHtml,
  translation,
  isLoading,
  errorMessage,
}: BilingualTranslationViewProps) {
  const built = useMemo(() => {
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
      {errorMessage ? (
        <p className="summary-error" role="status">
          {formatTranslationError(errorMessage)}
        </p>
      ) : null}
      {isLoading ? (
        <p className="bilingual-status muted">
          Translating article by segment (may take a few minutes)…
        </p>
      ) : null}
      {translation ? (
        <p className="bilingual-status">
          Target: {translation.targetLanguage} · Status: {translation.status}
        </p>
      ) : !isLoading ? (
        <p className="bilingual-status muted">No translation yet.</p>
      ) : null}
      {!built.aligned && built.expected > 0 ? (
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
    return "Translation model is not configured. Please set a model in AI settings. Showing original content.";
  }
  return `Translation failed: ${message}. Showing original content.`;
}
