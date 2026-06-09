import { useEffect, useMemo, useRef, useState } from "react";

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
  markArticleFavorite,
  markArticleRead,
  mergeTags,
  renameFeed,
  renameTag,
  refreshFeed,
} from "./services/feedService";
import { getErrorMessage } from "./utils/errors";

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
  const [syncSettings, setSyncSettings] = useFeedSyncSettings();
  const [lastSyncAt, setLastSyncAt] = useState<Date | undefined>();
  const [syncStatusText, setSyncStatusText] = useState("Ready");
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [readerTheme, setReaderTheme] = useState("white");
  const launchSyncStartedRef = useRef(false);
  const initialArticlesLoadedRef = useRef(false);
  const articleListRequestTokenRef = useRef(0);
  const articleSelectionTokenRef = useRef(0);

  const activeFeeds = useMemo(
    () => feeds.filter((feed) => feed.status === "active"),
    [feeds],
  );

  useEffect(() => {
    void loadFeedsTagsAndArticles();
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
    if (
      syncSettings.mode !== "launch" ||
      activeFeeds.length === 0 ||
      launchSyncStartedRef.current
    ) {
      return;
    }

    launchSyncStartedRef.current = true;
    void syncAllFeeds("opening the app");
  }, [syncSettings.mode, activeFeeds.length]);

  useEffect(() => {
    if (syncSettings.mode !== "timer" || activeFeeds.length === 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      void syncAllFeeds("timer");
    }, syncSettings.intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [syncSettings.mode, syncSettings.intervalMinutes, activeFeeds.length]);

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
      const opmlExport = buildFeedsOpmlExport(activeFeeds);
      await exportOpml(opmlExport);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function syncAllFeeds(reason: string) {
    if (isSyncingAll || activeFeeds.length === 0) {
      return;
    }

    try {
      setIsSyncingAll(true);
      setSyncStatusText(`Syncing ${activeFeeds.length} feeds`);
      let failedCount = 0;
      let newArticleCount = 0;

      for (const feed of activeFeeds) {
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
      setSyncStatusText(formatFeedSyncStatus(activeFeeds.length, failedCount, completedAt));
      setErrorMessage(
        formatFeedSyncToast(activeFeeds.length, failedCount, newArticleCount, reason),
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

      await loadFeedsTagsAndArticles();
      setSidebarMode("feeds");
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

    if (mode === "launch" && activeFeeds.length > 0) {
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

  return (
    <main className="app-shell" data-reader-theme={readerTheme}>
      <FeedSidebar
        feeds={activeFeeds}
        tags={tags}
        starredCount={starredCount}
        selection={selection}
        mode={sidebarMode}
        isAdding={isAdding}
        isRefreshing={isRefreshing}
        isDeleting={isDeleting}
        isImporting={isImporting}
        isSyncingAll={isSyncingAll}
        syncFeedCount={activeFeeds.length}
        syncMode={syncSettings.mode}
        syncIntervalMinutes={syncSettings.intervalMinutes}
        syncStatusText={syncStatusText}
        nextSyncText={nextSyncText}
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

