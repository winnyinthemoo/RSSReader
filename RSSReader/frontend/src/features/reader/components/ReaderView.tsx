import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  ExternalLink,
  FileText,
  Globe2,
  Languages,
  Bot,
  NotebookPen,
  Palette,
  Search,
  Share2,
  Star,
  Tags,
  X,
} from "lucide-react";
import TurndownService from "turndown";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { BilingualTranslationView } from "../../ai/components/BilingualTranslationView";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail, ArticleTag } from "../../../../../shared/feed";
import { getArticleTranslation, startTranslation } from "../../../services/aiService";
import {
  deleteArticleTag,
  getArticleNote,
  listArticleTags,
  saveArticleNote,
  saveArticleTags,
} from "../../../services/feedService";

interface ReaderViewProps {
  article?: ArticleDetail;
  onTagsChanged?: () => void;
  onOpenAiSettings?: () => void;
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

type ViewMode = "markdown" | "source" | "compare";

function OriginalPageFallback({ url }: { url: string }) {
  return (
    <div className="reader-iframe-fallback">
      <div className="fallback-header">
        <p className="eyebrow">Original page unavailable in app</p>
        <p className="fallback-desc">
          This is the real article URL. Some sites block embedded views or may be unavailable on
          the current network.
        </p>
        <a className="fallback-link" href={url} target="_blank" rel="noreferrer">
          Open original page
        </a>
      </div>
    </div>
  );
}

type ThemeBg = "white" | "sepia" | "dark" | "green";
type FontSize = "sm" | "md" | "lg" | "xl";
type ReaderPanel = "tag" | "note";

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

const markdownComponents: Components = {
  a({ node: _node, href, children, ...props }) {
    const shouldOpenOutsideApp = Boolean(href && !href.startsWith("#"));
    return (
      <a
        {...props}
        href={href}
        target={shouldOpenOutsideApp ? "_blank" : undefined}
        rel={shouldOpenOutsideApp ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
};

export function ReaderView({ article, onTagsChanged, onOpenAiSettings }: ReaderViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("markdown");
  const [sourceIframeError, setSourceIframeError] = useState(false);
  const sourceIframeLoaded = useRef(false);
  const sourceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [compareIframeError, setCompareIframeError] = useState(false);
  const compareIframeLoaded = useRef(false);
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  const [themeBg, setThemeBg] = useState<ThemeBg>("white");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [activePanel, setActivePanel] = useState<ReaderPanel | undefined>();
  const sidePanelRef = useRef<HTMLElement>(null);
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagStatus, setTagStatus] = useState<string | undefined>();
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

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
    setActivePanel(undefined);
    setSearchQuery("");
    setActiveSearchIndex(0);
  }, [article?.id]);

  // Load cached translation when panel opens
  useEffect(() => {
    if (bilingualOpen && article?.id) {
      void loadCachedTranslation();
    }
  }, [bilingualOpen, loadCachedTranslation, article?.id, targetLanguage]);

  const markdown = useMemo(() => {
    if (!article?.sanitizedHtml) return "";
    return normalizeMarkdown(article.sanitizedHtml);
  }, [article?.sanitizedHtml]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !markdown) {
      return [] as Array<{ start: number; end: number }>;
    }

    const query = searchQuery.trim().toLowerCase();
    const source = markdown.toLowerCase();
    const matches: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    while (cursor < source.length) {
      const index = source.indexOf(query, cursor);
      if (index === -1) {
        break;
      }
      matches.push({ start: index, end: index + query.length });
      cursor = index + query.length;
    }
    return matches;
  }, [markdown, searchQuery]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchQuery, article?.id]);

  useEffect(() => {
    if (activePanel === "tag" && article?.id) {
      void loadArticleTags(article.id);
    }
    if (activePanel === "note" && article?.id) {
      void loadArticleNote(article.id);
    }
  }, [activePanel, article?.id]);

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (sidePanelRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest("[data-reader-panel-trigger]")) {
        return;
      }
      setActivePanel(undefined);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePanel]);

  useEffect(() => {
    if (viewMode === "source" && article?.url) {
      startIframeTimer(sourceIframeLoaded, setSourceIframeError, sourceTimerRef);
    }
    if (viewMode === "compare" && article?.url) {
      startIframeTimer(compareIframeLoaded, setCompareIframeError, compareTimerRef);
    }

    return () => {
      if (sourceTimerRef.current) clearTimeout(sourceTimerRef.current);
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    };
  }, [article?.url, viewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "source") {
      setSearchQuery("");
      setActiveSearchIndex(0);
    }
    if (mode !== "markdown") {
      setBilingualOpen(false);
    }
    sourceIframeLoaded.current = false;
    compareIframeLoaded.current = false;
    setSourceIframeError(false);
    setCompareIframeError(false);
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

    setViewMode("markdown");
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

  async function loadArticleTags(articleId: string) {
    try {
      const result = await listArticleTags(articleId);
      setTags(result.tags);
      setTagStatus(undefined);
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveTags() {
    if (!article?.id || !tagInput.trim()) {
      return;
    }

    const nextTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const result = await saveArticleTags({
        articleId: article.id,
        tags: nextTags,
        source: "manual",
      });
      setTags(result.tags);
      setTagInput("");
      setTagStatus("Saved");
      onTagsChanged?.();
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteTag(tagId: string) {
    if (!article?.id) {
      return;
    }

    try {
      await deleteArticleTag({ articleId: article.id, tagId });
      setTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
      setTagStatus("Removed");
      onTagsChanged?.();
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadArticleNote(articleId: string) {
    try {
      const note = await getArticleNote(articleId);
      setNoteContent(note?.content ?? "");
      setNoteStatus(undefined);
    } catch (error) {
      setNoteStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveNote() {
    if (!article?.id) {
      return;
    }

    try {
      await saveArticleNote({
        articleId: article.id,
        content: noteContent,
      });
      setNoteStatus("Saved");
    } catch (error) {
      setNoteStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function handleSearchStep(direction: 1 | -1) {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchIndex((currentIndex) =>
      (currentIndex + direction + searchMatches.length) % searchMatches.length,
    );
  }

  function handleToggleReaderPanel(panel: ReaderPanel) {
    setActivePanel((currentPanel) => (currentPanel === panel ? undefined : panel));
  }

  function startIframeTimer(
    loadFlag: { current: boolean },
    setError: (value: boolean) => void,
    timerRef: { current: ReturnType<typeof setTimeout> | undefined },
  ) {
    clearTimeout(timerRef.current);
    loadFlag.current = false;
    setError(false);
    timerRef.current = setTimeout(() => {
      if (!loadFlag.current) {
        setError(true);
      }
    }, 10000);
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
          onOpenAiSettings={onOpenAiSettings}
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
        activePanel={activePanel}
        searchQuery={searchQuery}
        searchMatchCount={searchMatches.length}
        activeSearchIndex={activeSearchIndex}
        onTogglePanel={handleToggleReaderPanel}
        onSearchQueryChange={viewMode === "source" ? undefined : setSearchQuery}
        onSearchStep={viewMode === "source" ? undefined : handleSearchStep}
        onOpenAiSettings={onOpenAiSettings}
      />
      {activePanel ? (
        <ReaderSidePanel
          ref={sidePanelRef}
          activePanel={activePanel}
          articleId={article.id}
          tags={tags}
          tagInput={tagInput}
          tagStatus={tagStatus}
          noteContent={noteContent}
          noteStatus={noteStatus}
          onClose={() => setActivePanel(undefined)}
          onTagInputChange={setTagInput}
          onSaveTags={() => void handleSaveTags()}
          onDeleteTag={(tagId) => void handleDeleteTag(tagId)}
          onNoteChange={setNoteContent}
          onSaveNote={() => void handleSaveNote()}
        />
      ) : null}
      {viewMode === "markdown" ? (
        <div className="reader-themed-page" data-theme={themeBg} data-font-size={fontSize}>
          <ReaderHeader article={article} />
          {bilingualOpen ? (
            <BilingualTranslationView
              articleHtml={article.sanitizedHtml}
              translation={translation}
              isLoading={translationLoading}
              errorMessage={translationError}
            />
          ) : (
            <MarkdownArticle
              markdown={markdown}
              activeSearchIndex={activeSearchIndex}
              searchMatches={searchMatches}
            />
          )}
        </div>
      ) : viewMode === "source" ? (
        <div className="reader-web-view">
          {sourceIframeError ? (
            <OriginalPageFallback url={article.url} />
          ) : (
            <iframe
              className="reader-iframe"
              src={article.url}
              title="Original article page"
              onLoad={() => {
                sourceIframeLoaded.current = true;
                setSourceIframeError(false);
              }}
            />
          )}
        </div>
      ) : (
        <div className={`reader-compare${isDragging ? " dragging" : ""}`} ref={compareRef}>
          <div className="compare-pane" style={{ width: `${splitRatio}%` }}>
            <div className="compare-pane-label">Readable Markdown</div>
            <div className="compare-pane-content" data-theme={themeBg} data-font-size={fontSize}>
              <ReaderHeader article={article} variant="compact" />
              <MarkdownArticle
                markdown={markdown}
                variant="compare"
                activeSearchIndex={activeSearchIndex}
                searchMatches={searchMatches}
              />
            </div>
          </div>
          <div className="compare-divider" onMouseDown={handleDividerMouseDown}>
            <div className="compare-divider-handle" />
          </div>
          <div className="compare-pane" style={{ width: `${100 - splitRatio}%` }}>
            <div className="compare-pane-label">Original page</div>
            {compareIframeError ? (
              <OriginalPageFallback url={article.url} />
            ) : (
              <iframe
                className="reader-iframe"
                src={article.url}
                title="Original article page"
                onLoad={() => {
                  compareIframeLoaded.current = true;
                  setCompareIframeError(false);
                }}
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
  activeSearchIndex?: number;
  searchMatches?: Array<{ start: number; end: number }>;
}

function MarkdownArticle({
  markdown,
  variant = "default",
  activeSearchIndex = 0,
  searchMatches = [],
}: MarkdownArticleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
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

interface ReaderSidePanelProps {
  activePanel: ReaderPanel;
  articleId?: string;
  tags: ArticleTag[];
  tagInput: string;
  tagStatus?: string;
  noteContent: string;
  noteStatus?: string;
  onClose: () => void;
  onTagInputChange: (value: string) => void;
  onSaveTags: () => void;
  onDeleteTag: (tagId: string) => void;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
}

const ReaderSidePanel = forwardRef<HTMLElement, ReaderSidePanelProps>(function ReaderSidePanel({
  activePanel,
  articleId,
  tags,
  tagInput,
  tagStatus,
  noteContent,
  noteStatus,
  onClose,
  onTagInputChange,
  onSaveTags,
  onDeleteTag,
  onNoteChange,
  onSaveNote,
}, ref) {
  const title = activePanel === "tag" ? "Tags" : "Note";

  return (
    <aside className="reader-side-panel" aria-label={title} ref={ref}>
      <header className="reader-side-panel-header">
        <strong>{title}</strong>
        <button className="tool-button" type="button" title="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      {activePanel === "tag" ? (
        <div className="reader-panel-body">
          {!articleId ? <p className="muted">Select an article first.</p> : null}
          <div className="tag-chip-list">
            {tags.length === 0 ? (
              <span className="muted">No tags yet.</span>
            ) : (
              tags.map((tag) => (
                <span className="tag-chip" key={tag.id}>
                  {tag.name}
                  <button type="button" title="Remove tag" onClick={() => onDeleteTag(tag.id)}>
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
          <label className="reader-panel-field">
            <span>Add tags</span>
            <input
              value={tagInput}
              onChange={(event) => onTagInputChange(event.target.value)}
              placeholder="AI, Rust, Product"
            />
          </label>
          <button className="secondary-button" type="button" onClick={onSaveTags}>
            Save tags
          </button>
          {tagStatus ? <p className="reader-panel-status">{tagStatus}</p> : null}
        </div>
      ) : null}

      {activePanel === "note" ? (
        <div className="reader-panel-body">
          <label className="reader-panel-field">
            <span>Article note</span>
            <textarea
              value={noteContent}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Write a local note for this article..."
            />
          </label>
          <button className="secondary-button" type="button" onClick={onSaveNote}>
            Save note
          </button>
          {noteStatus ? <p className="reader-panel-status">{noteStatus}</p> : null}
        </div>
      ) : null}

    </aside>
  );
});

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
  activePanel?: ReaderPanel;
  searchQuery?: string;
  searchMatchCount?: number;
  activeSearchIndex?: number;
  onTogglePanel?: (panel: ReaderPanel) => void;
  onSearchQueryChange?: (value: string) => void;
  onSearchStep?: (direction: 1 | -1) => void;
  onOpenAiSettings?: () => void;
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
  activePanel,
  searchQuery = "",
  searchMatchCount = 0,
  activeSearchIndex = 0,
  onTogglePanel,
  onSearchQueryChange,
  onSearchStep,
  onOpenAiSettings,
}: ReaderToolbarProps) {
  const themePanelRef = useRef<HTMLDivElement>(null);
  const searchCountLabel = searchQuery.trim()
    ? searchMatchCount > 0
      ? `${Math.min(activeSearchIndex + 1, searchMatchCount)} / ${searchMatchCount}`
      : "0 / 0"
    : "";

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
      <div className="tool-group reader-view-tools" aria-label="Display mode">
        <button
          className={`tool-button${viewMode === "markdown" ? " active" : ""}`}
          type="button"
          title="Markdown view"
          onClick={() => onViewModeChange("markdown")}
        >
          <FileText size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "source" ? " active" : ""}`}
          type="button"
          title="Original page"
          onClick={() => onViewModeChange("source")}
        >
          <Globe2 size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "compare" ? " active" : ""}`}
          type="button"
          title="Compare with original page"
          onClick={() => onViewModeChange("compare")}
        >
          <Columns2 size={17} />
        </button>
      </div>

      <div className="tool-group reader-action-tools" aria-label="Article actions">
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
        <button
          className={`tool-button${activePanel === "tag" ? " active" : ""}`}
          type="button"
          title="Tag"
          data-reader-panel-trigger
          onClick={() => onTogglePanel?.("tag")}
        >
          <Tags size={17} />
        </button>
        <button
          className={`tool-button${activePanel === "note" ? " active" : ""}`}
          type="button"
          title="Note"
          data-reader-panel-trigger
          onClick={() => onTogglePanel?.("note")}
        >
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

      <div className="tool-group search-group open" aria-label="Search">
        <div className="reader-search-bar" role="search" aria-disabled={!onSearchQueryChange}>
          <Search size={16} />
          <input
            value={searchQuery}
            disabled={!onSearchQueryChange}
            onChange={(event) => onSearchQueryChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearchStep?.(event.shiftKey ? -1 : 1);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onSearchStep?.(1);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onSearchStep?.(-1);
                return;
              }
              if (event.key === "Escape" && searchQuery) {
                event.preventDefault();
                onSearchQueryChange?.("");
              }
            }}
            placeholder="Search current article"
            aria-label="Search current article"
          />
          <button
            className="tool-button reader-search-clear"
            type="button"
            title="Clear search"
            disabled={!onSearchQueryChange || !searchQuery}
            onClick={() => onSearchQueryChange?.("")}
          >
            <X size={14} />
          </button>
          <span className="reader-search-count">{searchCountLabel}</span>
          <button
            className="tool-button"
            type="button"
            title="Previous match"
            disabled={!onSearchStep || searchMatchCount === 0}
            onClick={() => onSearchStep?.(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="tool-button"
            type="button"
            title="Next match"
            disabled={!onSearchStep || searchMatchCount === 0}
            onClick={() => onSearchStep?.(1)}
          >
            <ChevronDown size={15} />
          </button>
        </div>
        <button
          className="tool-button ai-toolbar-button"
          type="button"
          title="AI settings"
          aria-label="AI settings"
          onClick={onOpenAiSettings}
        >
          <Bot size={17} />
        </button>
      </div>
    </div>
  );
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
