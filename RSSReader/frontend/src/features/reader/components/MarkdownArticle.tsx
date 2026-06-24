import { useEffect, useMemo, useRef } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface MarkdownArticleProps {
  markdown: string;
  variant?: "default" | "compare";
  activeSearchIndex?: number;
  searchMatches?: Array<{ start: number; end: number }>;
  baseUrl?: string;
  onOpenLink?: (url: string) => void;
}

function buildMarkdownComponents(onOpenLink?: (url: string) => void, baseUrl?: string): Components {
  return {
    a({ node: _node, href, children, ...props }) {
      const resolvedUrl = resolveReaderUrl(href, baseUrl);
      const canOpenInReader = Boolean(onOpenLink && resolvedUrl && isWebUrl(resolvedUrl));
      const shouldOpenOutsideApp = Boolean(href && !href.startsWith("#") && !canOpenInReader);
      return (
        <a
          {...props}
          href={href}
          target={shouldOpenOutsideApp ? "_blank" : undefined}
          rel={shouldOpenOutsideApp ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!canOpenInReader || !resolvedUrl) {
              return;
            }
            event.preventDefault();
            onOpenLink?.(resolvedUrl);
          }}
        >
          {children}
        </a>
      );
    },
  };
}

export function MarkdownArticle({
  markdown,
  variant = "default",
  activeSearchIndex = 0,
  searchMatches = [],
  baseUrl,
  onOpenLink,
}: MarkdownArticleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const markdownComponents = useMemo(
    () => buildMarkdownComponents(onOpenLink, baseUrl),
    [baseUrl, onOpenLink],
  );
  const displayedMarkdown = useMemo(
    () => highlightMarkdown(markdown, searchMatches, activeSearchIndex),
    [markdown, searchMatches, activeSearchIndex],
  );

  useEffect(() => {
    if (searchMatches.length === 0) {
      return;
    }

    const activeHit = contentRef.current?.querySelector<HTMLElement>(
      ".reader-search-hit.active",
    );
    activeHit?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [activeSearchIndex, searchMatches]);

  return (
    <div
      ref={contentRef}
      className={`reader-content reader-content-md${
        variant === "compare" ? " compare-markdown-content" : ""
      }`}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {displayedMarkdown}
      </Markdown>
    </div>
  );
}

function resolveReaderUrl(href: string | undefined, baseUrl: string | undefined) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return undefined;
  }

  try {
    return new URL(href, baseUrl || window.location.href).toString();
  } catch {
    return href;
  }
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function highlightMarkdown(
  markdown: string,
  matches: Array<{ start: number; end: number }>,
  activeIndex: number,
) {
  if (matches.length === 0) {
    return markdown;
  }

  let output = "";
  let cursor = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    output += markdown.slice(cursor, match.start);
    const text = markdown.slice(match.start, match.end);
    const className = index === activeIndex ? "reader-search-hit active" : "reader-search-hit";
    output += `<mark class="${className}">${escapeHtml(text)}</mark>`;
    cursor = match.end;
  }
  output += markdown.slice(cursor);
  return output;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
