import { RefreshCw } from "lucide-react";

import { OriginalPageFallback } from "./OriginalPageFallback";

interface OriginalPageViewProps {
  url: string;
  iframeError: boolean;
  useRender: boolean;
  renderUrl: string;
  onToggleProxy: () => void;
  onRetryProxy: () => void;
  onLoad: () => void;
}

export function OriginalPageView({
  url,
  iframeError,
  useRender,
  renderUrl,
  onToggleProxy,
  onRetryProxy,
  onLoad,
}: OriginalPageViewProps) {
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
      {iframeError ? (
        <OriginalPageFallback url={url} onRetryProxy={onRetryProxy} />
      ) : (
        <iframe
          className="reader-iframe"
          src={useRender ? renderUrl : url}
          title="Original article page"
          onLoad={onLoad}
        />
      )}
    </div>
  );
}
