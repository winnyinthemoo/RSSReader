import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns2,
  ExternalLink,
  FileText,
  Languages,
  NotebookPen,
  Palette,
  Search,
  Share2,
  Star,
  Tags,
  WholeWord,
} from "lucide-react";
import TurndownService from "turndown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { BilingualTranslationView } from "../../ai/components/BilingualTranslationView";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail } from "../../../../../shared/feed";
import { getArticleTranslation, startTranslation } from "../../../services/aiService";

interface ReaderViewProps {
  article?: ArticleDetail;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

function normalizeMarkdown(html: string): string {
  const prepared = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const md = turndown.turndown(prepared);
  const unescaped = md.replace(/\\([*])/g, "$1");
  return unescaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

type ViewMode = "markdown" | "web" | "compare";

function IFrameFallback({ url }: { url: string }) {
  return (
    <div className="reader-iframe-fallback">
      <div className="fallback-header">
        <p className="eyebrow">Unable to load original page</p>
        <p className="fallback-desc">
          {url.includes("bloomberg.com")
            ? "Bloomberg blocks embedding."
            : "This site does not allow embedding in an iframe."}
        </p>
        <a className="fallback-link" href={url} target="_blank" rel="noreferrer">
          Open in new tab &rarr;
        </a>
      </div>
    </div>
  );
}

type ThemeBg = "white" | "sepia" | "dark" | "green";
type FontSize = "sm" | "md" | "lg" | "xl";

const THEME_BG_OPTIONS: { key: ThemeBg; label: string; color: string; text: string }[] = [
  { key: "white", label: "White", color: "#fcfdfb", text: "#2f312d" },
  { key: "sepia", label: "Sepia", color: "#f4f0e6", text: "#3a3226" },
  { key: "dark", label: "Dark", color: "#1e201d", text: "#d5ddd4" },
  { key: "green", label: "Green", color: "#eef5f0", text: "#2f312d" },
];

const FONT_SIZE_OPTIONS: { key: FontSize; label: string; value: string }[] = [
  { key: "sm", label: "S", value: "0.9rem" },
  { key: "md", label: "M", value: "1.05rem" },
  { key: "lg", label: "L", value: "1.2rem" },
  { key: "xl", label: "XL", value: "1.35rem" },
];

export function ReaderView({ article }: ReaderViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("markdown");

  const [webIframeError, setWebIframeError] = useState(false);
  const webIframeLoaded = useRef(false);
  const webTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [cmpIframeError, setCmpIframeError] = useState(false);
  const cmpIframeLoaded = useRef(false);
  const cmpTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  const [themeBg, setThemeBg] = useState<ThemeBg>("white");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [showThemePanel, setShowThemePanel] = useState(false);

  // AI translation state
  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [translation, setTranslation] = useState<TranslationView | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | undefined>();

  const loadCachedTranslation = useCallback(async () => {
    if (!article?.id) {
      setTranslation(undefined);
      return;
    }
    try {
      const cached = await getArticleTranslation(article.id, targetLanguage);
      setTranslation(cached ?? undefined);
      setTranslationError(undefined);
    } catch (error) {
      setTranslation(undefined);
      setTranslationError(error instanceof Error ? error.message : String(error));
    }
  }, [article?.id, targetLanguage]);

  // Reset bilingual state on article change
  useEffect(() => {
    setBilingualOpen(false);
    setTranslation(undefined);
    setTranslationError(undefined);
  }, [article?.id]);

  // Load cached translation when panel opens
  useEffect(() => {
    if (bilingualOpen && article?.id) {
      void loadCachedTranslation();
    }
  }, [bilingualOpen, loadCachedTranslation, article?.id, targetLanguage]);

  function startIframeTimer(
    loadFlag: { current: boolean },
    setError: (v: boolean) => void,
    timerRef: { current: ReturnType<typeof setTimeout> | undefined },
  ) {
    clearTimeout(timerRef.current);
    loadFlag.current = false;
    setError(false);
    timerRef.current = setTimeout(() => {
      if (!loadFlag.current) setError(true);
    }, 10000);
  }

  useEffect(() => {
    if (viewMode === "web" && article?.url) {
      startIframeTimer(webIframeLoaded, setWebIframeError, webTimerRef);
    }
    if (viewMode === "compare" && article?.url) {
      startIframeTimer(cmpIframeLoaded, setCmpIframeError, cmpTimerRef);
    }
    return () => {
      if (webTimerRef.current) clearTimeout(webTimerRef.current);
      if (cmpTimerRef.current) clearTimeout(cmpTimerRef.current);
    };
  }, [article?.url, viewMode]);

  const markdown = useMemo(() => {
    if (!article?.sanitizedHtml) return "";
    return normalizeMarkdown(article.sanitizedHtml);
  }, [article?.sanitizedHtml]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    webIframeLoaded.current = false;
    cmpIframeLoaded.current = false;
    setWebIframeError(false);
    setCmpIframeError(false);
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!compareRef.current) return;
      const rect = compareRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(Math.max((x / rect.width) * 100, 20), 80);
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  async function handleTranslate() {
    if (!article?.id) return;

    if (bilingualOpen) {
      setBilingualOpen(false);
      return;
    }

    setBilingualOpen(true);
    setTranslationError(undefined);

    const cached = await getArticleTranslation(article.id, targetLanguage).catch((error) => {
      setTranslationError(error instanceof Error ? error.message : String(error));
      return null;
    });

    if (cached && cached.segments.length > 0 && cached.status !== "failed") {
      setTranslation(cached);
      return;
    }

    try {
      setTranslationLoading(true);
      setTranslation(undefined);
      const result = await startTranslation({
        articleId: article.id,
        targetLanguage,
      });
      setTranslation(result);
      setTranslationError(undefined);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : String(error));
    } finally {
      setTranslationLoading(false);
    }
  }

  if (!article) {
    return (
      <section className="reader-pane">
        <ReaderToolbar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showThemePanel={showThemePanel}
          onToggleThemePanel={() => setShowThemePanel((v) => !v)}
          themeBg={themeBg}
          onThemeBgChange={setThemeBg}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          bilingualOpen={bilingualOpen}
          onTranslate={() => undefined}
        />
        <div className="reader-empty">
          <p className="eyebrow">Reader</p>
          <h2>Select an article</h2>
          <p>Choose a feed item from the middle column to open the reading view.</p>
        </div>
      </section>
    );
  }

  return (
    <article className="reader-pane">
      <ReaderToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        showThemePanel={showThemePanel}
        onToggleThemePanel={() => setShowThemePanel((v) => !v)}
        themeBg={themeBg}
        onThemeBgChange={setThemeBg}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        bilingualOpen={bilingualOpen}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={setTargetLanguage}
        onTranslate={() => void handleTranslate()}
        translateDisabled={translationLoading}
      />
      {bilingualOpen ? (
        <>
          <ReaderHeader article={article} />
          <BilingualTranslationView
            articleHtml={article.sanitizedHtml}
            translation={translation}
            isLoading={translationLoading}
            errorMessage={translationError}
          />
        </>
      ) : viewMode === "markdown" ? (
        <div className="reader-themed-page" data-theme={themeBg} data-font-size={fontSize}>
          <ReaderHeader article={article} />
          <MarkdownArticle
            markdown={markdown}
          />
        </div>
      ) : viewMode === "web" ? (
        <div className="reader-web-view">
          {webIframeError ? (
            <IFrameFallback url={article.url} />
          ) : (
            <iframe
              className="reader-iframe"
              src={article.url}
              title="Original article"
              onLoad={() => { webIframeLoaded.current = true; setWebIframeError(false); }}
            />
          )}
        </div>
      ) : (
        <div className={`reader-compare${isDragging ? " dragging" : ""}`} ref={compareRef}>
          <div className="compare-pane" style={{ width: `${splitRatio}%` }}>
            <div className="compare-pane-label">Converted (Markdown)</div>
            <div className="compare-pane-content" data-theme={themeBg} data-font-size={fontSize}>
              <ReaderHeader article={article} variant="compact" />
              <MarkdownArticle
                markdown={markdown}
                variant="compare"
              />
            </div>
          </div>
          <div className="compare-divider" onMouseDown={handleDividerMouseDown}>
            <div className="compare-divider-handle" />
          </div>
          <div className="compare-pane" style={{ width: `${100 - splitRatio}%` }}>
            <div className="compare-pane-label">Original</div>
            {cmpIframeError ? (
              <IFrameFallback url={article.url} />
            ) : (
              <iframe
                className="reader-iframe"
                src={article.url}
                title="Original article"
                onLoad={() => { cmpIframeLoaded.current = true; setCmpIframeError(false); }}
              />
            )}
          </div>
        </div>
      )}
      <SummaryPanel articleId={article.id} />
    </article>
  );
}

function ReaderHeader({
  article,
  variant = "default",
}: {
  article: ArticleDetail;
  variant?: "default" | "compact";
}) {
  return (
    <header className={`reader-header${variant === "compact" ? " compact" : ""}`}>
      <p className="eyebrow">{article.feedTitle}</p>
      <h2>{article.title}</h2>
      <div className="reader-meta">
        <span>{article.author ?? "Unknown author"}</span>
        <span>{formatFullDate(article.publishedAt)}</span>
        {article.isFavorite ? (
          <span className="favorite-label">
            <Star size={15} fill="currentColor" />
            Saved
          </span>
        ) : null}
        <a href={article.url} target="_blank" rel="noreferrer" title="Open original article">
          <ExternalLink size={16} />
        </a>
      </div>
    </header>
  );
}

interface MarkdownArticleProps {
  markdown: string;
  variant?: "default" | "compare";
}

function MarkdownArticle({
  markdown,
  variant = "default",
}: MarkdownArticleProps) {
  return (
    <div
      className={`reader-content reader-content-md${
        variant === "compare" ? " compare-markdown-content" : ""
      }`}
    >
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {markdown}
      </Markdown>
    </div>
  );
}

interface ReaderToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showThemePanel: boolean;
  onToggleThemePanel: () => void;
  themeBg: ThemeBg;
  onThemeBgChange: (bg: ThemeBg) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  bilingualOpen: boolean;
  targetLanguage?: string;
  onTargetLanguageChange?: (value: string) => void;
  onTranslate: () => void;
  translateDisabled?: boolean;
}

function ReaderToolbar({
  viewMode,
  onViewModeChange,
  showThemePanel,
  onToggleThemePanel,
  themeBg,
  onThemeBgChange,
  fontSize,
  onFontSizeChange,
  bilingualOpen,
  targetLanguage = "zh-Hans",
  onTargetLanguageChange,
  onTranslate,
  translateDisabled,
}: ReaderToolbarProps) {
  const themePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showThemePanel) return;
    function handleClick(e: MouseEvent) {
      if (themePanelRef.current && !themePanelRef.current.contains(e.target as Node)) {
        onToggleThemePanel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showThemePanel, onToggleThemePanel]);

  return (
    <div className="reader-toolbar" aria-label="Reader tools">
      <div className="tool-group" aria-label="Display mode">
        <button
          className={`tool-button${viewMode === "markdown" ? " active" : ""}`}
          type="button"
          title="Markdown view"
          onClick={() => onViewModeChange("markdown")}
        >
          <FileText size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "web" ? " active" : ""}`}
          type="button"
          title="Web view"
          onClick={() => onViewModeChange("web")}
        >
          <WholeWord size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "compare" ? " active" : ""}`}
          type="button"
          title="Compare view"
          onClick={() => onViewModeChange("compare")}
        >
          <Columns2 size={17} />
        </button>
      </div>

      <div className="tool-group" aria-label="Article actions">
        {bilingualOpen && onTargetLanguageChange ? (
          <select
            className="translation-lang-select"
            value={targetLanguage}
            onChange={(event) => onTargetLanguageChange(event.target.value)}
            disabled={translateDisabled}
            aria-label="Translation language"
          >
            <option value="zh-Hans">简体中文</option>
            <option value="en">English</option>
          </select>
        ) : null}
        <button
          className={`tool-button${bilingualOpen ? " active" : ""}`}
          type="button"
          title={bilingualOpen ? "Show original" : "Translate"}
          disabled={translateDisabled}
          onClick={onTranslate}
        >
          <Languages size={17} />
        </button>
        <button className="tool-button" type="button" title="Tag">
          <Tags size={17} />
        </button>
        <button className="tool-button" type="button" title="Note">
          <NotebookPen size={17} />
        </button>
        <div style={{ position: "relative" }}>
          <button className={`tool-button${showThemePanel ? " active" : ""}`} type="button" title="Theme" onClick={onToggleThemePanel}>
            <Palette size={17} />
          </button>
          {showThemePanel && (
            <ThemePanel
              ref={themePanelRef}
              themeBg={themeBg}
              onThemeBgChange={onThemeBgChange}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
            />
          )}
        </div>
        <button className="tool-button" type="button" title="Share">
          <Share2 size={17} />
        </button>
      </div>

      <div className="tool-group search-group" aria-label="Search">
        <button className="tool-button" type="button" title="Search">
          <Search size={17} />
        </button>
      </div>
    </div>
  );
}

const ThemePanel = forwardRef<HTMLDivElement, {
  themeBg: ThemeBg;
  onThemeBgChange: (bg: ThemeBg) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}>(function ThemePanel({ themeBg, onThemeBgChange, fontSize, onFontSizeChange }, ref) {
  return (
    <div className="theme-panel" ref={ref}>
      <div className="theme-panel-section">
        <div className="theme-panel-label">Background</div>
        <div className="theme-color-options">
          {THEME_BG_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`theme-color-swatch${themeBg === opt.key ? " active" : ""}`}
              style={{ background: opt.color }}
              title={opt.label}
              onClick={() => onThemeBgChange(opt.key)}
            />
          ))}
        </div>
      </div>
      <div className="theme-panel-section">
        <div className="theme-panel-label">Font size</div>
        <div className="theme-font-options">
          {FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`theme-font-button${fontSize === opt.key ? " active" : ""}`}
              onClick={() => onFontSizeChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

function formatFullDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
