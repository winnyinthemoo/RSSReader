import { useEffect, useMemo, useState } from "react";

import type { ArticleDetail, ArticleListItem, FeedSummary } from "../../shared/feed";
import { ArticleList } from "./features/articles/components/ArticleList";
import { FeedSidebar } from "./features/feeds/components/FeedSidebar";
import { ReaderView } from "./features/reader/components/ReaderView";
import {
  addFeed,
  getArticle,
  listArticles,
  listFeeds,
  markArticleRead,
  refreshFeed,
} from "./services/feedService";

export default function App() {
  const [feeds, setFeeds] = useState<FeedSummary[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | undefined>();
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | undefined>();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadFeedsAndArticles();
  }, []);

  useEffect(() => {
    void loadArticles(selectedFeedId);
  }, [selectedFeedId]);

  const activeFeeds = useMemo(
    () => feeds.filter((feed) => feed.status === "active"),
    [feeds],
  );

  async function loadFeedsAndArticles() {
    try {
      const [feedResult, articleResult] = await Promise.all([
        listFeeds(),
        listArticles({ feedId: selectedFeedId }),
      ]);

      setFeeds(feedResult.feeds);
      setArticles(articleResult.articles);
      setErrorMessage(undefined);

      if (!selectedArticleId && articleResult.articles[0]) {
        await handleSelectArticle(articleResult.articles[0].id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function loadArticles(feedId?: string) {
    try {
      const result = await listArticles({ feedId });
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

  async function handleAddFeed(url: string) {
    try {
      setIsAdding(true);
      const result = await addFeed({ url });
      setFeeds((currentFeeds) => upsertFeed(currentFeeds, result.feed));
      setSelectedFeedId(result.feed.id);
      setArticles(result.articles);
      if (result.articles[0]) {
        await handleSelectArticle(result.articles[0].id);
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRefreshFeed(feedId: string) {
    try {
      setIsRefreshing(true);
      const result = await refreshFeed({ feedId });
      setFeeds((currentFeeds) => upsertFeed(currentFeeds, result.feed));
      const articleResult = await listArticles({ feedId: selectedFeedId });
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

  return (
    <main className="app-shell">
      <FeedSidebar
        feeds={activeFeeds}
        selectedFeedId={selectedFeedId}
        isAdding={isAdding}
        isRefreshing={isRefreshing}
        onSelectFeed={setSelectedFeedId}
        onAddFeed={handleAddFeed}
        onRefreshFeed={handleRefreshFeed}
      />

      <ArticleList
        articles={articles}
        feeds={feeds}
        selectedArticleId={selectedArticleId}
        selectedFeedId={selectedFeedId}
        onSelectArticle={handleSelectArticle}
      />

      <ReaderView article={selectedArticle} />

      {errorMessage ? <div className="toast" role="alert">{errorMessage}</div> : null}
    </main>
  );
}

function upsertFeed(feeds: FeedSummary[], nextFeed: FeedSummary) {
  const existingIndex = feeds.findIndex((feed) => feed.id === nextFeed.id);
  if (existingIndex === -1) {
    return [...feeds, nextFeed];
  }

  return feeds.map((feed) => (feed.id === nextFeed.id ? nextFeed : feed));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
