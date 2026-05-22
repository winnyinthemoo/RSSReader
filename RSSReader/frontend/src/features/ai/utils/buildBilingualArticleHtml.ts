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
  let best: { start: number; end: number } | null = null;
  for (const tag of ["p", "ul", "ol"] as const) {
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

function countTranslatableBlocks(html: string): number {
  const lower = html.toLowerCase();
  let cursor = 0;
  let count = 0;
  while (true) {
    const block = findNextBlock(lower, cursor);
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

/** Mirrors backend `Segmenter` — insert translation after each p/ul/ol block. */
export function buildBilingualArticleHtml(
  articleHtml: string,
  segments: TranslationSegmentView[],
): BilingualArticleBuild {
  const ordered = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  if (ordered.length === 0) {
    return { html: articleHtml, aligned: true, expected: 0, placed: 0 };
  }

  const lower = articleHtml.toLowerCase();
  let cursor = 0;
  let segmentIndex = 0;
  let result = "";
  let placed = 0;

  while (segmentIndex < ordered.length) {
    const block = findNextBlock(lower, cursor);
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

  const blockCount = countTranslatableBlocks(articleHtml);
  return {
    html: result,
    aligned: blockCount === ordered.length && segmentIndex === ordered.length,
    expected: ordered.length,
    placed,
  };
}
