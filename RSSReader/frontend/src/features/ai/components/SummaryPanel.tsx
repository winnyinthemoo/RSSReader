import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SummaryDetailLevel } from "../../../../../shared/ai";
import { targetLanguageOptions } from "../../../constants/targetLanguages";
import type { AppLanguage } from "../../../i18n";
import { getArticleSummary, getAiAgentSettings, startArticleSummary } from "../../../services/aiService";

interface SummaryPanelProps {
  appLanguage: AppLanguage;
  articleId?: string;
  disabled?: boolean;
}

type SummaryStatus = "idle" | "loading-cache" | "generating" | "ready" | "error";

export function SummaryPanel({ appLanguage, articleId, disabled }: SummaryPanelProps) {
  const text = summaryPanelText(appLanguage);
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
      setErrorMessage(getErrorMessage(error, text.fallbackError));
    }
  }, [articleId, detailLevel, targetLanguage, text.fallbackError]);

  useEffect(() => {
    let isActive = true;
    void getAiAgentSettings("summary")
      .then((settings) => {
        if (!isActive) {
          return;
        }
        if (settings.summary?.defaultTargetLanguage) {
          setTargetLanguage(settings.summary.defaultTargetLanguage);
        }
        if (settings.summary?.defaultDetailLevel) {
          setDetailLevel(settings.summary.defaultDetailLevel);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

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
    let streamedContent = "";
    try {
      setStatus("generating");
      setErrorMessage(undefined);
      setCopyStatus(undefined);
      setContent("");
      const chunk = await startArticleSummary(
        {
          articleId,
          targetLanguage,
          detailLevel,
        },
        (streamChunk) => {
          if (requestTokenRef.current !== requestToken) {
            return;
          }
          if (streamChunk.delta) {
            streamedContent += streamChunk.delta;
            setContent(streamedContent);
          }
          if (streamChunk.done) {
            setStatus("ready");
          }
        },
      );
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      if (!streamedContent && chunk.delta) {
        streamedContent = chunk.delta;
        setContent(chunk.delta);
      }
      setStatus("ready");
    } catch (error) {
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setStatus("error");
      setErrorMessage(getErrorMessage(error, text.fallbackError));
    }
  }

  async function handleCopySummary() {
    if (!content.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus(text.copied);
      window.setTimeout(() => setCopyStatus(undefined), 1600);
    } catch (error) {
      setCopyStatus(getErrorMessage(error, text.fallbackError));
    }
  }

  const isBusy = status === "loading-cache" || status === "generating";
  const SummaryCaret = isOpen ? ChevronDown : ChevronUp;
  const canTryAgain = Boolean(content.trim() || errorMessage);
  const generateLabel =
    status === "generating" ? text.generatingShort : canTryAgain ? text.tryAgain : text.generate;

  return (
    <aside
      className={`summary-floating ${isOpen ? "open" : "collapsed"}`}
      aria-label={text.aria}
    >
      <button
        className="summary-float-header"
        type="button"
        title={isOpen ? text.hide : text.show}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="summary-icon" aria-hidden="true">
          <Sparkles size={15} />
        </span>
        <span>{text.title}</span>
        <SummaryCaret className="summary-caret" size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <section className="summary-panel">
          <header className="summary-toolbar">
            <div className="summary-title-group">
              <span>{text.subtitle}</span>
            </div>
            <div className="summary-controls">
              <label>
                {text.language}
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  disabled={disabled || isBusy}
                >
                  {targetLanguageOptions.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text.detail}
                <select
                  value={detailLevel}
                  onChange={(event) =>
                    setDetailLevel(event.target.value as SummaryDetailLevel)
                  }
                  disabled={disabled || isBusy}
                >
                  <option value="short">{text.short}</option>
                  <option value="medium">{text.medium}</option>
                  <option value="detailed">{text.detailed}</option>
                </select>
              </label>
            </div>
            <button
              className="secondary-button summary-generate-btn"
              type="button"
              disabled={disabled || !articleId || isBusy}
              title={canTryAgain ? text.regenerateTitle : text.generateTitle}
              onClick={() => void handleGenerate()}
            >
              {generateLabel}
            </button>
          </header>
          <div className="summary-content" aria-live="polite">
            {content ? (
              <button
                className="summary-content-copy"
                type="button"
                title={text.copy}
                disabled={isBusy}
                onClick={() => void handleCopySummary()}
              >
                <Copy size={15} />
                <span>{copyStatus ?? text.copy}</span>
              </button>
            ) : null}
            {!articleId ? (
              <p className="muted">{text.selectArticle}</p>
            ) : status === "loading-cache" ? (
              <p className="muted">{text.loadingSaved}</p>
            ) : errorMessage ? (
              <p className="summary-error">{errorMessage}</p>
            ) : (
              <>
                {status === "generating" ? <p className="muted">{text.generating}</p> : null}
                {content ? (
                  <div className="summary-markdown">
                    <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
                  </div>
                ) : status === "generating" ? null : (
                  <p className="muted">{text.empty}</p>
                )}
              </>
            )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function summaryPanelText(language: AppLanguage) {
  if (language === "zh-Hans") {
    return {
      aria: "\u6587\u7ae0\u6458\u8981",
      title: "\u6458\u8981",
      show: "\u663e\u793a\u6458\u8981",
      hide: "\u9690\u85cf\u6458\u8981",
      subtitle: "\u4e3a\u5f53\u524d\u6587\u7ae0\u751f\u6210\u672c\u5730\u9605\u8bfb\u6458\u8981\u3002",
      language: "\u8bed\u8a00",
      detail: "\u8be6\u7ec6\u7a0b\u5ea6",
      short: "\u7b80\u77ed",
      medium: "\u9002\u4e2d",
      detailed: "\u8be6\u7ec6",
      generate: "\u751f\u6210",
      generatingShort: "\u751f\u6210\u4e2d...",
      tryAgain: "\u91cd\u8bd5",
      generateTitle: "\u751f\u6210\u65b0\u7684\u6458\u8981",
      regenerateTitle: "\u91cd\u65b0\u751f\u6210\u6458\u8981\u5e76\u66ff\u6362\u5df2\u4fdd\u5b58\u7ed3\u679c",
      copy: "\u590d\u5236",
      copied: "\u5df2\u590d\u5236",
      selectArticle: "\u8bf7\u5148\u9009\u62e9\u4e00\u7bc7\u6587\u7ae0\u3002",
      loadingSaved: "\u6b63\u5728\u52a0\u8f7d\u5df2\u4fdd\u5b58\u6458\u8981...",
      generating: "\u6b63\u5728\u751f\u6210\u6458\u8981\uff0c\u53ef\u80fd\u9700\u8981\u4e00\u5206\u949f\u5de6\u53f3...",
      empty: "\u6682\u65e0\u6458\u8981\uff0c\u70b9\u51fb\u751f\u6210\u3002",
      fallbackError: "\u53d1\u751f\u9519\u8bef\u3002",
    };
  }

  return {
    aria: "Article summary",
    title: "Summary",
    show: "Show summary",
    hide: "Hide summary",
    subtitle: "Generate a local reading digest for this article.",
    language: "Language",
    detail: "Detail",
    short: "Short",
    medium: "Medium",
    detailed: "Detailed",
    generate: "Generate",
    generatingShort: "Generating...",
    tryAgain: "Try again",
    generateTitle: "Generate a new summary",
    regenerateTitle: "Regenerate summary and replace the saved result",
    copy: "Copy",
    copied: "Copied",
    selectArticle: "Select an article to generate a summary.",
    loadingSaved: "Loading saved summary...",
    generating: "Generating summary (may take up to a minute)...",
    empty: "No summary yet. Click Generate.",
    fallbackError: "Something went wrong.",
  };
}