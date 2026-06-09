import type { MouseEvent, RefObject } from "react";
import { RefreshCw } from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";
import type { FontSize, ThemeBg } from "../types";
import { MarkdownArticle } from "./MarkdownArticle";
import { OriginalPageFallback } from "./OriginalPageFallback";
import { ReaderHeader } from "./ReaderHeader";

interface CompareViewProps {
  article: ArticleDetail;
  markdown: string;
  themeBg: ThemeBg;
  fontSize: FontSize;
  splitRatio: number;
  isDragging: boolean;
  compareRef: RefObject<HTMLDivElement | null>;
  compareIframeError: boolean;
  compareUseRender: boolean;
  renderUrl: string;
  searchMatches?: Array<{ start: number; end: number }>;
  activeSearchIndex?: number;
  onDividerMouseDown: (event: MouseEvent) => void;
  onToggleProxy: () => void;
  onRetryProxy: () => void;
  onIframeLoad: () => void;
}

export function CompareView({
  article,
  markdown,
  themeBg,
  fontSize,
  splitRatio,
  isDragging,
  compareRef,
  compareIframeError,
  compareUseRender,
  renderUrl,
  searchMatches = [],
  activeSearchIndex = 0,
  onDividerMouseDown,
  onToggleProxy,
  onRetryProxy,
  onIframeLoad,
}: CompareViewProps) {
  return (
    <div className={`reader-compare${isDragging ? " dragging" : ""}`} ref={compareRef}>
      <div className="compare-pane" style={{ width: `${splitRatio}%` }}>
        <div className="compare-pane-label">Readable Markdown</div>
        <div className="compare-pane-content" data-theme={themeBg} data-font-size={fontSize}>
          <ReaderHeader article={article} variant="compact" />
          <MarkdownArticle
            markdown={markdown}
            variant="compare"
            searchMatches={searchMatches}
            activeSearchIndex={activeSearchIndex}
          />
        </div>
      </div>
      <div className="compare-divider" onMouseDown={onDividerMouseDown}>
        <div className="compare-divider-handle" />
      </div>
      <div className="compare-pane" style={{ width: `${100 - splitRatio}%` }}>
        <div className="compare-pane-label">Original page</div>
        <button
          className="reader-proxy-toggle"
          type="button"
          title="Toggle proxy"
          onClick={onToggleProxy}
        >
          <RefreshCw size={18} />
        </button>
        {compareIframeError ? (
          <OriginalPageFallback url={article.url} onRetryProxy={onRetryProxy} />
        ) : (
          <iframe
            className="reader-iframe"
            src={compareUseRender ? renderUrl : article.url}
            title="Original article page"
            onLoad={onIframeLoad}
          />
        )}
      </div>
    </div>
  );
}
