import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

import type {
  ArticleDetail,
  ArticleListFilter,
  ArticleListItem,
  FeedAddRequest,
  FeedSummary,
  TagSummary,
} from "../../shared/feed";
import { ArticleList } from "./features/articles/components/ArticleList";
import { FeedSidebar } from "./features/feeds/components/FeedSidebar";
import { AiSettingsPage } from "./features/ai/components/AiSettingsPage";
import { ReaderView } from "./features/reader/components/ReaderView";
import {
  addFeed,
  deleteFeed,
  getArticle,
  listArticles,
  listFeeds,
  listTags,
  markArticleFavorite,
  markArticleRead,
  refreshFeed,
} from "./services/feedService";

type SidebarMode = "feeds" | "tags";
type SidebarSelection =
  | { type: "all" }
  | { type: "feed"; feedId: string }
  | { type: "starred" }
  | { type: "tag"; tagId: string };

interface FloatingPosition {
  x: number;
  y: number;
}

interface AiFabDragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  moved: boolean;
}

const AI_FAB_POSITION_KEY = "rssreader.aiFabPosition";
const AI_FAB_MARGIN = 12;

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
  const [aiFabPosition, setAiFabPosition] = useState<FloatingPosition | undefined>();
  const [isAiFabDragging, setIsAiFabDragging] = useState(false);
  const aiFabDragRef = useRef<AiFabDragState | undefined>(undefined);
  const suppressAiFabClickRef = useRef(false);

  useEffect(() => {
    void loadFeedsTagsAndArticles();
  }, []);

  useEffect(() => {
    const savedPosition = readSavedAiFabPosition();
    if (savedPosition) {
      setAiFabPosition(clampFloatingPosition(savedPosition, 56, 40));
    }
  }, []);

  useEffect(() => {
    function handleResize() {
      setAiFabPosition((currentPosition) =>
        currentPosition ? clampFloatingPosition(currentPosition, 56, 40) : currentPosition,
      );
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  function handleExportOpml() {
    try {
      exportFeedsAsOpml(activeFeeds);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleAiFabPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    aiFabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    setIsAiFabDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleAiFabPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const dragState = aiFabDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > 4) {
      dragState.moved = true;
    }

    const nextPosition = clampFloatingPosition(
      {
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      },
      dragState.width,
      dragState.height,
    );
    setAiFabPosition(nextPosition);
  }

  function handleAiFabPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const dragState = aiFabDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.moved) {
      suppressAiFabClickRef.current = true;
      const rect = event.currentTarget.getBoundingClientRect();
      saveAiFabPosition({ x: rect.left, y: rect.top });
    }

    aiFabDragRef.current = undefined;
    setIsAiFabDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleAiFabClick() {
    if (suppressAiFabClickRef.current) {
      suppressAiFabClickRef.current = false;
      return;
    }
    setShowAiSettings(true);
  }

  return (
    <main className="app-shell">
      <button
        className={`ai-fab${isAiFabDragging ? " dragging" : ""}`}
        type="button"
        title="AI settings"
        style={
          aiFabPosition
            ? { left: aiFabPosition.x, top: aiFabPosition.y, right: "auto", bottom: "auto" }
            : undefined
        }
        onClick={handleAiFabClick}
        onPointerDown={handleAiFabPointerDown}
        onPointerMove={handleAiFabPointerMove}
        onPointerUp={handleAiFabPointerUp}
        onPointerCancel={handleAiFabPointerUp}
      >
        AI
      </button>

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
        onSelectTag={(tagId) => setSelection({ type: "tag", tagId })}
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

      <ReaderView article={selectedArticle} onTagsChanged={() => void handleTagsChanged()} />

      {errorMessage ? <div className="toast" role="alert">{errorMessage}</div> : null}

      {showAiSettings ? (
        <AiSettingsPage onClose={() => setShowAiSettings(false)} />
      ) : null}
    </main>
  );
}

function filterFromSelection(selection: SidebarSelection): ArticleListFilter {
  switch (selection.type) {
    case "feed":
      return { feedId: selection.feedId };
    case "starred":
      return { favoritesOnly: true };
    case "tag":
      return { tagId: selection.tagId };
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

function clampFloatingPosition(
  position: FloatingPosition,
  width: number,
  height: number,
): FloatingPosition {
  return {
    x: clamp(position.x, AI_FAB_MARGIN, window.innerWidth - width - AI_FAB_MARGIN),
    y: clamp(position.y, AI_FAB_MARGIN, window.innerHeight - height - AI_FAB_MARGIN),
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function readSavedAiFabPosition() {
  try {
    const rawValue = window.localStorage.getItem(AI_FAB_POSITION_KEY);
    if (!rawValue) {
      return undefined;
    }
    const value = JSON.parse(rawValue) as Partial<FloatingPosition>;
    if (typeof value.x === "number" && typeof value.y === "number") {
      return value as FloatingPosition;
    }
  } catch {
    window.localStorage.removeItem(AI_FAB_POSITION_KEY);
  }
  return undefined;
}

function saveAiFabPosition(position: FloatingPosition) {
  window.localStorage.setItem(AI_FAB_POSITION_KEY, JSON.stringify(position));
}
