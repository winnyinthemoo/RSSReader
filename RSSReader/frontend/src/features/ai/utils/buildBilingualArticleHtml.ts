import type { TranslationSegmentView } from "../../../../../shared/ai";

function readTranslatedText(segment: TranslationSegmentView): string {
  const legacy = segment as TranslationSegmentView & { translated_text?: string };
  return (legacy.translatedText ?? legacy.translated_text ?? "").trim();
}

/** Legacy DB rows may still contain HTML/URLs from before plain-text translation. */
export function displayTranslationText(raw: string): string {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = raw;
  let plain = (wrapper.textContent ?? raw).trim();
  plain = plain.replace(/https?:\/\/\S+/gi, "");
  return plain.replace(/\s+/g, " ").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findTagBlock(
  lower: string,
  tag: string,
  from: number,
): { start: number; end: number } | null {
  const openNeedle = `<${tag}`;
  const closeNeedle = `</${tag}>`;
  const openIndex = lower.indexOf(openNeedle, from);
  if (openIndex === -1) {
    return null;
  }
  const openEnd = lower.indexOf(">", openIndex);
  if (openEnd === -1) {
    return null;
  }
  const closeIndex = lower.indexOf(closeNeedle, openEnd + 1);
  if (closeIndex === -1) {
    return null;
  }
  return { start: openIndex, end: closeIndex + closeNeedle.length };
}

function findNextBlock(lower: string, from: number): { start: number; end: number } | null {
  return findNextTaggedBlock(lower, from, ["p", "ul", "ol"]);
}

function findNextFallbackBlock(lower: string, from: number): { start: number; end: number } | null {
  return findNextTaggedBlock(lower, from, [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "article",
    "section",
    "div",
    "li",
  ]);
}

function findNextTaggedBlock(lower: string, from: number, tags: readonly string[]): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  for (const tag of tags) {
    const block = findTagBlock(lower, tag, from);
    if (!block) {
      continue;
    }
    if (!best || block.start < best.start) {
      best = block;
    }
  }
  return best;
}

function hasVisibleText(html: string): boolean {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return Boolean((wrapper.textContent ?? html).trim());
}

function countTranslatableBlocks(html: string): number {
  if (!hasVisibleText(html)) {
    return 0;
  }

  const lower = html.toLowerCase();
  const primary = countBlocks(lower, findNextBlock);
  if (primary > 0) {
    return primary;
  }

  const fallback = countBlocks(lower, findNextFallbackBlock);
  return fallback > 0 ? fallback : 1;
}

function countBlocks(
  lower: string,
  finder: (lower: string, from: number) => { start: number; end: number } | null,
): number {
  let cursor = 0;
  let count = 0;
  while (true) {
    const block = finder(lower, cursor);
    if (!block) {
      break;
    }
    count += 1;
    cursor = block.end;
  }
  return count;
}

export type BilingualArticleBuild = {
  html: string;
  aligned: boolean;
  expected: number;
  placed: number;
};

/** Mirrors backend `Segmenter` — prefer p/ul/ol, with a fallback for sparse RSS HTML. */
export function buildBilingualArticleHtml(
  articleHtml: string,
  segments: TranslationSegmentView[],
): BilingualArticleBuild {
  const ordered = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  if (ordered.length === 0) {
    return { html: articleHtml, aligned: true, expected: 0, placed: 0 };
  }

  const lower = articleHtml.toLowerCase();
  const blockCount = countTranslatableBlocks(articleHtml);
  const finder = countBlocks(lower, findNextBlock) > 0 ? findNextBlock : findNextFallbackBlock;
  let cursor = 0;
  let segmentIndex = 0;
  let result = "";
  let placed = 0;

  while (segmentIndex < ordered.length) {
    const block = finder(lower, cursor);
    if (!block) {
      break;
    }

    result += articleHtml.slice(cursor, block.end);
    const segment = ordered[segmentIndex];
    const displayText = displayTranslationText(readTranslatedText(segment));
    if (displayText) {
      result += `<div class="translation-block" data-segment-index="${segment.segmentIndex}">${escapeHtml(displayText)}</div>`;
      placed += 1;
    }

    cursor = block.end;
    segmentIndex += 1;
  }

  result += articleHtml.slice(cursor);

  if (segmentIndex === 0 && blockCount === 1 && hasVisibleText(articleHtml)) {
    const segment = ordered[0];
    const displayText = displayTranslationText(readTranslatedText(segment));
    if (displayText) {
      result += `<div class="translation-block" data-segment-index="${segment.segmentIndex}">${escapeHtml(displayText)}</div>`;
      placed = 1;
    }
    segmentIndex = 1;
  }

  return {
    html: result,
    aligned: blockCount === ordered.length && segmentIndex === ordered.length,
    expected: ordered.length,
    placed,
  };
}
