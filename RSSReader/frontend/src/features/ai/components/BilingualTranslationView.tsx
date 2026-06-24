import { useMemo } from "react";
import type { MouseEvent } from "react";

import type { TranslationSegmentView, TranslationView } from "../../../../../shared/ai";
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
  retryingSegmentIndexes?: Set<number>;
  onRetrySegment?: (segmentIndex: number) => void;
}

export function BilingualTranslationView({
  appLanguage,
  articleHtml,
  translation,
  isLoading,
  errorMessage,
  showEmptyMessage = true,
  isSelection = false,
  retryingSegmentIndexes,
  onRetrySegment,
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

  const htmlWithRetryControls = useMemo(
    () =>
      addRetryControls(
        built.html,
        translation?.segments ?? [],
        retryingSegmentIndexes,
        appLanguage,
        Boolean(onRetrySegment),
      ),
    [appLanguage, built.html, onRetrySegment, retryingSegmentIndexes, translation?.segments],
  );

  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    if (!onRetrySegment || !(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>("[data-retry-segment-index]");
    if (!button || button.disabled) {
      return;
    }
    const segmentIndex = Number(button.dataset.retrySegmentIndex);
    if (Number.isFinite(segmentIndex)) {
      onRetrySegment(segmentIndex);
    }
  }

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
        dangerouslySetInnerHTML={{ __html: htmlWithRetryControls }}
        onClick={handleContentClick}
      />
    </div>
  );
}

function addRetryControls(
  html: string,
  segments: TranslationSegmentView[],
  retryingSegmentIndexes: Set<number> | undefined,
  appLanguage: AppLanguage,
  canRetry: boolean,
) {
  if (!canRetry || segments.every((segment) => segment.status !== "failed")) {
    return html;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const labels = retryLabels(appLanguage);

  for (const segment of segments) {
    if (segment.status !== "failed") {
      continue;
    }

    const isRetrying = retryingSegmentIndexes?.has(segment.segmentIndex) ?? false;
    const actions = document.createElement("div");
    actions.className = "translation-segment-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "translation-segment-retry";
    button.dataset.retrySegmentIndex = String(segment.segmentIndex);
    button.textContent = isRetrying ? labels.retrying : labels.retry;
    button.disabled = isRetrying;
    actions.append(button);

    const block = wrapper.querySelector(
      `.translation-block[data-segment-index="${segment.segmentIndex}"]`,
    );
    if (block) {
      block.insertAdjacentElement("afterend", actions);
    } else {
      wrapper.append(actions);
    }
  }

  return wrapper.innerHTML;
}

function retryLabels(appLanguage: AppLanguage) {
  if (appLanguage === "zh-Hans") {
    return {
      retry: "重试此段",
      retrying: "重试中...",
    };
  }
  return {
    retry: "Retry segment",
    retrying: "Retrying...",
  };
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