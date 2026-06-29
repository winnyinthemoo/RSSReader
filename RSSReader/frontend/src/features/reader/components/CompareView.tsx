import type { MouseEvent, RefObject } from "react";
import { RefreshCw } from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import type { FontSize, ThemeBg } from "../types";
import { MarkdownArticle } from "./MarkdownArticle";
import { OriginalPageFallback } from "./OriginalPageFallback";
import { ReaderHeader } from "./ReaderHeader";

interface CompareViewProps {
  appLanguage: AppLanguage;
  article: ArticleDetail;
  markdown: string;
  themeBg: ThemeBg;
  fontSize: FontSize;
  splitRatio: number;
  isDragging: boolean;
  compareRef: RefObject<HTMLDivElement | null>;
  compareIframeError: boolean;
  compareErrorMessage?: string;
  compareProxyHtml?: string;
  compareProxyLoading?: boolean;
  compareUseRender: boolean;
  searchMatches?: Array<{ start: number; end: number }>;
  activeSearchIndex?: number;
  onDividerMouseDown: (event: MouseEvent) => void;
  onToggleProxy: () => void;
  onRetryProxy: () => void;
  onIframeLoad: (iframe: HTMLIFrameElement) => void;
}

export function CompareView({
  appLanguage,
  article,
  markdown,
  themeBg,
  fontSize,
  splitRatio,
  isDragging,
  compareRef,
  compareIframeError,
  compareErrorMessage,
  compareProxyHtml,
  compareProxyLoading = false,
  compareUseRender,
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
          <ReaderHeader appLanguage={appLanguage} article={article} variant="compact" />
          <MarkdownArticle
            markdown={markdown}
            variant="compare"
            searchMatches={searchMatches}
            activeSearchIndex={activeSearchIndex}
            baseUrl={article.url}
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
          <OriginalPageFallback url={article.url} message={compareErrorMessage} onRetryProxy={onRetryProxy} />
        ) : compareUseRender && (compareProxyLoading || !compareProxyHtml) ? (
          <div className="reader-iframe-fallback" aria-live="polite">
            <div className="fallback-header">
              <p className="eyebrow">Loading original page proxy</p>
              <p className="fallback-desc">Fetching the page through Vortex so it can render in app.</p>
            </div>
          </div>
        ) : compareUseRender && compareProxyHtml ? (
          <iframe
            className="reader-iframe"
            srcDoc={compareProxyHtml}
            title="Original article page"
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={(event) => onIframeLoad(event.currentTarget)}
          />
        ) : (
          <iframe
            className="reader-iframe"
            src={article.url}
            title="Original article page"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={(event) => onIframeLoad(event.currentTarget)}
          />
        )}
      </div>
    </div>
  );
}
