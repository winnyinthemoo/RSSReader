import { Clock, RefreshCw } from "lucide-react";

import type { FeedSyncMode } from "../types";

export const syncModes: Array<{ mode: FeedSyncMode; label: string; title: string }> = [
  { mode: "manual", label: "手动", title: "只在手动触发时同步" },
  { mode: "launch", label: "启动时", title: "打开应用后同步一次" },
  { mode: "timer", label: "定时", title: "按固定时间间隔同步" },
];

export const syncIntervalOptions = [15, 30, 60, 120];

interface SyncPanelProps {
  selectedFeedId?: string;
  syncFeedCount: number;
  syncMode: FeedSyncMode;
  syncIntervalMinutes: number;
  syncStatusText: string;
  nextSyncText?: string;
  isSyncingAll: boolean;
  isRefreshing: boolean;
  onSyncModeChange: (mode: FeedSyncMode) => void;
  onSyncIntervalChange: (minutes: number) => void;
  onSyncAllFeeds: () => void;
  onRefreshFeed: (feedId: string) => Promise<void>;
}

export function SyncPanel({
  selectedFeedId,
  syncFeedCount,
  syncMode,
  syncIntervalMinutes,
  syncStatusText,
  nextSyncText,
  isSyncingAll,
  isRefreshing,
  onSyncModeChange,
  onSyncIntervalChange,
  onSyncAllFeeds,
  onRefreshFeed,
}: SyncPanelProps) {
  return (
    <div className="feed-sync-panel" aria-label="RSS sync controls">
      <div className="feed-sync-header">
        <span className="feed-sync-title">
          <Clock size={14} />
          <span>Sync</span>
        </span>
        <span className="feed-sync-status" aria-live="polite">
          {syncStatusText}
        </span>
      </div>

      <div className="feed-sync-mode" role="tablist" aria-label="RSS sync mode">
        {syncModes.map((item) => (
          <button
            className={syncMode === item.mode ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={syncMode === item.mode}
            title={item.title}
            key={item.mode}
            onClick={() => onSyncModeChange(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {syncMode === "timer" ? (
        <label className="feed-sync-interval">
          <span>Every</span>
          <select
            value={syncIntervalMinutes}
            onChange={(event) => onSyncIntervalChange(Number(event.target.value))}
          >
            {syncIntervalOptions.map((minutes) => (
              <option value={minutes} key={minutes}>
                {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {nextSyncText ? <div className="feed-sync-next">{nextSyncText}</div> : null}

      <div className="feed-sync-actions">
        <button
          className="refresh-button"
          type="button"
          disabled={syncFeedCount === 0 || isSyncingAll || isRefreshing}
          onClick={onSyncAllFeeds}
        >
          <RefreshCw className={isSyncingAll ? "sync-spin" : undefined} size={17} />
          <span>{isSyncingAll ? "Syncing all" : "Sync all"}</span>
        </button>
        <button
          className="feed-sync-secondary-button"
          type="button"
          disabled={!selectedFeedId || isRefreshing || isSyncingAll}
          onClick={() => selectedFeedId && onRefreshFeed(selectedFeedId)}
        >
          <RefreshCw className={isRefreshing ? "sync-spin" : undefined} size={15} />
          <span>Selected</span>
        </button>
      </div>
    </div>
  );
}
