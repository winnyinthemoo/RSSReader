import type { FeedSummary } from "../../../../../shared/feed";
import { formatLastFetchedAt, getFeedStats } from "../utils/feedStats";

interface FeedStatsPanelProps {
  feeds: FeedSummary[];
  selectedFeed?: FeedSummary;
}

export function FeedStatsPanel({ feeds, selectedFeed }: FeedStatsPanelProps) {
  const feedStats = getFeedStats(feeds, selectedFeed);

  return (
    <div className="feed-stats-panel" aria-label="Feed statistics">
      <div className="feed-stats-header">
        <span className="feed-stats-title">Feed Stats</span>
        <span className="feed-stats-scope" title={feedStats.scope}>
          {feedStats.scope}
        </span>
      </div>
      <div className="feed-stats-grid">
        <span className="feed-stat-label">Articles</span>
        <span className="feed-stat-value">{feedStats.articleCount}</span>
        <span className="feed-stat-label">Unread</span>
        <span className="feed-stat-value">{feedStats.unreadCount}</span>
        <span className="feed-stat-label">Last Sync</span>
        <span className="feed-stat-value">{formatLastFetchedAt(feedStats.lastFetchedAt)}</span>
      </div>
    </div>
  );
}
