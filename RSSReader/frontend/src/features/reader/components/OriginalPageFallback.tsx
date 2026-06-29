interface OriginalPageFallbackProps {
  url: string;
  message?: string;
  onRetryProxy?: () => void;
}

export function OriginalPageFallback({ url, message, onRetryProxy }: OriginalPageFallbackProps) {
  return (
    <div className="reader-iframe-fallback">
      <div className="fallback-header">
        <p className="eyebrow">Original page unavailable in app</p>
        <p className="fallback-desc">
          {message ??
            "This is the real article URL. Some sites block embedded views or may be unavailable on the current network."}
        </p>
        {onRetryProxy ? (
          <button className="secondary-button" type="button" onClick={onRetryProxy}>
            Retry with proxy
          </button>
        ) : null}
        <a className="fallback-link" href={url} target="_blank" rel="noreferrer">
          Open original page
        </a>
      </div>
    </div>
  );
}
