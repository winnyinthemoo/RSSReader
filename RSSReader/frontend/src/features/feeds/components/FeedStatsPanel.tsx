import type { FeedSummary } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { formatLastFetchedAt, getFeedStats } from "../utils/feedStats";

interface FeedStatsPanelProps {
  appLanguage: AppLanguage;
  feeds: FeedSummary[];
}

export function FeedStatsPanel({ appLanguage, feeds }: FeedStatsPanelProps) {
  const text = getAppText(appLanguage);
  const feedStats = getFeedStats(feeds);
  const lastSyncText = formatLastFetchedAt(feedStats.lastFetchedAt, appLanguage);

  return (
    <div className="feed-stats-panel" aria-label={text.feedStats.aria}>
      {text.feedStats.feeds}: {feedStats.feedCount} {text.feedStats.entries}:{" "}
      {feedStats.articleCount} {text.feedStats.unread}: {feedStats.unreadCount},{" "}
      {text.feedStats.lastSync}: {lastSyncText}
    </div>
  );
}
