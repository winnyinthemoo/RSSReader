import type {
  FeedAddRequest,
  FeedSummary,
  TagMatchMode,
  TagSummary,
} from "../../../../shared/feed";

export type SidebarMode = "feeds" | "tags";
export type FeedSyncMode = "manual" | "launch" | "timer";
export type SidebarSelection =
  | { type: "all" }
  | { type: "feed"; feedId: string }
  | { type: "starred" }
  | { type: "tag"; tagIds: string[]; tagMatch: TagMatchMode };

export interface FeedSidebarProps {
  feeds: FeedSummary[];
  tags: TagSummary[];
  starredCount: number;
  selection: SidebarSelection;
  mode: SidebarMode;
  isAdding: boolean;
  isRefreshing: boolean;
  isDeleting: boolean;
  isImporting: boolean;
  isSyncingAll: boolean;
  syncFeedCount: number;
  syncMode: FeedSyncMode;
  syncIntervalMinutes: number;
  syncStatusText: string;
  nextSyncText?: string;
  onHideSidebar: () => void;
  onModeChange: (mode: SidebarMode) => void;
  onSelectAll: () => void;
  onSelectFeed: (feedId: string) => void;
  onSelectStarred: () => void;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  onTagMatchChange: (mode: TagMatchMode) => void;
  onRenameTag: (tagId: string, name: string) => Promise<void>;
  onMergeTags: (sourceTagId: string, targetTagId: string) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onAddFeed: (request: FeedAddRequest) => Promise<void>;
  onImportOpml: () => void;
  onExportOpml: () => void;
  onSyncModeChange: (mode: FeedSyncMode) => void;
  onSyncIntervalChange: (minutes: number) => void;
  onSyncAllFeeds: () => void;
  onRefreshFeed: (feedId: string) => Promise<void>;
  onRenameFeed: (feedId: string, title: string) => Promise<void>;
  onDeleteFeed: (feedId: string) => Promise<void>;
}
