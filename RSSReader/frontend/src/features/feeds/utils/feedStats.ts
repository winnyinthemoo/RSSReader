import type { FeedSummary } from "../../../../../shared/feed";

export function getFeedStats(feeds: FeedSummary[], selectedFeed?: FeedSummary) {
  if (selectedFeed) {
    return {
      scope: selectedFeed.title,
      articleCount: selectedFeed.articleCount,
      unreadCount: selectedFeed.unreadCount,
      lastFetchedAt: selectedFeed.lastFetchedAt,
    };
  }

  return {
    scope: "All subscriptions",
    articleCount: feeds.reduce((total, feed) => total + feed.articleCount, 0),
    unreadCount: feeds.reduce((total, feed) => total + feed.unreadCount, 0),
    lastFetchedAt: latestFetchedAt(feeds),
  };
}

export function formatLastFetchedAt(value?: string) {
  const date = toFetchedAtDate(value);
  if (!date) {
    return "Never";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function latestFetchedAt(feeds: FeedSummary[]) {
  const newest = feeds
    .map((feed) => toFetchedAtDate(feed.lastFetchedAt))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return newest?.toISOString();
}

function toFetchedAtDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const numericValue = Number(value);
  const date =
    Number.isFinite(numericValue) && value.trim() !== ""
      ? new Date(numericValue * 1000)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}
