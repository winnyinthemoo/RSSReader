import { useCallback, useEffect, useState } from "react";

import type { SummaryDetailLevel } from "../../../../../shared/ai";
import { getArticleSummary, startArticleSummary } from "../../../services/aiService";

interface SummaryPanelProps {
  articleId?: string;
  disabled?: boolean;
}

type SummaryStatus = "idle" | "loading-cache" | "generating" | "ready" | "error";

export function SummaryPanel({ articleId, disabled }: SummaryPanelProps) {
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [detailLevel, setDetailLevel] = useState<SummaryDetailLevel>("medium");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const loadCachedSummary = useCallback(async () => {
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
      if (cached?.content) {
        setContent(cached.content);
        setStatus("ready");
      } else {
        setContent("");
        setStatus("idle");
      }
    } catch (error) {
      setContent("");
      setStatus("error");
      setErrorMessage(getErrorMessage(error));
    }
  }, [articleId, targetLanguage, detailLevel]);

  useEffect(() => {
    void loadCachedSummary();
  }, [loadCachedSummary]);

  async function handleGenerate() {
    if (!articleId) {
      return;
    }

    try {
      setStatus("generating");
      setErrorMessage(undefined);
      setContent("");
      const chunk = await startArticleSummary({
        articleId,
        targetLanguage,
        detailLevel,
      });
      setContent(chunk.delta);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(getErrorMessage(error));
    }
  }

  const isBusy = status === "loading-cache" || status === "generating";

  return (
    <section className="summary-panel" aria-label="Article summary">
      <header className="summary-toolbar">
        <strong>Summary</strong>
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
        <button
          className="secondary-button"
          type="button"
          disabled={disabled || !articleId || isBusy}
          onClick={() => void handleGenerate()}
        >
          {status === "generating" ? "Generating…" : "Generate"}
        </button>
      </header>
      <div className="summary-content">
        {!articleId ? (
          <p className="muted">Select an article to generate a summary.</p>
        ) : status === "loading-cache" ? (
          <p className="muted">Loading saved summary…</p>
        ) : status === "generating" ? (
          <p className="muted">Generating summary (may take up to a minute)…</p>
        ) : errorMessage ? (
          <p className="summary-error">{errorMessage}</p>
        ) : content ? (
          <div className="summary-markdown">{content}</div>
        ) : (
          <p className="muted">No summary yet. Click Generate.</p>
        )}
      </div>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
