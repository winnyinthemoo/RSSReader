import type { FeedSummary } from "../../../../../shared/feed";
import { formatLastFetchedAt, getFeedStats } from "../utils/feedStats";

interface FeedStatsPanelProps {
  feeds: FeedSummary[];
}

export function FeedStatsPanel({ feeds }: FeedStatsPanelProps) {
  const feedStats = getFeedStats(feeds);
  const lastSyncText = formatLastFetchedAt(feedStats.lastFetchedAt);

  return (
    <div className="feed-stats-panel" aria-label="Feed summary">
      Feeds: {feedStats.feedCount} Entries: {feedStats.articleCount} Unread:{" "}
      {feedStats.unreadCount}, Last Sync: {lastSyncText}
    </div>
  );
}
