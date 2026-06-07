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
  Check,
  NotebookPen,
  Palette,
  RefreshCw,
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
import { SelectionTranslationPanel } from "../../ai/components/SelectionTranslationPanel";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import { TaggingPanel } from "../../ai/components/TaggingPanel";
import { displayTranslationText } from "../../ai/utils/buildBilingualArticleHtml";
import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail, ArticleTag } from "../../../../../shared/feed";
import {
  getArticleTranslation,
  startTranslation,
} from "../../../services/aiService";
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
  onThemeChange?: (theme: ThemeBg) => void;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.addRule("table", {
  filter: ["table"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML,
});

turndown.addRule("image", {
  filter: ["img"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML,
});

turndown.addRule("paragraph", {
  filter: ["p"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML + "\n",
});

function normalizeMarkdown(html: string): string {
  const prepared = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const md = turndown.turndown(prepared);
  console.log("HAS IMG in markdown:", md.includes("<img"));
  const unescaped = md.replace(/\\([*])/g, "$1");
  return unescaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Convert display-oriented markdown (<strong>) to clipboard-friendly (**). */
function markdownForCopy(md: string): string {
  return md.replace(/<strong>/g, "**").replace(/<\/strong>/g, "**");
}

type ViewMode = "markdown" | "source" | "compare";
type DetectedContentLanguage = "zh" | "en" | "unknown";
type SelectionTranslationStatus = "idle" | "ready" | "loading" | "result" | "skipped" | "error";
interface SelectionTranslationState {
  selectedText: string;
  status: SelectionTranslationStatus;
  translatedText?: string;
  message?: string;
  errorMessage?: string;
}

function getReaderSelectedText(container: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !container) {
    return "";
  }

  const range = selection.getRangeAt(0);
  if (
    range.collapsed ||
    (!container.contains(range.commonAncestorContainer) &&
      !container.contains(selection.anchorNode) &&
      !container.contains(selection.focusNode))
  ) {
    return "";
  }

  return selection.toString().replace(/\s+/g, " ").trim();
}

function selectionTranslationText(view: TranslationView) {
  const segment = view.segments[0] as (TranslationView["segments"][number] & {
    translated_text?: string;
  }) | undefined;
  return displayTranslationText(segment?.translatedText ?? segment?.translated_text ?? "");
}

function detectContentLanguage(text: string): DetectedContentLanguage {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (sample.length < 12) {
    return "unknown";
  }

  const chineseCount = (sample.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (sample.match(/[a-zA-Z]/g) ?? []).length;
  const signalCount = chineseCount + latinCount;
  if (signalCount < 8) {
    return "unknown";
  }
  if (chineseCount >= 6 && chineseCount / signalCount >= 0.35) {
    return "zh";
  }
  if (latinCount >= 18 && latinCount / signalCount >= 0.7) {
    return "en";
  }
  return "unknown";
}

function targetLanguageFamily(language: string): DetectedContentLanguage {
  if (language === "en") {
    return "en";
  }
  if (language === "zh-Hans" || language === "zh-Hant") {
    return "zh";
  }
  return "unknown";
}

function isSameLanguageTarget(sourceLanguage: DetectedContentLanguage, targetLanguage: string) {
  return sourceLanguage !== "unknown" && sourceLanguage === targetLanguageFamily(targetLanguage);
}

function translationLanguageNotice(
  sourceLanguage: DetectedContentLanguage,
  targetLanguage: string,
  skippedSameLanguage: boolean,
) {
  if (sourceLanguage === "unknown") {
    return undefined;
  }
  const targetLabel = translationLanguageLabel(targetLanguage);
  if (targetLanguageFamily(targetLanguage) === "zh") {
    const sourceLabel = sourceLanguage === "zh" ? "中文" : "英文";
    if (skippedSameLanguage) {
      return `检测到当前内容是${sourceLabel}，目标语言也是${targetLabel}，已跳过翻译。`;
    }
    return `检测到当前内容是${sourceLabel}，将翻译为${targetLabel}。`;
  }

  const sourceLabel = sourceLanguage === "zh" ? "Chinese" : "English";
  if (skippedSameLanguage) {
    return `Detected ${sourceLabel} content. The selected target is also ${targetLabel}, so translation was skipped.`;
  }
  return `Detected ${sourceLabel} content. Translating to selected target ${targetLabel}.`;
}

function OriginalPageFallback({ url, onRetryProxy }: { url: string; onRetryProxy?: () => void }) {
  return (
    <div className="reader-iframe-fallback">
      <div className="fallback-header">
        <p className="eyebrow">Original page unavailable in app</p>
        <p className="fallback-desc">
          This is the real article URL. Some sites block embedded views or may be unavailable on
          the current network.
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

const TRANSLATION_LANGUAGE_OPTIONS = [
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "hi", label: "हिन्दी" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "th", label: "ไทย" },
  { value: "tr", label: "Türkçe" },
];

function translationLanguageLabel(value: string) {
  return TRANSLATION_LANGUAGE_OPTIONS.find((language) => language.value === value)?.label ?? value;
}

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

export function ReaderView({
  article,
  onTagsChanged,
  onOpenAiSettings,
  onThemeChange,
}: ReaderViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("markdown");
  const [sourceIframeError, setSourceIframeError] = useState(false);
  const [sourceUseRender, setSourceUseRender] = useState(false);
  const sourceIframeLoaded = useRef(false);
  const sourceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
      const [compareIframeError, setCompareIframeError] = useState(false);
  const [compareUseRender, setCompareUseRender] = useState(false);
  const compareIframeLoaded = useRef(false);
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  const proxyBase = `http://${window.location.hostname === '127.0.0.1' ? '127.0.0.1:5181' : window.location.host}/api`;
  function getRenderUrl(originalUrl: string) {
    return `${proxyBase}/render?url=${encodeURIComponent(originalUrl)}`;
  }

  const [themeBg, setThemeBg] = useState<ThemeBg>("white");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [activePanel, setActivePanel] = useState<ReaderPanel | undefined>();
  const sidePanelRef = useRef<HTMLElement>(null);
  const tagStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagStatus, setTagStatus] = useState<string | undefined>();
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [shareStatus, setShareStatus] = useState<string | undefined>();
  const articleContentRef = useRef<HTMLDivElement>(null);

  // AI translation state
  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [translation, setTranslation] = useState<TranslationView | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | undefined>();
  const [translationSkipped, setTranslationSkipped] = useState(false);
  const translationRequestTokenRef = useRef(0);
  const [selectionTranslation, setSelectionTranslation] = useState<SelectionTranslationState>({
    selectedText: "",
    status: "idle",
  });

  useEffect(() => {
    onThemeChange?.(themeBg);
  }, [onThemeChange, themeBg]);

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

  function handleTargetLanguageChange(value: string) {
    setTargetLanguage(value);
    setTranslation(undefined);
    setTranslationError(undefined);
    setTranslationSkipped(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }

  // Reset bilingual state on article change
  useEffect(() => {
    translationRequestTokenRef.current += 1;
    setBilingualOpen(false);
    setTranslation(undefined);
    setTranslationError(undefined);
    setActivePanel(undefined);
    setTags([]);
    setTagInput("");
    setTagStatus(undefined);
    setSearchQuery("");
    setActiveSearchIndex(0);
    setShareStatus(undefined);
    setTranslationSkipped(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }, [article?.id]);

  useEffect(() => {
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }, [article?.id, bilingualOpen, viewMode]);

  useEffect(() => {
    if (!selectionTranslation.selectedText) {
      return;
    }
    const selectedText = selectionTranslation.selectedText;

    function handleSelectionChange() {
      window.setTimeout(() => {
        const nextText = getReaderSelectedText(articleContentRef.current);
        if (nextText !== selectedText) {
          setSelectionTranslation({ selectedText: "", status: "idle" });
        }
      }, 0);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [selectionTranslation.selectedText]);

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

  const copyMarkdown = useMemo(
    () => markdownForCopy(markdown),
    [markdown],
  );

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
      startSourceIframe();
    }
    if (viewMode === "compare" && article?.url) {
      startCompareIframe();
    }

    return () => {
      clearTimeout(sourceTimerRef.current);
      clearTimeout(compareTimerRef.current);
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
    setSourceUseRender(false);
    setCompareUseRender(false);
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  function refreshSelectionPopover() {
    window.setTimeout(() => {
      if (viewMode !== "markdown" || bilingualOpen) {
        setSelectionTranslation({ selectedText: "", status: "idle" });
        return;
      }
      const selectedText = getReaderSelectedText(articleContentRef.current);
      setSelectionTranslation((current) => {
        if (!selectedText) {
          return { selectedText: "", status: "idle" };
        }
        if (current.selectedText === selectedText && current.status !== "ready") {
          return current;
        }
        return { selectedText, status: "ready" };
      });
    }, 0);
  }

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

    const requestToken = ++translationRequestTokenRef.current;
    setSelectionTranslation({ selectedText: "", status: "idle" });
    const detectionText = `${article.title}\n${markdown}`;
    const detectedLanguage = detectContentLanguage(detectionText);
    const shouldSkipSameLanguage = isSameLanguageTarget(detectedLanguage, targetLanguage);
    setTranslationSkipped(shouldSkipSameLanguage);
    setViewMode("markdown");
    setBilingualOpen(true);
    setTranslationError(undefined);
    setTranslationLoading(false);

    if (shouldSkipSameLanguage) {
      setTranslation(undefined);
      return;
    }

    setTranslation(undefined);

    try {
      setTranslationLoading(true);
      const cached = await getArticleTranslation(article.id, targetLanguage).catch((error) => {
        if (translationRequestTokenRef.current === requestToken) {
          setTranslationError(error instanceof Error ? error.message : String(error));
        }
        return null;
      });

      if (translationRequestTokenRef.current !== requestToken) {
        return;
      }

      if (cached && cached.segments.length > 0 && cached.status !== "failed") {
        setTranslation(cached);
        return;
      }

      const result = await startTranslation({
        articleId: article.id,
        targetLanguage,
      }, (view) => {
        if (translationRequestTokenRef.current !== requestToken) {
          return;
        }
        setTranslation(view);
        setTranslationError(undefined);
      });

      if (translationRequestTokenRef.current !== requestToken) {
        return;
      }
      setTranslation(result);
      setTranslationError(undefined);
    } catch (error) {
      if (translationRequestTokenRef.current !== requestToken) {
        return;
      }
      setTranslationError(error instanceof Error ? error.message : String(error));
    } finally {
      if (translationRequestTokenRef.current === requestToken) {
        setTranslationLoading(false);
      }
    }
  }

  async function handleTranslateSelection() {
    if (!article?.id || !selectionTranslation.selectedText) {
      return;
    }

    const selectedText = selectionTranslation.selectedText;
    const detectedLanguage = detectContentLanguage(selectedText);
    const shouldSkipSameLanguage = isSameLanguageTarget(detectedLanguage, targetLanguage);
    const notice = translationLanguageNotice(detectedLanguage, targetLanguage, shouldSkipSameLanguage);

    if (shouldSkipSameLanguage) {
      setSelectionTranslation({
        selectedText,
        status: "skipped",
        message: notice,
      });
      return;
    }

    setSelectionTranslation({
      selectedText,
      status: "loading",
      message: notice,
    });

    try {
      const result = await startTranslation({
        articleId: article.id,
        targetLanguage,
        selectedText,
      });
      const translatedText = selectionTranslationText(result);
      setSelectionTranslation({
        selectedText,
        status: "result",
        message: notice,
        translatedText: translatedText || "No translation returned.",
      });
    } catch (error) {
      setSelectionTranslation({
        selectedText,
        status: "error",
        message: notice,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
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

  function showTagStatus(message: string, durationMs = 1000) {
    clearTimeout(tagStatusTimerRef.current);
    setTagStatus(message);
    tagStatusTimerRef.current = setTimeout(() => {
      setTagStatus(undefined);
    }, durationMs);
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
      showTagStatus("Saved");
      onTagsChanged?.();
    } catch (error) {
      clearTimeout(tagStatusTimerRef.current);
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
      showTagStatus("Removed");
      onTagsChanged?.();
    } catch (error) {
      clearTimeout(tagStatusTimerRef.current);
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

  function startSourceIframe() {
    setSourceUseRender(false);
    sourceIframeLoaded.current = false;
    setSourceIframeError(false);
    clearTimeout(sourceTimerRef.current);
        sourceTimerRef.current = window.setTimeout(() => {
      if (!sourceIframeLoaded.current) {
        if (!sourceUseRender) {
          // Try /api/render fallback
          setSourceUseRender(true);
          sourceIframeLoaded.current = false;
          clearTimeout(sourceTimerRef.current);
          sourceTimerRef.current = window.setTimeout(() => {
            if (!sourceIframeLoaded.current) {
              setSourceIframeError(true);
            }
          }, 15000);
        } else {
          setSourceIframeError(true);
        }
      }
    }, 8000);
  }

  function startCompareIframe() {
    compareIframeLoaded.current = false;
    setCompareIframeError(false);
    clearTimeout(compareTimerRef.current);
    compareTimerRef.current = window.setTimeout(() => {
      if (!compareIframeLoaded.current) {
        setCompareIframeError(true);
      }
    }, 12000);
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
        targetLanguage={targetLanguage}
        onTargetLanguageChange={handleTargetLanguageChange}
        onTranslate={() => undefined}
        onOpenAiSettings={onOpenAiSettings}
        shareStatus={shareStatus}
          onShareStatusChange={setShareStatus}
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
        onTargetLanguageChange={handleTargetLanguageChange}
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
        article={article}
        shareStatus={shareStatus}
        onShareStatusChange={setShareStatus}
        shareMarkdown={copyMarkdown}
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
          onAiTagsApplied={setTags}
          onTagsChanged={onTagsChanged}
          onDeleteTag={(tagId) => void handleDeleteTag(tagId)}
          onNoteChange={setNoteContent}
          onSaveNote={() => void handleSaveNote()}
        />
      ) : null}
      {viewMode === "markdown" ? (
        <div className="reader-themed-page" data-theme={themeBg} data-font-size={fontSize}>
          <SelectionTranslationPanel
            selectionTranslation={selectionTranslation}
            translationTargetLanguage={targetLanguage}
            onTranslateSelection={() => void handleTranslateSelection()}
          />
          <ReaderHeader article={article} />
          <div
            ref={articleContentRef}
            onMouseUp={refreshSelectionPopover}
            onKeyUp={refreshSelectionPopover}
          >
            {bilingualOpen ? (
              <BilingualTranslationView
                articleHtml={article.sanitizedHtml}
                translation={translation}
                isLoading={translationLoading}
                errorMessage={translationError}
                showEmptyMessage={!translationSkipped}
                isSelection={false}
              />
            ) : (
              <MarkdownArticle
                markdown={markdown}
                activeSearchIndex={activeSearchIndex}
                searchMatches={searchMatches}
              />
            )}
          </div>
        </div>
      ) : viewMode === "source" ? (
        <div className="reader-web-view">
          <button className="reader-proxy-toggle" type="button" title="Toggle proxy" onClick={() => { setSourceUseRender(v => !v); setSourceIframeError(false); sourceIframeLoaded.current = false; }}>
            <RefreshCw size={18} />
          </button>
          {sourceIframeError ? (
            <OriginalPageFallback url={article.url} onRetryProxy={() => { setSourceUseRender(true); setSourceIframeError(false); sourceIframeLoaded.current = false; }} />
          ) : (
            <iframe
              className="reader-iframe"
              src={sourceUseRender ? getRenderUrl(article.url) : article.url}
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
            <button className="reader-proxy-toggle" type="button" title="Toggle proxy" onClick={() => { setCompareUseRender(v => !v); setCompareIframeError(false); compareIframeLoaded.current = false; }}>
              <RefreshCw size={18} />
            </button>
            {compareIframeError ? (
              <OriginalPageFallback url={article.url} onRetryProxy={() => { setCompareUseRender(true); setCompareIframeError(false); compareIframeLoaded.current = false; }} />
            ) : (
              <iframe
                className="reader-iframe"
                src={compareUseRender ? getRenderUrl(article.url) : article.url}
                style={{}}
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
  onAiTagsApplied: (tags: ArticleTag[]) => void;
  onTagsChanged?: () => void;
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
  onAiTagsApplied,
  onTagsChanged,
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
          <TaggingPanel
            articleId={articleId}
            onApplied={onAiTagsApplied}
            onTagsChanged={onTagsChanged}
          />
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
  article?: ArticleDetail;
  shareStatus?: string;
  onShareStatusChange?: (status: string | undefined) => void;
  shareMarkdown?: string;
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
  article,
  shareStatus,
  onShareStatusChange,
  shareMarkdown = "",
}: ReaderToolbarProps) {
  const themePanelRef = useRef<HTMLDivElement>(null);
  const sharePanelRef = useRef<HTMLDivElement>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
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

  useEffect(() => {
    if (!showSharePanel) return;
    function handleClick(e: MouseEvent) {
      if (sharePanelRef.current && !sharePanelRef.current.contains(e.target as Node)) {
        setShowSharePanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSharePanel]);

  async function handleCopyShare(value: string, status: string) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      onShareStatusChange?.(status);
      window.setTimeout(() => onShareStatusChange?.(undefined), 1500);
    } catch (error) {
      onShareStatusChange?.(error instanceof Error ? error.message : "Copy failed");
    }
  }

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
        {onTargetLanguageChange ? (
          <select
            className="translation-lang-select"
            value={targetLanguage}
            onChange={(event) => onTargetLanguageChange(event.target.value)}
            disabled={translateDisabled}
            aria-label="Translation language"
          >
            {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        ) : null}
        <button
          className={`tool-button${bilingualOpen ? " active" : ""}`}
          type="button"
          title={bilingualOpen ? "Show original" : "Translate article"}
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
        <div className="share-tool" ref={sharePanelRef}>
          <button
            className={`tool-button${showSharePanel ? " active" : ""}`}
            type="button"
            title="Share"
            disabled={!article}
            onClick={() => setShowSharePanel((current) => !current)}
          >
            <Share2 size={17} />
          </button>
          {showSharePanel && article ? (
            <div className="share-popover" role="menu" aria-label="Share article">
              <div className="share-popover-header">
                <strong>Share Article</strong>
                <span>{shareStatus ?? "Copy details or open the source."}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyShare(article.url, "Link copied")}
              >
                {shareStatus === "Link copied" ? <Check size={15} /> : <Share2 size={15} />}
                <span>Copy Link</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  void handleCopyShare(
                    shareMarkdown || `[${article.title}](${article.url})`,
                    "Markdown copied",
                  )
                }
              >
                <FileText size={15} />
                <span>Copy Markdown</span>
              </button>
              <a href={article.url} target="_blank" rel="noreferrer" role="menuitem">
                <ExternalLink size={15} />
                <span>Open Original</span>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
              >
                <Share2 size={15} />
                <span>Share to X</span>
              </a>
            </div>
          ) : null}
        </div>
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
