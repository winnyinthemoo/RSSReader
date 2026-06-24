import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronRight } from "lucide-react";

import type {
  ArticleDetail,
  ArticleListItem,
  FeedAddRequest,
  FeedSummary,
  TagMatchMode,
  TagSummary,
} from "../../shared/feed";
import { ArticleList } from "./features/articles/components/ArticleList";
import { FeedSidebar } from "./features/feeds/components/FeedSidebar";
import { AiSettingsPage } from "./features/ai/components/AiSettingsPage";
import { ReaderView } from "./features/reader/components/ReaderView";
import type { AppLanguage } from "./i18n";
import { getAppText, normalizeAppLanguage } from "./i18n";
import { useFeedSyncSettings } from "./features/feeds/hooks/useFeedSyncSettings";
import type { FeedSyncMode, SidebarMode, SidebarSelection } from "./features/feeds/types";
import type { FontSize, ThemeBg } from "./features/reader/types";
import { defaultReaderLayoutWidth } from "./features/reader/types";
import { buildArticleFilter } from "./features/feeds/utils/articleFilters";
import { buildFeedsOpmlExport, formatOpmlImportResult } from "./features/feeds/utils/opml";
import {
  reconcileSelectionAfterTagMerge,
  reconcileSelectionAfterTagRemoval,
  upsertFeed,
} from "./features/feeds/utils/selection";
import {
  formatClockTime,
  formatFeedSyncStatus,
  formatFeedSyncToast,
  formatSyncInterval,
} from "./features/feeds/utils/syncText";
import {
  addFeed,
  deleteTag,
  deleteFeed,
  exportOpml,
  getArticle,
  importOpml,
  listArticles,
  listFeeds,
  listTags,
  listenOpmlBackgroundRefresh,
  markArticleFavorite,
  markArticleRead,
  mergeTags,
  renameFeed,
  renameTag,
  refreshFeed,
} from "./services/feedService";
import { getErrorMessage } from "./utils/errors";

interface PaneLayout {
  sidebarWidth: number;
  articleWidth: number;
}

const paneLayoutKey = "vortex.paneLayout";
const readerSettingsKey = "vortex.readerSettings";
const appLanguageKey = "vortex.appLanguage";
const defaultPaneLayout: PaneLayout = {
  sidebarWidth: 330,
  articleWidth: 490,
};

interface ReaderSettings {
  themeBg: ThemeBg;
  fontSize: FontSize;
  layoutWidth: number;
}

const defaultReaderSettings: ReaderSettings = {
  themeBg: "white",
  fontSize: "md",
  layoutWidth: defaultReaderLayoutWidth,
};

export default function App() {
  const [feeds, setFeeds] = useState<FeedSummary[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [starredCount, setStarredCount] = useState(0);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("feeds");
  const [selection, setSelection] = useState<SidebarSelection>({ type: "all" });
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | undefined>();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [articleSearchInput, setArticleSearchInput] = useState("");
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [isArticleSearchComposing, setIsArticleSearchComposing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [syncSettings, setSyncSettings] = useFeedSyncSettings();
  const [paneLayout, setPaneLayout] = useState<PaneLayout>(() => readPaneLayout());
  const [lastSyncAt, setLastSyncAt] = useState<Date | undefined>();
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => readReaderSettings());
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => readAppLanguage());
  const text = getAppText(appLanguage);
  const [syncStatusText, setSyncStatusText] = useState(() => text.app.ready);
  const launchSyncStartedRef = useRef(false);
  const initialArticlesLoadedRef = useRef(false);
  const articleListRequestTokenRef = useRef(0);
  const articleSelectionTokenRef = useRef(0);
  const appShellRef = useRef<HTMLElement>(null);
  const selectionRef = useRef(selection);
  const articleSearchQueryRef = useRef(articleSearchQuery);

  useEffect(() => {
    void loadFeedsTagsAndArticles();
  }, []);

  useEffect(() => {
    selectionRef.current = selection;
    articleSearchQueryRef.current = articleSearchQuery;
  }, [selection, articleSearchQuery]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    void listenOpmlBackgroundRefresh((event) => {
      if (!active) {
        return;
      }

      const refreshResult = event.result;
      if (event.status === "completed" && refreshResult) {
        setFeeds((currentFeeds) => upsertFeed(currentFeeds, refreshResult.feed));
        void loadArticles(selectionRef.current, articleSearchQueryRef.current);
        void refreshTagsAndStarredCount();
        setSyncStatusText(text.app.importedFeedSynced(refreshResult.feed.title));
        return;
      }

      if (event.status === "failed") {
        void loadFeedsOnly();
        setSyncStatusText(text.app.oneImportedFeedFailed);
      }
    }).then((nextUnlisten) => {
      if (!active) {
        nextUnlisten?.();
        return;
      }

      unlisten = nextUnlisten;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [text]);

  useEffect(() => {
    if (!initialArticlesLoadedRef.current) {
      initialArticlesLoadedRef.current = true;
      return;
    }

    void loadArticles(selection, articleSearchQuery);
  }, [selection, articleSearchQuery]);

  useEffect(() => {
    if (isArticleSearchComposing) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setArticleSearchQuery(articleSearchInput);
    }, 450);

    return () => window.clearTimeout(timerId);
  }, [articleSearchInput, isArticleSearchComposing]);

  useEffect(() => {
    writePaneLayout(paneLayout);
  }, [paneLayout]);

  useEffect(() => {
    window.localStorage.setItem(readerSettingsKey, JSON.stringify(readerSettings));
  }, [readerSettings]);

  useEffect(() => {
    window.localStorage.setItem(appLanguageKey, appLanguage);
  }, [appLanguage]);

  useEffect(() => {
    if (
      syncSettings.mode !== "launch" ||
      feeds.length === 0 ||
      launchSyncStartedRef.current
    ) {
      return;
    }

    launchSyncStartedRef.current = true;
    void syncAllFeeds(text.app.syncReasonLaunch);
  }, [syncSettings.mode, feeds.length, text]);

  useEffect(() => {
    if (syncSettings.mode !== "timer" || feeds.length === 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      void syncAllFeeds(text.app.syncReasonTimer);
    }, syncSettings.intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [syncSettings.mode, syncSettings.intervalMinutes, feeds.length, text]);

  const nextSyncText = useMemo(() => {
    if (syncSettings.mode !== "timer") {
      return undefined;
    }

    if (!lastSyncAt) {
      return text.app.every(formatSyncInterval(syncSettings.intervalMinutes));
    }

    const nextSyncAt = new Date(
      lastSyncAt.getTime() + syncSettings.intervalMinutes * 60 * 1000,
    );
    return text.app.next(formatClockTime(nextSyncAt, appLanguage));
  }, [appLanguage, lastSyncAt, syncSettings.intervalMinutes, syncSettings.mode, text]);

  async function loadFeedsTagsAndArticles() {
    try {
      const filter = buildArticleFilter(selection, articleSearchQuery);
      const [feedResult, tagResult, articleResult, starredResult] = await Promise.all([
        listFeeds(),
        listTags(),
        listArticles(filter),
        listArticles({ favoritesOnly: true }),
      ]);

      setFeeds(feedResult.feeds);
      setTags(tagResult.tags);
      setArticles(articleResult.articles);
      setStarredCount(starredResult.articles.length);
      setErrorMessage(undefined);

      if (!selectedArticleId && articleResult.articles[0]) {
        await handleSelectArticle(articleResult.articles[0].id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function loadArticles(nextSelection: SidebarSelection, nextSearchQuery = articleSearchQuery) {
    const requestToken = ++articleListRequestTokenRef.current;
    try {
      const result = await listArticles(buildArticleFilter(nextSelection, nextSearchQuery));
      if (articleListRequestTokenRef.current !== requestToken) {
        return;
      }

      setArticles(result.articles);
      setErrorMessage(undefined);

      if (result.articles.length === 0) {
        setSelectedArticle(undefined);
        setSelectedArticleId(undefined);
        return;
      }

      if (!result.articles.some((article) => article.id === selectedArticleId)) {
        await handleSelectArticle(result.articles[0].id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function loadFeedsOnly() {
    try {
      const feedResult = await listFeeds();
      setFeeds(feedResult.feeds);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function refreshTagsAndStarredCount() {
    try {
      const [tagResult, starredResult] = await Promise.all([
        listTags(),
        listArticles({ favoritesOnly: true }),
      ]);
      setTags(tagResult.tags);
      setStarredCount(starredResult.articles.length);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAddFeed(request: FeedAddRequest) {
    try {
      setIsAdding(true);
      const result = await addFeed(request);
      const nextSelection: SidebarSelection = { type: "feed", feedId: result.feed.id };
      setFeeds((currentFeeds) => upsertFeed(currentFeeds, result.feed));
      setSelection(nextSelection);
      setSidebarMode("feeds");
      if (articleSearchQuery.trim()) {
        await loadArticles(nextSelection, articleSearchQuery);
      } else {
        setArticles(result.articles);
        if (result.articles[0]) {
          await handleSelectArticle(result.articles[0].id);
        }
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRefreshFeed(feedId: string) {
    try {
      setIsRefreshing(true);
      const result = await refreshFeed({ feedId });
      setFeeds((currentFeeds) => upsertFeed(currentFeeds, result.feed));
      const articleResult = await listArticles(buildArticleFilter(selection, articleSearchQuery));
      setArticles(articleResult.articles);
      const nextArticle =
        result.newArticles.find((article) =>
          articleResult.articles.some((listedArticle) => listedArticle.id === article.id),
        ) ??
        (!articleResult.articles.some((article) => article.id === selectedArticleId)
          ? articleResult.articles[0]
          : undefined);
      if (nextArticle) {
        await handleSelectArticle(nextArticle.id);
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSelectArticle(articleId: string) {
    const requestToken = ++articleSelectionTokenRef.current;
    setSelectedArticleId(articleId);
    setIsArticleLoading(true);

    try {
      const article = await getArticle(articleId);
      if (articleSelectionTokenRef.current !== requestToken) {
        return;
      }

      setSelectedArticle({ ...article, isRead: true });
      setSelectedArticleId(article.id);
      setArticles((currentArticles) =>
        currentArticles.map((item) =>
          item.id === article.id ? { ...item, isRead: true } : item,
        ),
      );
      setErrorMessage(undefined);

      if (!article.isRead) {
        try {
          await markArticleRead({ articleId: article.id, isRead: true });
        } catch (error) {
          if (articleSelectionTokenRef.current === requestToken) {
            setErrorMessage(getErrorMessage(error));
          }
        }
      }
    } catch (error) {
      if (articleSelectionTokenRef.current === requestToken) {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (articleSelectionTokenRef.current === requestToken) {
        setIsArticleLoading(false);
      }
    }
  }

  async function handleToggleFavorite(articleId: string, isFavorite: boolean) {
    try {
      await markArticleFavorite({ articleId, isFavorite });
      setArticles((currentArticles) =>
        currentArticles
          .map((article) =>
            article.id === articleId ? { ...article, isFavorite } : article,
          )
          .filter((article) => selection.type !== "starred" || article.isFavorite),
      );
      setStarredCount((count) => Math.max(count + (isFavorite ? 1 : -1), 0));
      setSelectedArticle((currentArticle) =>
        currentArticle?.id === articleId ? { ...currentArticle, isFavorite } : currentArticle,
      );
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteFeed(feedId: string) {
    try {
      setIsDeleting(true);
      await deleteFeed({ feedId });
      const nextSelection: SidebarSelection =
        selection.type === "feed" && selection.feedId === feedId ? { type: "all" } : selection;
      const [feedResult, tagResult, articleResult, starredResult] = await Promise.all([
        listFeeds(),
        listTags(),
        listArticles(buildArticleFilter(nextSelection, articleSearchQuery)),
        listArticles({ favoritesOnly: true }),
      ]);

      setFeeds(feedResult.feeds);
      setTags(tagResult.tags);
      setArticles(articleResult.articles);
      setStarredCount(starredResult.articles.length);
      setSelection(nextSelection);

      if (articleResult.articles.length === 0) {
        setSelectedArticle(undefined);
        setSelectedArticleId(undefined);
      } else if (!articleResult.articles.some((article) => article.id === selectedArticleId)) {
        await handleSelectArticle(articleResult.articles[0].id);
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleTagsChanged() {
    try {
      const tagResult = await listTags();
      setTags(tagResult.tags);

      if (selection.type === "tag") {
        const articleResult = await listArticles(buildArticleFilter(selection, articleSearchQuery));
        setArticles(articleResult.articles);
      }

      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleToggleTag(tagId: string) {
    setSelection((currentSelection) => {
      const currentTagIds = currentSelection.type === "tag" ? currentSelection.tagIds : [];
      const nextTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...currentTagIds, tagId].slice(0, 5);

      if (nextTagIds.length === 0) {
        return { type: "all" };
      }

      return {
        type: "tag",
        tagIds: nextTagIds,
        tagMatch: currentSelection.type === "tag" ? currentSelection.tagMatch : "any",
      };
    });
    setSidebarMode("tags");
  }

  function handleTagMatchChange(tagMatch: TagMatchMode) {
    setSelection((currentSelection) => {
      if (currentSelection.type !== "tag") {
        return currentSelection;
      }

      return { ...currentSelection, tagMatch };
    });
  }

  async function handleRenameTag(tagId: string, name: string) {
    try {
      const tagResult = await renameTag({ tagId, name });
      setTags(tagResult.tags);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  }

  async function handleRenameFeed(feedId: string, title: string) {
    try {
      const result = await renameFeed({ feedId, title });
      const renamedFeed = result.feeds.find((feed) => feed.id === feedId);
      setFeeds(result.feeds);
      if (renamedFeed) {
        setArticles((currentArticles) =>
          currentArticles.map((article) =>
            article.feedId === feedId
              ? { ...article, feedTitle: renamedFeed.title }
              : article,
          ),
        );
        setSelectedArticle((currentArticle) =>
          currentArticle?.feedId === feedId
            ? { ...currentArticle, feedTitle: renamedFeed.title }
            : currentArticle,
        );
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  }

  async function handleMergeTags(sourceTagId: string, targetTagId: string) {
    try {
      const tagResult = await mergeTags({ sourceTagId, targetTagId });
      setTags(tagResult.tags);
      setSelection((currentSelection) =>
        reconcileSelectionAfterTagMerge(currentSelection, sourceTagId, targetTagId),
      );
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      const tagResult = await deleteTag({ tagId });
      setTags(tagResult.tags);
      setSelection((currentSelection) => reconcileSelectionAfterTagRemoval(currentSelection, tagId));
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  }

  async function handleExportOpml() {
    try {
      const opmlExport = buildFeedsOpmlExport(feeds);
      await exportOpml(opmlExport);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function syncAllFeeds(reason: string) {
    if (isSyncingAll || feeds.length === 0) {
      return;
    }

    try {
      setIsSyncingAll(true);
      setSyncStatusText(text.app.syncingFeeds(feeds.length));
      let failedCount = 0;
      let newArticleCount = 0;

      for (const feed of feeds) {
        try {
          const result = await refreshFeed({ feedId: feed.id });
          newArticleCount += result.newArticles.length;
        } catch {
          failedCount += 1;
        }
      }

      await loadFeedsTagsAndArticles();
      const completedAt = new Date();
      setLastSyncAt(completedAt);
      setSyncStatusText(formatFeedSyncStatus(feeds.length, failedCount, completedAt, appLanguage));
      setErrorMessage(
        formatFeedSyncToast(feeds.length, failedCount, newArticleCount, reason, appLanguage),
      );
    } catch (error) {
      setSyncStatusText(text.app.syncFailed);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSyncingAll(false);
    }
  }

  async function handleImportOpml() {
    try {
      setIsImporting(true);
      const result = await importOpml();
      if (!result.selected) {
        setErrorMessage(undefined);
        return;
      }

      const importedFeeds = result.feeds ?? [];
      if (importedFeeds.length > 0) {
        const nextSelection: SidebarSelection = { type: "feed", feedId: importedFeeds[0].id };
        setFeeds((currentFeeds) =>
          importedFeeds.reduce(
            (nextFeeds, feed) => upsertFeed(nextFeeds, feed),
            currentFeeds,
          ),
        );
        setSelection(nextSelection);
        await Promise.all([
          loadFeedsOnly(),
          refreshTagsAndStarredCount(),
          loadArticles(nextSelection, articleSearchQuery),
        ]);
      } else {
        await loadFeedsTagsAndArticles();
      }
      setSidebarMode("feeds");
      if (result.backgroundRefreshStarted) {
        setSyncStatusText(text.app.syncImportedFeeds(result.imported));
      }
      setErrorMessage(formatOpmlImportResult(result));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  function handleSyncModeChange(mode: FeedSyncMode) {
    setSyncSettings((currentSettings) => ({ ...currentSettings, mode }));
    setSyncStatusText(mode === "manual" ? text.app.manual : text.app.ready);

    if (mode === "launch" && feeds.length > 0) {
      void syncAllFeeds(text.app.syncReasonLaunch);
    }
  }

  function handleAppLanguageChange(language: AppLanguage) {
    const nextLanguage = normalizeAppLanguage(language);
    const nextText = getAppText(nextLanguage);
    setAppLanguage(nextLanguage);
    setSyncStatusText(syncSettings.mode === "manual" ? nextText.app.manual : nextText.app.ready);
  }

  function handleSyncIntervalChange(intervalMinutes: number) {
    setSyncSettings((currentSettings) => ({ ...currentSettings, intervalMinutes }));
  }

  function handleArticleSearchQueryChange(value: string) {
    setArticleSearchInput(value);
    if (!value.trim()) {
      setArticleSearchQuery("");
    }
  }

  function handleArticleSearchCompositionChange(isComposing: boolean) {
    setIsArticleSearchComposing(isComposing);
  }

  function handleArticleSearchStep(direction: 1 | -1) {
    if (articleSearchInput.trim() !== articleSearchQuery.trim()) {
      setArticleSearchQuery(articleSearchInput);
      return;
    }

    if (!articleSearchQuery.trim() || articles.length === 0) {
      return;
    }

    const currentIndex = articles.findIndex((article) => article.id === selectedArticleId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : articles.length - 1
        : (currentIndex + direction + articles.length) % articles.length;
    void handleSelectArticle(articles[nextIndex].id);
  }

  const activeArticleSearchIndex = articleSearchQuery.trim()
    ? Math.max(
        articles.findIndex((article) => article.id === selectedArticleId),
        0,
      )
    : 0;
  const isArticleSearchPending =
    isArticleSearchComposing || articleSearchInput.trim() !== articleSearchQuery.trim();
  const selectedFeedIdForSync = selection.type === "feed" ? selection.feedId : undefined;
  const selectedFeedForSync = selectedFeedIdForSync
    ? feeds.find((feed) => feed.id === selectedFeedIdForSync)
    : undefined;

  function handlePaneResizeStart(
    divider: "sidebar" | "article",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();

    const startX = event.clientX;
    const startLayout = paneLayout;
    const shellWidth = appShellRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const minSidebarWidth = 240;
    const minArticleWidth = 320;
    const minReaderWidth = Math.max(520, shellWidth * 0.5);
    const reservedSpace = 44;

    document.body.classList.add("pane-resizing");

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;

      setPaneLayout(() => {
        if (divider === "sidebar") {
          const maxSidebarWidth =
            shellWidth - startLayout.articleWidth - minReaderWidth - reservedSpace;
          return {
            ...startLayout,
            sidebarWidth: clamp(
              startLayout.sidebarWidth + deltaX,
              minSidebarWidth,
              Math.max(minSidebarWidth, maxSidebarWidth),
            ),
          };
        }

        const maxArticleWidth =
          shellWidth - startLayout.sidebarWidth - minReaderWidth - reservedSpace;
        return {
          ...startLayout,
          articleWidth: clamp(
            startLayout.articleWidth + deltaX,
            minArticleWidth,
            Math.max(minArticleWidth, maxArticleWidth),
          ),
        };
      });
    }

    function handlePointerUp() {
      document.body.classList.remove("pane-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  const appShellStyle = {
    "--sidebar-width": `${paneLayout.sidebarWidth}px`,
    "--article-list-width": `${paneLayout.articleWidth}px`,
  } as CSSProperties;

  return (
    <main
      className="app-shell"
      data-sidebar-hidden={isSidebarHidden ? "true" : "false"}
      data-reader-theme={readerSettings.themeBg}
      ref={appShellRef}
      style={appShellStyle}
    >
      {isSidebarHidden ? (
        <button
          className="sidebar-reveal-button"
          type="button"
          aria-label={text.app.showSidebar}
          title={text.app.showSidebar}
          onClick={() => setIsSidebarHidden(false)}
        >
          <ChevronRight size={18} strokeWidth={2.4} />
        </button>
      ) : (
        <>
          <FeedSidebar
            appLanguage={appLanguage}
            feeds={feeds}
            tags={tags}
            starredCount={starredCount}
            selection={selection}
            mode={sidebarMode}
            isAdding={isAdding}
            isDeleting={isDeleting}
            isImporting={isImporting}
            onHideSidebar={() => setIsSidebarHidden(true)}
            onModeChange={setSidebarMode}
            onSelectAll={() => setSelection({ type: "all" })}
            onSelectFeed={(feedId) => setSelection({ type: "feed", feedId })}
            onSelectStarred={() => setSelection({ type: "starred" })}
            onToggleTag={handleToggleTag}
            onClearTags={() => setSelection({ type: "all" })}
            onTagMatchChange={handleTagMatchChange}
            onRenameTag={handleRenameTag}
            onMergeTags={handleMergeTags}
            onDeleteTag={handleDeleteTag}
            onAddFeed={handleAddFeed}
            onImportOpml={handleImportOpml}
            onExportOpml={handleExportOpml}
            onRenameFeed={handleRenameFeed}
            onDeleteFeed={handleDeleteFeed}
          />

          <button
            className="pane-resizer pane-resizer-sidebar"
            type="button"
            aria-label={text.app.resizeFeedSidebar}
            onPointerDown={(event) => handlePaneResizeStart("sidebar", event)}
          />
        </>
      )}

      <ArticleList
        appLanguage={appLanguage}
        articles={articles}
        feeds={feeds}
        tags={tags}
        selectedArticleId={selectedArticleId}
        selection={selection}
        searchQuery={articleSearchQuery}
        onSelectArticle={handleSelectArticle}
        onToggleFavorite={handleToggleFavorite}
      />

      <button
        className="pane-resizer pane-resizer-articles"
        type="button"
        aria-label={text.app.resizeArticleList}
        onPointerDown={(event) => handlePaneResizeStart("article", event)}
      />

      <ReaderView
        appLanguage={appLanguage}
        article={selectedArticle}
        availableTags={tags}
        isLoading={isArticleLoading}
        onTagsChanged={() => void handleTagsChanged()}
        onOpenAiSettings={() => setShowAiSettings(true)}
        onThemeChange={(theme) =>
          setReaderSettings((currentSettings) => ({ ...currentSettings, themeBg: theme }))
        }
        themeBg={readerSettings.themeBg}
        fontSize={readerSettings.fontSize}
        layoutWidth={readerSettings.layoutWidth}
        onThemeBgChange={(themeBg) =>
          setReaderSettings((currentSettings) => ({ ...currentSettings, themeBg }))
        }
        onFontSizeChange={(fontSize) =>
          setReaderSettings((currentSettings) => ({ ...currentSettings, fontSize }))
        }
        articleSearchQuery={articleSearchInput}
        articleSearchResultCount={
          !isArticleSearchPending && articleSearchQuery.trim() ? articles.length : 0
        }
        activeArticleSearchIndex={activeArticleSearchIndex}
        articleSearchPending={isArticleSearchPending}
        onArticleSearchQueryChange={handleArticleSearchQueryChange}
        onArticleSearchCompositionChange={handleArticleSearchCompositionChange}
        onArticleSearchStep={handleArticleSearchStep}
      />

      {errorMessage ? <div className="toast" role="alert">{errorMessage}</div> : null}

      {showAiSettings ? (
        <AiSettingsPage
          onClose={() => setShowAiSettings(false)}
          appLanguage={appLanguage}
          syncMode={syncSettings.mode}
          syncIntervalMinutes={syncSettings.intervalMinutes}
          syncStatusText={syncStatusText}
          nextSyncText={nextSyncText}
          syncFeedCount={feeds.length}
          selectedFeedId={selectedFeedIdForSync}
          selectedFeedTitle={selectedFeedForSync?.title}
          isSyncingAll={isSyncingAll}
          isRefreshing={isRefreshing}
          readerTheme={readerSettings.themeBg}
          readerFontSize={readerSettings.fontSize}
          readerLayoutWidth={readerSettings.layoutWidth}
          onAppLanguageChange={handleAppLanguageChange}
          onSyncModeChange={handleSyncModeChange}
          onSyncIntervalChange={handleSyncIntervalChange}
          onSyncAllFeeds={() => void syncAllFeeds(text.app.syncReasonManual)}
          onRefreshSelectedFeed={(feedId) => void handleRefreshFeed(feedId)}
          onReaderThemeChange={(themeBg) =>
            setReaderSettings((currentSettings) => ({ ...currentSettings, themeBg }))
          }
          onReaderFontSizeChange={(fontSize) =>
            setReaderSettings((currentSettings) => ({ ...currentSettings, fontSize }))
          }
          onReaderLayoutWidthChange={(layoutWidth) =>
            setReaderSettings((currentSettings) => ({ ...currentSettings, layoutWidth }))
          }
        />
      ) : null}
    </main>
  );
}

function readPaneLayout(): PaneLayout {
  try {
    const rawLayout = window.localStorage.getItem(paneLayoutKey);
    if (!rawLayout) {
      return constrainPaneLayout(defaultPaneLayout);
    }

    const parsedLayout = JSON.parse(rawLayout) as Partial<PaneLayout>;
    return constrainPaneLayout({
      sidebarWidth: sanitizePaneWidth(parsedLayout.sidebarWidth, defaultPaneLayout.sidebarWidth, 240),
      articleWidth: sanitizePaneWidth(parsedLayout.articleWidth, defaultPaneLayout.articleWidth, 320),
    });
  } catch {
    return constrainPaneLayout(defaultPaneLayout);
  }
}

function writePaneLayout(layout: PaneLayout) {
  window.localStorage.setItem(paneLayoutKey, JSON.stringify(layout));
}

function readReaderSettings(): ReaderSettings {
  try {
    const rawSettings = window.localStorage.getItem(readerSettingsKey);
    if (!rawSettings) {
      return defaultReaderSettings;
    }

    const parsedSettings = JSON.parse(rawSettings) as Partial<ReaderSettings>;
    const themeBg = isThemeBg(parsedSettings.themeBg)
      ? parsedSettings.themeBg
      : defaultReaderSettings.themeBg;
    const fontSize = isFontSize(parsedSettings.fontSize)
      ? parsedSettings.fontSize
      : defaultReaderSettings.fontSize;
    const layoutWidth =
      typeof parsedSettings.layoutWidth === "number" &&
      readerLayoutWidthOptions.includes(parsedSettings.layoutWidth)
        ? parsedSettings.layoutWidth
        : defaultReaderSettings.layoutWidth;

    return { themeBg, fontSize, layoutWidth };
  } catch {
    return defaultReaderSettings;
  }
}

function readAppLanguage(): AppLanguage {
  const language = window.localStorage.getItem(appLanguageKey);
  return normalizeAppLanguage(language);
}

function sanitizePaneWidth(width: unknown, fallback: number, minWidth = 220) {
  return typeof width === "number" && Number.isFinite(width)
    ? clamp(width, minWidth, 760)
    : fallback;
}

function constrainPaneLayout(layout: PaneLayout): PaneLayout {
  const minSidebarWidth = 240;
  const minArticleWidth = 320;
  const reservedSpace = 52;
  const shellWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  if (!shellWidth) {
    return layout;
  }

  const maxLeftWidth = Math.max(
    minSidebarWidth + minArticleWidth,
    shellWidth * 0.5 - reservedSpace,
  );
  let sidebarWidth = clamp(layout.sidebarWidth, minSidebarWidth, 760);
  let articleWidth = clamp(layout.articleWidth, minArticleWidth, 760);
  let overflow = sidebarWidth + articleWidth - maxLeftWidth;

  if (overflow > 0) {
    const articleShrink = Math.min(overflow, articleWidth - minArticleWidth);
    articleWidth -= articleShrink;
    overflow -= articleShrink;
  }
  if (overflow > 0) {
    const sidebarShrink = Math.min(overflow, sidebarWidth - minSidebarWidth);
    sidebarWidth -= sidebarShrink;
  }

  return { sidebarWidth, articleWidth };
}

const readerLayoutWidthOptions = [680, 760, 820, 900, 1040];

function isThemeBg(value: unknown): value is ThemeBg {
  return value === "white" || value === "sepia" || value === "dark" || value === "green";
}

function isFontSize(value: unknown): value is FontSize {
  return value === "sm" || value === "md" || value === "lg" || value === "xl";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
