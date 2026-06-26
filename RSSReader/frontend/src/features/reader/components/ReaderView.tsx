import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "lucide-react";

import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail, ArticleTag, TagSummary } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { BilingualTranslationView } from "../../ai/components/BilingualTranslationView";
import { SelectionTranslationPanel } from "../../ai/components/SelectionTranslationPanel";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import { getAiAgentSettings, startTranslation } from "../../../services/aiService";
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
  cancelArticleTranslationTask,
  retryTranslationSegmentTask,
  startArticleTranslationTask,
  subscribeTranslationTask,
  translationTaskKey,
} from "../utils/translationTasks";
import {
  detectContentLanguage,
  isSameLanguageTarget,
  selectionTranslationText,
  translationLanguageNotice,
} from "../utils/translation";

interface ReaderViewProps {
  appLanguage: AppLanguage;
  article?: ArticleDetail;
  availableTags?: TagSummary[];
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
  availableTags = [],
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
  const [openedReaderUrl, setOpenedReaderUrl] = useState<string | undefined>();
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
  const [bilingualSearchMatchCount, setBilingualSearchMatchCount] = useState(0);
  const readerSearchInputRef = useRef<HTMLInputElement>(null);

  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [translation, setTranslation] = useState<TranslationView | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | undefined>();
  const [translationSkipped, setTranslationSkipped] = useState(false);
  const [retryingSegmentIndexes, setRetryingSegmentIndexes] = useState<Set<number>>(() => new Set());
  const openTranslationKeysRef = useRef<Set<string>>(new Set());
  const selectionTranslationRequestTokenRef = useRef(0);
  const [selectionTranslation, setSelectionTranslation] = useState<SelectionTranslationState>({
    selectedText: "",
    status: "idle",
  });

  const proxyBase = `http://${
    window.location.hostname === "127.0.0.1" ? "127.0.0.1:5181" : window.location.host
  }/api`;
  const activeSourceUrl = openedReaderUrl ?? article?.url ?? "";
  const sourceRenderUrl = activeSourceUrl
    ? `${proxyBase}/render?url=${encodeURIComponent(activeSourceUrl)}`
    : "";
  const compareRenderUrl = article?.url
    ? `${proxyBase}/render?url=${encodeURIComponent(article.url)}`
    : "";
  const openedSourceText =
    appLanguage === "zh-Hans"
      ? {
          back: "\u8fd4\u56de\u6587\u7ae0",
          label: "\u6b63\u5728\u9605\u8bfb\u5916\u90e8\u9875\u9762",
        }
      : {
          back: "Back to article",
          label: "Reading external page",
        };

  useEffect(() => {
    onThemeChange?.(themeBg);
  }, [themeBg]);

  const readerLayoutStyle = {
    "--reader-layout-width": `${layoutWidth || defaultReaderLayoutWidth}px`,
  } as CSSProperties;
  useEffect(() => {
    let isActive = true;
    void getAiAgentSettings("translation")
      .then((settings) => {
        const defaultTargetLanguage = settings.translation?.defaultTargetLanguage;
        if (isActive && defaultTargetLanguage) {
          setTargetLanguage(defaultTargetLanguage);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    selectionTranslationRequestTokenRef.current += 1;
    const currentTranslationKey = article?.id
      ? translationTaskKey(article.id, targetLanguage)
      : undefined;
    setBilingualOpen(Boolean(currentTranslationKey && openTranslationKeysRef.current.has(currentTranslationKey)));
    setTranslation(undefined);
    setTranslationLoading(false);
    setTranslationError(undefined);
    setRetryingSegmentIndexes(new Set());
    setActivePanel(undefined);
    setTags([]);
    setTagInput("");
    setTagStatus(undefined);
    setShareStatus(undefined);
    setTranslationSkipped(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
    setOpenedReaderUrl(undefined);
  }, [article?.id, targetLanguage]);

  useEffect(() => {
    selectionTranslationRequestTokenRef.current += 1;
    setSelectionTranslation({ selectedText: "", status: "idle" });
  }, [article?.id, bilingualOpen, viewMode]);
  useEffect(() => {
    if (!article?.id) {
      setTranslation(undefined);
      setTranslationLoading(false);
      setTranslationError(undefined);
      return;
    }

    const currentTranslationKey = translationTaskKey(article.id, targetLanguage);
    return subscribeTranslationTask(article.id, targetLanguage, (snapshot) => {
      setTranslation(snapshot?.translation);
      setTranslationLoading(Boolean(snapshot?.isLoading));
      setTranslationError(snapshot?.errorMessage);
      if (snapshot?.isLoading && openTranslationKeysRef.current.has(currentTranslationKey)) {
        setBilingualOpen(true);
      }
    });
  }, [article?.id, targetLanguage]);

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
  const readerSearchMatchCount = bilingualOpen
    ? bilingualSearchMatchCount
    : readerSearchMatches.length;

  useEffect(() => {
    if (!bilingualOpen || !readerSearchQuery.trim()) {
      setBilingualSearchMatchCount(0);
    }
  }, [bilingualOpen, readerSearchQuery]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [article?.id]);

  useEffect(() => {
    if (readerSearchMatchCount === 0) {
      setActiveSearchIndex(0);
      return;
    }

    setActiveSearchIndex((currentIndex) =>
      Math.min(currentIndex, readerSearchMatchCount - 1),
    );
  }, [readerSearchMatchCount]);

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
    if (viewMode === "source" && activeSourceUrl) {
      startSourceIframe();
    }
    if (viewMode === "compare" && article?.url) {
      startCompareIframe();
    }

    return () => {
      clearTimeout(sourceTimerRef.current);
      clearTimeout(compareTimerRef.current);
    };
  }, [activeSourceUrl, article?.url, viewMode]);

  useEffect(() => {
    if (viewMode !== "source" && openedReaderUrl) {
      setOpenedReaderUrl(undefined);
    }
  }, [openedReaderUrl, viewMode]);

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

  function handleViewModeChange(mode: ViewMode) {
    setOpenedReaderUrl(undefined);
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

  function handleOpenUrlInReader(url: string) {
    if (!url) {
      return;
    }
    setOpenedReaderUrl(url);
    setViewMode("source");
    setBilingualOpen(false);
    setSelectionTranslation({ selectedText: "", status: "idle" });
    sourceIframeLoaded.current = false;
    setSourceIframeError(false);
    setSourceUseRender(false);
  }

  function handleReturnFromOpenedUrl() {
    setOpenedReaderUrl(undefined);
    setViewMode("markdown");
    sourceIframeLoaded.current = false;
    setSourceIframeError(false);
    setSourceUseRender(false);
  }

  function handleArticleContentClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href") ?? "";
    const resolvedUrl = resolveReaderUrl(href, article?.url);
    if (!resolvedUrl || !isWebUrl(resolvedUrl)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    handleOpenUrlInReader(resolvedUrl);
  }

  function handleReaderSearchQueryChange(value: string) {
    setReaderSearchQuery(value);
    setActiveSearchIndex(0);
  }

  function handleReaderSearchStep(direction: 1 | -1) {
    if (readerSearchMatchCount === 0) {
      return;
    }

    if (viewMode === "source") {
      setViewMode("markdown");
    }

    setActiveSearchIndex(
      (currentIndex) =>
        (currentIndex + direction + readerSearchMatchCount) % readerSearchMatchCount,
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

  function runArticleTranslation(forceRefresh = false) {
    if (!article?.id) {
      return;
    }

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

    if (shouldSkipSameLanguage) {
      setTranslation(undefined);
      setTranslationLoading(false);
      return;
    }

    const currentTranslationKey = translationTaskKey(article.id, targetLanguage);
    openTranslationKeysRef.current.add(currentTranslationKey);
    startArticleTranslationTask(
      {
        articleId: article.id,
        targetLanguage,
      },
      { forceRefresh },
    );
  }

  function handleTranslate() {
    if (!article?.id) {
      return;
    }

    const currentTranslationKey = translationTaskKey(article.id, targetLanguage);
    if (translationLoading) {
      cancelArticleTranslationTask(article.id, targetLanguage);
      openTranslationKeysRef.current.delete(currentTranslationKey);
      setBilingualOpen(false);
      setTranslationLoading(false);
      return;
    }

    if (bilingualOpen) {
      openTranslationKeysRef.current.delete(currentTranslationKey);
      setBilingualOpen(false);
      return;
    }

    runArticleTranslation(false);
  }

  function handleRetryTranslation() {
    if (!article?.id || !bilingualOpen || translationSkipped || translationLoading) {
      return;
    }

    runArticleTranslation(true);
  }

  async function handleRetryTranslationSegment(segmentIndex: number) {
    if (!article?.id || translationSkipped || translationLoading) {
      return;
    }

    setRetryingSegmentIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.add(segmentIndex);
      return nextIndexes;
    });

    try {
      const result = await retryTranslationSegmentTask({
        articleId: article.id,
        targetLanguage,
        segmentIndex,
      });
      setTranslation(result);
      setTranslationError(undefined);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingSegmentIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        nextIndexes.delete(segmentIndex);
        return nextIndexes;
      });
    }
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

  async function handleSaveTags(nextTagNames?: string[]) {
    const nextTags =
      nextTagNames ??
      tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

    if (!article?.id || nextTags.length === 0) {
      return;
    }

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
      onTranslate={handleTranslate}
      onRetryTranslation={handleRetryTranslation}
      isTranslating={translationLoading}
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
      onOpenInReader={handleOpenUrlInReader}
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
          availableTags={availableTags}
          tagInput={tagInput}
          tagStatus={tagStatus}
          noteContent={noteContent}
          noteStatus={noteStatus}
          onClose={() => setActivePanel(undefined)}
          onTagInputChange={setTagInput}
          onSaveTags={(nextTags) => void handleSaveTags(nextTags)}
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
              ? readerSearchMatchCount > 0
                ? `${Math.min(activeSearchIndex + 1, readerSearchMatchCount)} / ${readerSearchMatchCount}`
                : "0 / 0"
              : ""}
          </span>
          <button
            className="tool-button"
            type="button"
            title={text.reader.previousMatch}
            disabled={readerSearchMatchCount === 0}
            onClick={() => handleReaderSearchStep(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="tool-button"
            type="button"
            title={text.reader.nextMatch}
            disabled={readerSearchMatchCount === 0}
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
          <ReaderHeader appLanguage={appLanguage} article={article} onOpenOriginal={handleOpenUrlInReader} />
          <div
            ref={articleContentRef}
            onClick={handleArticleContentClick}
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
                retryingSegmentIndexes={retryingSegmentIndexes}
                onRetrySegment={(segmentIndex) => void handleRetryTranslationSegment(segmentIndex)}
                searchQuery={readerSearchQuery}
                activeSearchIndex={activeSearchIndex}
                onSearchMatchCountChange={setBilingualSearchMatchCount}
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
                baseUrl={article.url}
                onOpenLink={handleOpenUrlInReader}
              />
            )}
          </div>
        </div>
      ) : viewMode === "source" ? (
        <div className="reader-source-shell">
          {openedReaderUrl ? (
            <div className="reader-web-return-bar">
              <button className="secondary-button" type="button" onClick={handleReturnFromOpenedUrl}>
                <ArrowLeft size={15} />
                <span>{openedSourceText.back}</span>
              </button>
              <span title={openedReaderUrl}>{`${openedSourceText.label}: ${openedReaderUrl}`}</span>
            </div>
          ) : null}
          <OriginalPageView
          url={activeSourceUrl}
          iframeError={sourceIframeError}
          useRender={sourceUseRender}
          renderUrl={sourceRenderUrl}
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
        </div>
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
          renderUrl={compareRenderUrl}
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
      <SummaryPanel appLanguage={appLanguage} articleId={article.id} />
    </article>
  );
}

function resolveReaderUrl(href: string, baseUrl: string | undefined) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return undefined;
  }

  try {
    return new URL(href, baseUrl || window.location.href).toString();
  } catch {
    return href;
  }
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
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
