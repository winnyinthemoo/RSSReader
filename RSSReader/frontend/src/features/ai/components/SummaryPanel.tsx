import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SummaryDetailLevel } from "../../../../../shared/ai";
import { getArticleSummary, startArticleSummary } from "../../../services/aiService";

interface SummaryPanelProps {
  articleId?: string;
  disabled?: boolean;
}

type SummaryStatus = "idle" | "loading-cache" | "generating" | "ready" | "error";

export function SummaryPanel({ articleId, disabled }: SummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [detailLevel, setDetailLevel] = useState<SummaryDetailLevel>("medium");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [copyStatus, setCopyStatus] = useState<string | undefined>();
  const requestTokenRef = useRef(0);

  const loadCachedSummary = useCallback(async () => {
    const requestToken = ++requestTokenRef.current;
    if (!articleId) {
      setContent("");
      setStatus("idle");
      setErrorMessage(undefined);
      return;
    }

    try {
      setStatus("loading-cache");
      setErrorMessage(undefined);
      const cached = await getArticleSummary({
        articleId,
        targetLanguage,
        detailLevel,
      });
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      if (cached?.content) {
        setContent(cached.content);
        setStatus("ready");
      } else {
        setContent("");
        setStatus("idle");
      }
    } catch (error) {
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setContent("");
      setStatus("error");
      setErrorMessage(getErrorMessage(error));
    }
  }, [articleId, targetLanguage, detailLevel]);

  useEffect(() => {
    requestTokenRef.current += 1;
    setContent("");
    setStatus("idle");
    setErrorMessage(undefined);
    setCopyStatus(undefined);
  }, [articleId]);

  useEffect(() => {
    if (isOpen) {
      void loadCachedSummary();
    }
  }, [isOpen, loadCachedSummary]);

  async function handleGenerate() {
    if (!articleId) {
      return;
    }

    const requestToken = ++requestTokenRef.current;
    try {
      setStatus("generating");
      setErrorMessage(undefined);
      setContent("");
      const chunk = await startArticleSummary({
        articleId,
        targetLanguage,
        detailLevel,
      });
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setContent(chunk.delta);
      setStatus("ready");
      setCopyStatus(undefined);
    } catch (error) {
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setStatus("error");
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleCopySummary() {
    if (!content.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(undefined), 1600);
    } catch (error) {
      setCopyStatus(getErrorMessage(error));
    }
  }

  const isBusy = status === "loading-cache" || status === "generating";

  return (
    <aside
      className={`summary-floating ${isOpen ? "open" : "collapsed"}`}
      aria-label="Article summary"
    >
      <button
        className="summary-float-header"
        type="button"
        title={isOpen ? "Hide summary" : "Show summary"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="summary-icon" aria-hidden="true">
          <Sparkles size={15} />
        </span>
        <span>Summary</span>
        <ChevronDown className="summary-caret" size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <section className="summary-panel">
          <header className="summary-toolbar">
            <div className="summary-title-group">
              <span>Generate a local reading digest for this article.</span>
            </div>
            <div className="summary-controls">
              <label>
                Language
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  disabled={disabled || isBusy}
                >
                  <option value="zh-Hans">简体中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                Detail
                <select
                  value={detailLevel}
                  onChange={(event) =>
                    setDetailLevel(event.target.value as SummaryDetailLevel)
                  }
                  disabled={disabled || isBusy}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
            </div>
            <button
              className="secondary-button summary-generate-btn"
              type="button"
              disabled={disabled || !articleId || isBusy}
              onClick={() => void handleGenerate()}
            >
              {status === "generating" ? "Generating..." : "Generate"}
            </button>
          </header>
          <div className="summary-content">
            {content ? (
              <button
                className="summary-content-copy"
                type="button"
                title="Copy summary"
                disabled={isBusy}
                onClick={() => void handleCopySummary()}
              >
                <Copy size={15} />
                <span>{copyStatus ?? "Copy"}</span>
              </button>
            ) : null}
            {!articleId ? (
              <p className="muted">Select an article to generate a summary.</p>
            ) : status === "loading-cache" ? (
              <p className="muted">Loading saved summary...</p>
            ) : status === "generating" ? (
              <p className="muted">Generating summary (may take up to a minute)...</p>
            ) : errorMessage ? (
              <p className="summary-error">{errorMessage}</p>
            ) : content ? (
              <div className="summary-markdown">
                <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
              </div>
            ) : (
              <p className="muted">No summary yet. Click Generate.</p>
            )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
