import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail, ArticleTag } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { BilingualTranslationView } from "../../ai/components/BilingualTranslationView";
import { SelectionTranslationPanel } from "../../ai/components/SelectionTranslationPanel";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import { getArticleTranslation, startTranslation } from "../../../services/aiService";
import {
  deleteArticleTag,
  exportArticleNote,
  getArticleNote,
  listArticleTags,
  saveArticleNote,
  saveArticleTags,
} from "../../../services/feedService";
import { CompareView } from "./CompareView";
import { MarkdownArticle } from "./MarkdownArticle";
import { OriginalPageView } from "./OriginalPageView";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderSidePanel } from "./ReaderSidePanel";
import { ReaderToolbar } from "./ReaderToolbar";
import type { FontSize, ReaderPanel, SelectionTranslationState, ThemeBg, ViewMode } from "../types";
import { defaultReaderLayoutWidth } from "../types";
import { markdownForCopy, normalizeMarkdown } from "../utils/markdown";
import { buildArticleNoteExport } from "../utils/noteExport";
import { getReaderSelectedText } from "../utils/selection";
import {
  detectContentLanguage,
  isSameLanguageTarget,
  selectionTranslationText,
  translationLanguageNotice,
} from "../utils/translation";

interface ReaderViewProps {
  appLanguage: AppLanguage;
  article?: ArticleDetail;
  isLoading?: boolean;
  onTagsChanged?: () => void;
  onOpenAiSettings?: () => void;
  onThemeChange?: (theme: ThemeBg) => void;
  themeBg: ThemeBg;
  fontSize: FontSize;
  layoutWidth: number;
  onThemeBgChange: (theme: ThemeBg) => void;
  onFontSizeChange: (fontSize: FontSize) => void;
  articleSearchQuery?: string;
  articleSearchResultCount?: number;
  activeArticleSearchIndex?: number;
  articleSearchPending?: boolean;
  onArticleSearchQueryChange?: (value: string) => void;
  onArticleSearchCompositionChange?: (isComposing: boolean) => void;
  onArticleSearchStep?: (direction: 1 | -1) => void;
}

export function ReaderView({
  appLanguage,
  article,
  isLoading = false,
  onTagsChanged,
  onOpenAiSettings,
  onThemeChange,
  themeBg,
  fontSize,
  layoutWidth,
  onThemeBgChange,
  onFontSizeChange,
  articleSearchQuery = "",
  articleSearchResultCount = 0,
  activeArticleSearchIndex = 0,
  articleSearchPending = false,
  onArticleSearchQueryChange,
  onArticleSearchCompositionChange,
  onArticleSearchStep,
}: ReaderViewProps) {
  const text = getAppText(appLanguage);
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

  const [showThemePanel, setShowThemePanel] = useState(false);
  const [activePanel, setActivePanel] = useState<ReaderPanel | undefined>();
  const sidePanelRef = useRef<HTMLElement>(null);
  const tagStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagStatus, setTagStatus] = useState<string | undefined>();
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<string | undefined>();
  const noteLoadedArticleIdRef = useRef<string | undefined>(undefined);
  const noteLastSavedContentRef = useRef("");
  const noteLoadTokenRef = useRef(0);
  const notePendingContentRef = useRef<Map<string, string>>(new Map());
  const noteSaveTokenRef = useRef(0);
  const noteSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [shareStatus, setShareStatus] = useState<string | undefined>();
  const articleContentRef = useRef<HTMLDivElement>(null);
  const markdownRenderTokenRef = useRef(0);
  const [markdown, setMarkdown] = useState("");
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [readerSearchQuery, setReaderSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [readerSearchOpen, setReaderSearchOpen] = useState(false);
  const readerSearchInputRef = useRef<HTMLInputElement>(null);

  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [translation, setTranslation] = useState<TranslationView | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | undefined>();
  const [translationSkipped, setTranslationSkipped] = useState(false);
  const translationRequestTokenRef = useRef(0);
  const selectionTranslationRequestTokenRef = useRef(0);
  const [selectionTranslation, setSelectionTranslation] = useState<SelectionTranslationState>({
    selectedText: "",
    status: "idle",
  });

  const proxyBase = `http://${
    window.location.hostname === "127.0.0.1" ? "127.0.0.1:5181" : window.location.host
  }/api`;
  const renderUrl = article?.url
    ? `${proxyBase}/render?url=${encodeURIComponent(article.url)}`
    : "";

  useEffect(() => {
    onThemeChange?.(themeBg);
  }, [themeBg]);

  const readerLayoutStyle = {
    "--reader-layout-width": `${layoutWidth || defaultReaderLayoutWidth}px`,
  } as CSSProperties;

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

  useEffect(() => {
    translationRequestTokenRef.current += 1;
    selectionTranslationRequestTokenRef.current += 1;
    setBilingualOpen(false);
    setTranslation(undefined);
    setTranslationLoading(false);
    setTranslationError(undefined);
    setActivePanel(undefined);
    setTags([]);
    setTagInput("");
    setTagStatus(undefined);
    setShareStatus(undefined);
    setTranslationSkipped(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }, [article?.id]);

  useEffect(() => {
    selectionTranslationRequestTokenRef.current += 1;
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
          selectionTranslationRequestTokenRef.current += 1;
          setSelectionTranslation({ selectedText: "", status: "idle" });
        }
      }, 0);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [selectionTranslation.selectedText]);

  useEffect(() => {
    if (bilingualOpen && article?.id) {
      void loadCachedTranslation();
    }
  }, [bilingualOpen, loadCachedTranslation, article?.id, targetLanguage]);

  useEffect(() => {
    const html = article?.sanitizedHtml ?? "";
    const token = ++markdownRenderTokenRef.current;
    setMarkdown("");
    setMarkdownLoading(Boolean(html));

    if (!html) {
      setMarkdownLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const nextMarkdown = normalizeMarkdown(html);
      if (markdownRenderTokenRef.current === token) {
        setMarkdown(nextMarkdown);
        setMarkdownLoading(false);
      }
    }, 20);

    return () => window.clearTimeout(timer);
  }, [article?.id, article?.sanitizedHtml]);

  const copyMarkdown = useMemo(() => markdownForCopy(markdown), [markdown]);
  const readerSearchMatches = useMemo(
    () => findTextMatches(markdown, readerSearchQuery),
    [markdown, readerSearchQuery],
  );

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [article?.id]);

  useEffect(() => {
    if (readerSearchMatches.length === 0) {
      setActiveSearchIndex(0);
      return;
    }

    setActiveSearchIndex((currentIndex) =>
      Math.min(currentIndex, readerSearchMatches.length - 1),
    );
  }, [readerSearchMatches.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTypingTarget) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        if (viewMode === "source") {
          setViewMode("markdown");
        }
        setReaderSearchOpen(true);
        window.setTimeout(() => readerSearchInputRef.current?.focus(), 0);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode]);

  useEffect(() => {
    if (readerSearchOpen) {
      window.setTimeout(() => readerSearchInputRef.current?.focus(), 0);
    }
  }, [readerSearchOpen]);

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

    function handleOutsideClick(event: globalThis.MouseEvent) {
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

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!compareRef.current) return;
      const rect = compareRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
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

  function handleTargetLanguageChange(value: string) {
    selectionTranslationRequestTokenRef.current += 1;
    setTargetLanguage(value);
    setTranslation(undefined);
    setTranslationError(undefined);
    setTranslationSkipped(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    if (mode !== "markdown") {
      setBilingualOpen(false);
    }
    sourceIframeLoaded.current = false;
    compareIframeLoaded.current = false;
    setSourceIframeError(false);
    setCompareIframeError(false);
    setSourceUseRender(false);
    setCompareUseRender(false);
  }

  function handleReaderSearchQueryChange(value: string) {
    setReaderSearchQuery(value);
    setActiveSearchIndex(0);
  }

  function handleReaderSearchStep(direction: 1 | -1) {
    if (readerSearchMatches.length === 0) {
      return;
    }

    if (viewMode === "source") {
      setViewMode("markdown");
    }

    setActiveSearchIndex(
      (currentIndex) =>
        (currentIndex + direction + readerSearchMatches.length) % readerSearchMatches.length,
    );
  }

  function handleCloseReaderSearch() {
    setReaderSearchOpen(false);
    setReaderSearchQuery("");
    setActiveSearchIndex(0);
  }

  function handleDividerMouseDown(event: ReactMouseEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

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

  async function runArticleTranslation(forceRefresh = false) {
    if (!article?.id) {
      return;
    }

    const requestToken = ++translationRequestTokenRef.current;
    setSelectionTranslation({ selectedText: "", status: "idle" });
    const detectionText = `${article.title}\n${
      markdown || article.sanitizedHtml.replace(/<[^>]+>/g, " ")
    }`;
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

      if (!forceRefresh) {
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
      }

      const result = await startTranslation(
        {
          articleId: article.id,
          targetLanguage,
        },
        (view) => {
          if (translationRequestTokenRef.current !== requestToken) {
            return;
          }
          setTranslation(view);
          setTranslationError(undefined);
        },
      );

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

  async function handleTranslate() {
    if (!article?.id) {
      return;
    }

    if (bilingualOpen) {
      setBilingualOpen(false);
      return;
    }

    await runArticleTranslation(false);
  }

  async function handleRetryTranslation() {
    if (!article?.id || !bilingualOpen || translationSkipped) {
      return;
    }

    await runArticleTranslation(true);
  }

  async function handleTranslateSelection() {
    if (!article?.id || !selectionTranslation.selectedText) {
      return;
    }

    const selectedText = selectionTranslation.selectedText;
    const requestToken = ++selectionTranslationRequestTokenRef.current;
    const detectedLanguage = detectContentLanguage(selectedText);
    const shouldSkipSameLanguage = isSameLanguageTarget(detectedLanguage, targetLanguage);
    const notice = translationLanguageNotice(
      detectedLanguage,
      targetLanguage,
      shouldSkipSameLanguage,
    );

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
      if (selectionTranslationRequestTokenRef.current !== requestToken) {
        return;
      }
      const translatedText = selectionTranslationText(result);
      setSelectionTranslation({
        selectedText,
        status: "result",
        message: notice,
        translatedText: translatedText || text.reader.noTranslationReturned,
      });
    } catch (error) {
      if (selectionTranslationRequestTokenRef.current !== requestToken) {
        return;
      }
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
      showTagStatus(text.common.saved);
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
      showTagStatus(text.reader.removed);
      onTagsChanged?.();
    } catch (error) {
      clearTimeout(tagStatusTimerRef.current);
      setTagStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadArticleNote(articleId: string) {
    const loadToken = ++noteLoadTokenRef.current;
    try {
      const note = await getArticleNote(articleId);
      if (noteLoadTokenRef.current !== loadToken) {
        return;
      }

      const savedContent = note?.content ?? "";
      const pendingContent = notePendingContentRef.current.get(articleId);
      const content = pendingContent ?? savedContent;
      noteLoadedArticleIdRef.current = articleId;
      noteLastSavedContentRef.current = savedContent;
      setNoteContent(content);
      setNoteStatus(pendingContent ? text.reader.saving : undefined);
    } catch (error) {
      if (noteLoadTokenRef.current !== loadToken) {
        return;
      }

      setNoteStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function handleNoteChange(value: string) {
    setNoteContent(value);

    const articleId = noteLoadedArticleIdRef.current;
    if (!articleId || articleId !== article?.id) {
      return;
    }

    const existingTimer = noteSaveTimersRef.current.get(articleId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      noteSaveTimersRef.current.delete(articleId);
    }

    if (value === noteLastSavedContentRef.current) {
      setNoteStatus(undefined);
      return;
    }

    setNoteStatus(text.reader.saving);
    notePendingContentRef.current.set(articleId, value);
    const saveToken = ++noteSaveTokenRef.current;
    const timerId = window.setTimeout(() => {
      noteSaveTimersRef.current.delete(articleId);
      void saveArticleNote({ articleId, content: value })
        .then(() => {
          if (noteSaveTokenRef.current !== saveToken || noteLoadedArticleIdRef.current !== articleId) {
            return;
          }
          if (notePendingContentRef.current.get(articleId) === value) {
            notePendingContentRef.current.delete(articleId);
          }
          noteLastSavedContentRef.current = value;
          setNoteStatus(text.common.saved);
        })
        .catch((error) => {
          if (noteSaveTokenRef.current !== saveToken || noteLoadedArticleIdRef.current !== articleId) {
            return;
          }
          setNoteStatus(error instanceof Error ? error.message : String(error));
        });
    }, 700);
    noteSaveTimersRef.current.set(articleId, timerId);
  }

  async function handleShareNote() {
    if (!article) {
      return;
    }

    try {
      const request = buildArticleNoteExport(article, noteContent, appLanguage);
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Note: ${article.title}`,
            text: request.content,
            url: article.url,
          });
          setNoteStatus(text.reader.shared);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setNoteStatus(text.reader.shareCanceled);
            return;
          }
        }
      }

      await navigator.clipboard.writeText(request.content);
      setNoteStatus(text.reader.copiedForSharing);
    } catch (error) {
      setNoteStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExportNote() {
    if (!article) {
      return;
    }

    try {
      const result = await exportArticleNote(
        buildArticleNoteExport(article, noteContent, appLanguage),
      );
      setNoteStatus(result.saved ? text.reader.exported : text.reader.exportCanceled);
    } catch (error) {
      setNoteStatus(error instanceof Error ? error.message : String(error));
    }
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

  const toolbar = (
    <ReaderToolbar
      appLanguage={appLanguage}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      showThemePanel={showThemePanel}
      onToggleThemePanel={() => setShowThemePanel((value) => !value)}
      themeBg={themeBg}
      onThemeBgChange={onThemeBgChange}
      fontSize={fontSize}
      onFontSizeChange={onFontSizeChange}
      bilingualOpen={bilingualOpen}
      targetLanguage={targetLanguage}
      onTargetLanguageChange={handleTargetLanguageChange}
      onTranslate={() => void handleTranslate()}
      onRetryTranslation={() => void handleRetryTranslation()}
      translateDisabled={translationLoading}
      activePanel={activePanel}
      searchQuery={articleSearchQuery}
      searchMatchCount={articleSearchResultCount}
      activeSearchIndex={activeArticleSearchIndex}
      searchPending={articleSearchPending}
      onTogglePanel={handleToggleReaderPanel}
      onSearchQueryChange={onArticleSearchQueryChange}
      onSearchCompositionChange={onArticleSearchCompositionChange}
      onSearchStep={onArticleSearchStep}
      onOpenAiSettings={onOpenAiSettings}
      article={article}
      shareStatus={shareStatus}
      onShareStatusChange={setShareStatus}
      shareMarkdown={copyMarkdown}
    />
  );

  if (!article) {
    return (
      <section className="reader-pane">
        {toolbar}
        <div className="reader-empty">
          <p className="eyebrow">{text.reader.reader}</p>
          <h2>{isLoading ? text.reader.loadingArticle : text.reader.selectArticle}</h2>
          <p>
            {isLoading
              ? text.reader.loadingArticleBody
              : text.reader.selectArticleBody}
          </p>
        </div>
      </section>
    );
  }

  return (
    <article className="reader-pane">
      {toolbar}
      {activePanel ? (
        <ReaderSidePanel
          ref={sidePanelRef}
          appLanguage={appLanguage}
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
          onNoteChange={handleNoteChange}
          onShareNote={() => void handleShareNote()}
          onExportNote={() => void handleExportNote()}
        />
      ) : null}
      {readerSearchOpen ? (
        <div className="reader-find-bar" role="search" aria-label={text.reader.findCurrentArticle}>
          <span>{text.reader.find}</span>
          <input
            ref={readerSearchInputRef}
            value={readerSearchQuery}
            onChange={(event) => handleReaderSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleReaderSearchStep(event.shiftKey ? -1 : 1);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCloseReaderSearch();
              }
            }}
            placeholder={text.reader.currentArticle}
            aria-label={text.reader.findCurrentArticle}
          />
          <span className="reader-find-count">
            {readerSearchQuery.trim()
              ? readerSearchMatches.length > 0
                ? `${Math.min(activeSearchIndex + 1, readerSearchMatches.length)} / ${readerSearchMatches.length}`
                : "0 / 0"
              : ""}
          </span>
          <button
            className="tool-button"
            type="button"
            title={text.reader.previousMatch}
            disabled={readerSearchMatches.length === 0}
            onClick={() => handleReaderSearchStep(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="tool-button"
            type="button"
            title={text.reader.nextMatch}
            disabled={readerSearchMatches.length === 0}
            onClick={() => handleReaderSearchStep(1)}
          >
            <ChevronDown size={15} />
          </button>
          <button
            className="tool-button"
            type="button"
            title={text.reader.closeFind}
            onClick={handleCloseReaderSearch}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {viewMode === "markdown" ? (
        <div
          className="reader-themed-page"
          data-theme={themeBg}
          data-font-size={fontSize}
          style={readerLayoutStyle}
        >
          <SelectionTranslationPanel
            appLanguage={appLanguage}
            selectionTranslation={selectionTranslation}
            translationTargetLanguage={targetLanguage}
            onTranslateSelection={() => void handleTranslateSelection()}
          />
          <ReaderHeader appLanguage={appLanguage} article={article} />
          <div
            ref={articleContentRef}
            onMouseUp={refreshSelectionPopover}
            onKeyUp={refreshSelectionPopover}
          >
            {isLoading ? (
              <div className="reader-content reader-content-md">
                <p className="muted">{text.reader.loadingArticle}...</p>
              </div>
            ) : bilingualOpen ? (
              <BilingualTranslationView
                appLanguage={appLanguage}
                articleHtml={article.sanitizedHtml}
                translation={translation}
                isLoading={translationLoading}
                errorMessage={translationError}
                showEmptyMessage={!translationSkipped}
                isSelection={false}
              />
            ) : markdownLoading ? (
              <div className="reader-content reader-content-md">
                <p className="muted">{text.reader.loadingArticle}...</p>
              </div>
            ) : (
              <MarkdownArticle
                markdown={markdown}
                searchMatches={readerSearchMatches}
                activeSearchIndex={activeSearchIndex}
              />
            )}
          </div>
        </div>
      ) : viewMode === "source" ? (
        <OriginalPageView
          url={article.url}
          iframeError={sourceIframeError}
          useRender={sourceUseRender}
          renderUrl={renderUrl}
          onToggleProxy={() => {
            setSourceUseRender((value) => !value);
            setSourceIframeError(false);
            sourceIframeLoaded.current = false;
          }}
          onRetryProxy={() => {
            setSourceUseRender(true);
            setSourceIframeError(false);
            sourceIframeLoaded.current = false;
          }}
          onLoad={() => {
            sourceIframeLoaded.current = true;
            setSourceIframeError(false);
          }}
        />
      ) : (
        <CompareView
          appLanguage={appLanguage}
          article={article}
          markdown={markdown}
          themeBg={themeBg}
          fontSize={fontSize}
          splitRatio={splitRatio}
          isDragging={isDragging}
          compareRef={compareRef}
          compareIframeError={compareIframeError}
          compareUseRender={compareUseRender}
          renderUrl={renderUrl}
          searchMatches={readerSearchMatches}
          activeSearchIndex={activeSearchIndex}
          onDividerMouseDown={handleDividerMouseDown}
          onToggleProxy={() => {
            setCompareUseRender((value) => !value);
            setCompareIframeError(false);
            compareIframeLoaded.current = false;
          }}
          onRetryProxy={() => {
            setCompareUseRender(true);
            setCompareIframeError(false);
            compareIframeLoaded.current = false;
          }}
          onIframeLoad={() => {
            compareIframeLoaded.current = true;
            setCompareIframeError(false);
          }}
        />
      )}
      <SummaryPanel articleId={article.id} />
    </article>
  );
}

function findTextMatches(markdown: string, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return [];
  }

  const haystack = markdown.toLocaleLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let startIndex = 0;

  while (startIndex < haystack.length) {
    const matchIndex = haystack.indexOf(needle, startIndex);
    if (matchIndex === -1) {
      break;
    }

    matches.push({ start: matchIndex, end: matchIndex + needle.length });
    startIndex = matchIndex + needle.length;
  }

  return matches;
}
