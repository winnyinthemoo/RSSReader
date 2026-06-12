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
import { useFeedSyncSettings } from "./features/feeds/hooks/useFeedSyncSettings";
import type { FeedSyncMode, SidebarMode, SidebarSelection } from "./features/feeds/types";
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
const defaultPaneLayout: PaneLayout = {
  sidebarWidth: 330,
  articleWidth: 490,
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
  const [syncStatusText, setSyncStatusText] = useState("Ready");
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [readerTheme, setReaderTheme] = useState("white");
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
        setSyncStatusText(`Imported feed synced: ${refreshResult.feed.title}`);
        return;
      }

      if (event.status === "failed") {
        void loadFeedsOnly();
        setSyncStatusText("One imported feed failed");
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
  }, []);

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
    if (
      syncSettings.mode !== "launch" ||
      feeds.length === 0 ||
      launchSyncStartedRef.current
    ) {
      return;
    }

    launchSyncStartedRef.current = true;
    void syncAllFeeds("opening the app");
  }, [syncSettings.mode, feeds.length]);

  useEffect(() => {
    if (syncSettings.mode !== "timer" || feeds.length === 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      void syncAllFeeds("timer");
    }, syncSettings.intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [syncSettings.mode, syncSettings.intervalMinutes, feeds.length]);

  const nextSyncText = useMemo(() => {
    if (syncSettings.mode !== "timer") {
      return undefined;
    }

    if (!lastSyncAt) {
      return `Every ${formatSyncInterval(syncSettings.intervalMinutes)}`;
    }

    const nextSyncAt = new Date(
      lastSyncAt.getTime() + syncSettings.intervalMinutes * 60 * 1000,
    );
    return `Next ${formatClockTime(nextSyncAt)}`;
  }, [lastSyncAt, syncSettings.intervalMinutes, syncSettings.mode]);

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
      setSyncStatusText(`Syncing ${feeds.length} feeds`);
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
      setSyncStatusText(formatFeedSyncStatus(feeds.length, failedCount, completedAt));
      setErrorMessage(
        formatFeedSyncToast(feeds.length, failedCount, newArticleCount, reason),
      );
    } catch (error) {
      setSyncStatusText("Sync failed");
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
        setSyncStatusText(`Syncing ${result.imported} imported feeds`);
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
    setSyncStatusText(mode === "manual" ? "Manual" : "Ready");

    if (mode === "launch" && feeds.length > 0) {
      void syncAllFeeds("opening the app");
    }
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
    const minReaderWidth = 520;
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
      data-reader-theme={readerTheme}
      ref={appShellRef}
      style={appShellStyle}
    >
      {isSidebarHidden ? (
        <button
          className="sidebar-reveal-button"
          type="button"
          aria-label="显示侧栏"
          title="显示侧栏"
          onClick={() => setIsSidebarHidden(false)}
        >
          <ChevronRight size={18} strokeWidth={2.4} />
        </button>
      ) : (
        <>
          <FeedSidebar
            feeds={feeds}
            tags={tags}
            starredCount={starredCount}
            selection={selection}
            mode={sidebarMode}
            isAdding={isAdding}
            isRefreshing={isRefreshing}
            isDeleting={isDeleting}
            isImporting={isImporting}
            isSyncingAll={isSyncingAll}
            syncFeedCount={feeds.length}
            syncMode={syncSettings.mode}
            syncIntervalMinutes={syncSettings.intervalMinutes}
            syncStatusText={syncStatusText}
            nextSyncText={nextSyncText}
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
            onSyncModeChange={handleSyncModeChange}
            onSyncIntervalChange={handleSyncIntervalChange}
            onSyncAllFeeds={() => void syncAllFeeds("manual sync")}
            onRefreshFeed={handleRefreshFeed}
            onRenameFeed={handleRenameFeed}
            onDeleteFeed={handleDeleteFeed}
          />

          <button
            className="pane-resizer pane-resizer-sidebar"
            type="button"
            aria-label="Resize feed sidebar"
            onPointerDown={(event) => handlePaneResizeStart("sidebar", event)}
          />
        </>
      )}

      <ArticleList
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
        aria-label="Resize article list"
        onPointerDown={(event) => handlePaneResizeStart("article", event)}
      />

      <ReaderView
        article={selectedArticle}
        isLoading={isArticleLoading}
        onTagsChanged={() => void handleTagsChanged()}
        onOpenAiSettings={() => setShowAiSettings(true)}
        onThemeChange={setReaderTheme}
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
        <AiSettingsPage onClose={() => setShowAiSettings(false)} />
      ) : null}
    </main>
  );
}

function readPaneLayout(): PaneLayout {
  try {
    const rawLayout = window.localStorage.getItem(paneLayoutKey);
    if (!rawLayout) {
      return defaultPaneLayout;
    }

    const parsedLayout = JSON.parse(rawLayout) as Partial<PaneLayout>;
    return {
      sidebarWidth: sanitizePaneWidth(parsedLayout.sidebarWidth, defaultPaneLayout.sidebarWidth),
      articleWidth: sanitizePaneWidth(parsedLayout.articleWidth, defaultPaneLayout.articleWidth),
    };
  } catch {
    return defaultPaneLayout;
  }
}

function writePaneLayout(layout: PaneLayout) {
  window.localStorage.setItem(paneLayoutKey, JSON.stringify(layout));
}

function sanitizePaneWidth(width: unknown, fallback: number) {
  return typeof width === "number" && Number.isFinite(width)
    ? clamp(width, 220, 760)
    : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
