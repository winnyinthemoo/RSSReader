import { RefreshCw } from "lucide-react";

import { OriginalPageFallback } from "./OriginalPageFallback";

interface OriginalPageViewProps {
  url: string;
  iframeError: boolean;
  errorMessage?: string;
  isProxyLoading?: boolean;
  proxyHtml?: string;
  useRender: boolean;
  onToggleProxy: () => void;
  onRetryProxy: () => void;
  onLoad: (iframe: HTMLIFrameElement) => void;
}

export function OriginalPageView({
  url,
  iframeError,
  errorMessage,
  isProxyLoading = false,
  proxyHtml,
  useRender,
  onToggleProxy,
  onRetryProxy,
  onLoad,
}: OriginalPageViewProps) {
  const canShowDirectUrl = isWebUrl(url);
  const shouldShowFallback = iframeError || !canShowDirectUrl;
  const fallbackMessage = !canShowDirectUrl
    ? "This article does not expose a valid http(s) original page URL."
    : errorMessage;

  return (
    <div className="reader-web-view">
      <button
        className="reader-proxy-toggle"
        type="button"
        title="Toggle proxy"
        onClick={onToggleProxy}
      >
        <RefreshCw size={18} />
      </button>
      {shouldShowFallback ? (
        <OriginalPageFallback url={url} message={fallbackMessage} onRetryProxy={onRetryProxy} />
      ) : useRender && (isProxyLoading || !proxyHtml) ? (
        <div className="reader-iframe-fallback" aria-live="polite">
          <div className="fallback-header">
            <p className="eyebrow">Loading original page proxy</p>
            <p className="fallback-desc">Fetching the page through Vortex so it can render in app.</p>
          </div>
        </div>
      ) : useRender && proxyHtml ? (
        <iframe
          className="reader-iframe"
          srcDoc={proxyHtml}
          title="Original article page"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={(event) => onLoad(event.currentTarget)}
        />
      ) : (
        <iframe
          className="reader-iframe"
          src={url}
          title="Original article page"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={(event) => onLoad(event.currentTarget)}
        />
      )}
    </div>
  );
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
