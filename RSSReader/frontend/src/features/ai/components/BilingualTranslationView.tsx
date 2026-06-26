import { useMemo } from "react";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

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
  searchQuery?: string;
  activeSearchIndex?: number;
  onSearchMatchCountChange?: (count: number) => void;
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
  searchQuery = "",
  activeSearchIndex = 0,
  onSearchMatchCountChange,
}: BilingualTranslationViewProps) {
  const text = getAppText(appLanguage);
  const translationText = text.reader.translationUi;
  const contentRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      onSearchMatchCountChange?.(0);
      return;
    }

    clearSearchHighlights(content);
    const hits = applySearchHighlights(content, searchQuery, activeSearchIndex);
    onSearchMatchCountChange?.(hits.length);

    if (hits.length > 0) {
      const activeHit = hits[Math.min(activeSearchIndex, hits.length - 1)];
      activeHit?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeSearchIndex, htmlWithRetryControls, onSearchMatchCountChange, searchQuery]);

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
        ref={contentRef}
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

function clearSearchHighlights(root: HTMLElement) {
  const highlights = Array.from(root.querySelectorAll("mark.reader-search-hit"));
  for (const highlight of highlights) {
    const parent = highlight.parentNode;
    if (!parent) {
      continue;
    }
    parent.replaceChild(document.createTextNode(highlight.textContent ?? ""), highlight);
    parent.normalize();
  }
}

function applySearchHighlights(root: HTMLElement, query: string, activeIndex: number) {
  const needle = query.trim();
  if (!needle) {
    return [];
  }

  const matcher = new RegExp(escapeRegExp(needle), "gi");
  const textNodes = collectSearchableTextNodes(root);
  const hits: HTMLElement[] = [];
  let matchIndex = 0;

  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    matcher.lastIndex = 0;
    let cursor = 0;
    let match = matcher.exec(text);
    if (!match) {
      continue;
    }

    const fragment = document.createDocumentFragment();
    while (match) {
      const start = match.index;
      const value = match[0];
      if (start > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, start)));
      }

      const highlight = document.createElement("mark");
      highlight.className =
        matchIndex === activeIndex ? "reader-search-hit active" : "reader-search-hit";
      highlight.textContent = value;
      fragment.append(highlight);
      hits.push(highlight);
      matchIndex += 1;
      cursor = start + value.length;

      if (value.length === 0) {
        matcher.lastIndex += 1;
      }
      match = matcher.exec(text);
    }

    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  return hits;
}

function collectSearchableTextNodes(root: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        !node.nodeValue?.trim() ||
        !parent ||
        parent.closest("button, input, textarea, select, script, style")
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
