import { useEffect, useMemo, useState } from "react";

import type {
  ArticleDetail,
  ArticleListFilter,
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
import {
  addFeed,
  deleteTag,
  deleteFeed,
  getArticle,
  listArticles,
  listFeeds,
  listTags,
  markArticleFavorite,
  markArticleRead,
  mergeTags,
  renameTag,
  refreshFeed,
} from "./services/feedService";

type SidebarMode = "feeds" | "tags";
type SidebarSelection =
  | { type: "all" }
  | { type: "feed"; feedId: string }
  | { type: "starred" }
  | { type: "tag"; tagIds: string[]; tagMatch: TagMatchMode };

export default function App() {
  const [feeds, setFeeds] = useState<FeedSummary[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [starredCount, setStarredCount] = useState(0);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("feeds");
  const [selection, setSelection] = useState<SidebarSelection>({ type: "all" });
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | undefined>();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [readerTheme, setReaderTheme] = useState("white");

  useEffect(() => {
    void loadFeedsTagsAndArticles();
  }, []);

  useEffect(() => {
    void loadArticles(selection);
  }, [selection]);

  const activeFeeds = useMemo(
    () => feeds.filter((feed) => feed.status === "active"),
    [feeds],
  );

  async function loadFeedsTagsAndArticles() {
    try {
      const filter = filterFromSelection(selection);
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

  async function loadArticles(nextSelection: SidebarSelection) {
    try {
      const result = await listArticles(filterFromSelection(nextSelection));
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
      setFeeds((currentFeeds) => upsertFeed(currentFeeds, result.feed));
      setSelection({ type: "feed", feedId: result.feed.id });
      setSidebarMode("feeds");
      setArticles(result.articles);
      if (result.articles[0]) {
        await handleSelectArticle(result.articles[0].id);
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
      const articleResult = await listArticles(filterFromSelection(selection));
      setArticles(articleResult.articles);
      if (result.newArticles[0]) {
        await handleSelectArticle(result.newArticles[0].id);
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSelectArticle(articleId: string) {
    try {
      const article = await getArticle(articleId);
      if (!article.isRead) {
        await markArticleRead({ articleId: article.id, isRead: true });
      }
      setSelectedArticle({ ...article, isRead: true });
      setSelectedArticleId(article.id);
      setArticles((currentArticles) =>
        currentArticles.map((item) =>
          item.id === article.id ? { ...item, isRead: true } : item,
        ),
      );
      setFeeds((currentFeeds) =>
        currentFeeds.map((feed) =>
          feed.id === article.feedId && !article.isRead
            ? { ...feed, unreadCount: Math.max(feed.unreadCount - 1, 0) }
            : feed,
        ),
      );
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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
      setFeeds((currentFeeds) => currentFeeds.filter((feed) => feed.id !== feedId));
      if (selection.type === "feed" && selection.feedId === feedId) {
        setSelection({ type: "all" });
        setSelectedArticle(undefined);
        setSelectedArticleId(undefined);
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
        const articleResult = await listArticles(filterFromSelection(selection));
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

  function handleExportOpml() {
    try {
      exportFeedsAsOpml(activeFeeds);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

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
        onExportOpml={handleExportOpml}
        onRefreshFeed={handleRefreshFeed}
        onDeleteFeed={handleDeleteFeed}
      />

      <ArticleList
        articles={articles}
        feeds={feeds}
        tags={tags}
        selectedArticleId={selectedArticleId}
        selection={selection}
        onSelectArticle={handleSelectArticle}
        onToggleFavorite={handleToggleFavorite}
      />

      <ReaderView
        article={selectedArticle}
        onTagsChanged={() => void handleTagsChanged()}
        onOpenAiSettings={() => setShowAiSettings(true)}
        onThemeChange={setReaderTheme}
      />

      {errorMessage ? <div className="toast" role="alert">{errorMessage}</div> : null}

      {showAiSettings ? (
        <AiSettingsPage onClose={() => setShowAiSettings(false)} />
      ) : null}
    </main>
  );
}

function reconcileSelectionAfterTagRemoval(
  selection: SidebarSelection,
  removedTagId: string,
): SidebarSelection {
  if (selection.type !== "tag") {
    return selection;
  }

  const nextTagIds = selection.tagIds.filter((tagId) => tagId !== removedTagId);
  if (nextTagIds.length === 0) {
    return { type: "all" };
  }

  return { ...selection, tagIds: nextTagIds };
}

function reconcileSelectionAfterTagMerge(
  selection: SidebarSelection,
  sourceTagId: string,
  targetTagId: string,
): SidebarSelection {
  if (selection.type !== "tag") {
    return selection;
  }

  if (!selection.tagIds.includes(sourceTagId) && !selection.tagIds.includes(targetTagId)) {
    return selection;
  }

  const nextTagIds = Array.from(
    new Set(selection.tagIds.map((tagId) => (tagId === sourceTagId ? targetTagId : tagId))),
  );
  if (nextTagIds.length === 0) {
    return { type: "all" };
  }

  return { ...selection, tagIds: nextTagIds };
}

function filterFromSelection(selection: SidebarSelection): ArticleListFilter {
  switch (selection.type) {
    case "feed":
      return { feedId: selection.feedId };
    case "starred":
      return { favoritesOnly: true };
    case "tag":
      return { tagIds: selection.tagIds, tagMatch: selection.tagMatch };
    case "all":
    default:
      return {};
  }
}

function upsertFeed(feeds: FeedSummary[], nextFeed: FeedSummary) {
  const existingIndex = feeds.findIndex((feed) => feed.id === nextFeed.id);
  if (existingIndex === -1) {
    return [...feeds, nextFeed];
  }

  return feeds.map((feed) => (feed.id === nextFeed.id ? nextFeed : feed));
}

function exportFeedsAsOpml(feeds: FeedSummary[]) {
  if (feeds.length === 0) {
    throw new Error("No feeds to export.");
  }

  const now = new Date().toUTCString();
  const outlines = feeds
    .map((feed) => {
      const title = escapeXml(feed.title);
      const xmlUrl = escapeXml(feed.url);
      const htmlUrl = escapeXml(feed.siteUrl ?? feed.url);
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}" />`;
    })
    .join("\n");

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Vortex subscriptions</title>
    <dateCreated>${escapeXml(now)}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;

  const blob = new Blob([opml], { type: "text/x-opml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vortex-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
