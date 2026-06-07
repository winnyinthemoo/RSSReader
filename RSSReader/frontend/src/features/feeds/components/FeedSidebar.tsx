import {
  Download,
  FolderOpen,
  Plus,
  RefreshCw,
  Rss,
  Star,
  Tags,
  Trash2,
  X,
  ChevronDown,  // 添加这个
  ChevronUp,  // 添加这个
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import vortexLogo from "../../../assets/vortex-logo.png";
import type { FeedAddRequest, FeedSummary, TagSummary } from "../../../../../shared/feed";

type SidebarMode = "feeds" | "tags";
type SidebarSelection =
  | { type: "all" }
  | { type: "feed"; feedId: string }
  | { type: "starred" }
  | { type: "tag"; tagId: string };

interface FeedSidebarProps {
  feeds: FeedSummary[];
  tags: TagSummary[];
  starredCount: number;
  selection: SidebarSelection;
  mode: SidebarMode;
  isAdding: boolean;
  isRefreshing: boolean;
  isDeleting: boolean;
  onModeChange: (mode: SidebarMode) => void;
  onSelectAll: () => void;
  onSelectFeed: (feedId: string) => void;
  onSelectStarred: () => void;
  onSelectTag: (tagId: string) => void;
  onAddFeed: (request: FeedAddRequest) => Promise<void>;
  onExportOpml: () => void;
  onRefreshFeed: (feedId: string) => Promise<void>;
  onDeleteFeed: (feedId: string) => Promise<void>;
}

export function FeedSidebar({
  feeds,
  tags,
  starredCount,
  selection,
  mode,
  isAdding,
  isRefreshing,
  isDeleting,
  onModeChange,
  onSelectAll,
  onSelectFeed,
  onSelectStarred,
  onSelectTag,
  onAddFeed,
  onExportOpml,
  onRefreshFeed,
  onDeleteFeed,
}: FeedSidebarProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showMoreFeeds, setShowMoreFeeds] = useState(false);
  const FEEDS_TO_SHOW = 4; // 默认显示 4 个
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [formHint, setFormHint] = useState<string | undefined>();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmFeedId, setDeleteConfirmFeedId] = useState<string | null>(null);

  useEffect(() => {
    if (isAddDialogOpen) {
      window.setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [isAddDialogOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();

    if (!trimmedUrl) {
      setFormHint("请输入 RSS/Atom 地址。");
      return;
    }

    setFormHint(undefined);
    await onAddFeed({
      url: trimmedUrl,
      name: trimmedName || undefined,
    });
    setName("");
    setUrl("");
    setIsAddDialogOpen(false);
  }

  function handleCloseDialog() {
    if (isAdding) {
      return;
    }
    setIsAddDialogOpen(false);
    setFormHint(undefined);
  }

  const selectedFeedId = selection.type === "feed" ? selection.feedId : undefined;
  const totalUnread = feeds.reduce((total, feed) => total + feed.unreadCount, 0);
  const addFeedDialog = isAddDialogOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleCloseDialog}>
      <form
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add feed"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Add Feed</h2>
          <button type="button" title="Close" onClick={handleCloseDialog}>
            <X size={17} />
          </button>
        </div>

        <label className="dialog-field">
          <span>Name</span>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional display name"
            disabled={isAdding}
          />
        </label>

        <label className="dialog-field">
          <span>URL</span>
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (formHint) {
                setFormHint(undefined);
              }
            }}
            placeholder="https://example.com/feed.xml"
            disabled={isAdding}
          />
        </label>

        {formHint ? <p className="feed-form-hint">{formHint}</p> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={handleCloseDialog}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={isAdding}>
            Add
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return (
    <aside className="feed-sidebar">
      <div className="pane-header">
        <div className="brand-lockup">
          <img className="brand-logo" src={vortexLogo} alt="Vortex logo" />
          <div className="brand-text">
            <h1>Vortex</h1>
          </div>
        </div>
        <div className="feed-total" aria-label={`${totalUnread} unread articles`}>
          {totalUnread}
        </div>
      </div>

      <div className="sidebar-mode-tabs" role="tablist" aria-label="Sidebar view">
        <button
          className={mode === "feeds" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={mode === "feeds"}
          onClick={() => onModeChange("feeds")}
        >
          <Rss size={16} />
          <span>Feed</span>
        </button>
        <button
          className={mode === "tags" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={mode === "tags"}
          onClick={() => onModeChange("tags")}
        >
          <Tags size={16} />
          <span>Tag</span>
        </button>
      </div>

      <div className="sidebar-actions" aria-label="Feed actions">
        <button type="button" title="Add feed" onClick={() => setIsAddDialogOpen(true)}>
          <Plus size={16} />
        </button>
        <button type="button" title="Export OPML" disabled={feeds.length === 0} onClick={onExportOpml}>
          <Download size={16} />
        </button>
      </div>

      <button
        className={`feed-item all-feeds ${selection.type === "all" ? "selected" : ""}`}
        type="button"
        onClick={onSelectAll}
      >
        <span className="feed-icon">
          <FolderOpen size={18} />
        </span>
        <span className="feed-main">
          <span className="feed-title">All feeds</span>
          <span className="feed-url">Everything local</span>
        </span>
        <span className="unread-count">{totalUnread}</span>
      </button>

      <button
        className={`feed-item starred-feeds ${selection.type === "starred" ? "selected" : ""}`}
        type="button"
        onClick={onSelectStarred}
      >
        <span className="feed-icon starred-icon">
          <Star size={17} fill="currentColor" />
        </span>
        <span className="feed-main">
          <span className="feed-title">Starred</span>
          <span className="feed-url">Saved articles</span>
        </span>
        <span className="unread-count">{starredCount}</span>
      </button>

      {/* 分割线 */}
      <div className="sidebar-divider"></div>

      {/* FEEDS 标题 */}
      <div className="feeds-header">
        <span>FEEDS</span>
      </div>

      {mode === "feeds" ? (
        <div className="feed-list">
          {(showMoreFeeds ? feeds : feeds.slice(0, FEEDS_TO_SHOW)).map((feed) => (
            <div className="feed-item-row" key={feed.id}>
              <button
                className={`feed-item ${selectedFeedId === feed.id ? "selected" : ""}`}
                type="button"
                onClick={() => onSelectFeed(feed.id)}
              >
                <span className="feed-icon-custom">
                  {feed.title.charAt(0).toUpperCase()}
                </span>
                <span className="feed-main">
                  <span className="feed-title">{feed.title}</span>
                </span>
                <span className="unread-count">{feed.unreadCount}</span>
              </button>
              <button
                className="feed-delete-button"
                type="button"
                title="Delete feed"
                disabled={isDeleting}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteConfirmFeedId(feed.id);
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {/* 底部折叠按钮 - 放在 feed-list 内部 */}
          {feeds.length > FEEDS_TO_SHOW && (
            <button 
              className="more-feeds-button" 
              type="button"
              onClick={() => setShowMoreFeeds(!showMoreFeeds)}
            >
              <span>{showMoreFeeds ? "Show less" : "More feeds"}</span>
              {showMoreFeeds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      ) : (
        <div className="feed-list">
          {tags.length === 0 ? (
            <div className="sidebar-empty">No tags yet.</div>
          ) : (
            tags.map((tag) => (
              <button
                className={`feed-item ${selection.type === "tag" && selection.tagId === tag.id ? "selected" : ""}`}
                type="button"
                key={tag.id}
                onClick={() => onSelectTag(tag.id)}
              >
                <span className="feed-icon tag-icon">
                  <Tags size={17} />
                </span>
                <span className="feed-main">
                  <span className="feed-title">{tag.name}</span>
                  <span className="feed-url">Tagged articles</span>
                </span>
                <span className="unread-count">{tag.articleCount}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* 底部折叠按钮
      <button 
        className="more-feeds-button" 
        type="button"
        onClick={() => setShowMoreFeeds(!showMoreFeeds)}
      >
        <span>{showMoreFeeds ? "Show less" : "More feeds"}</span>
        {showMoreFeeds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button> */}

      <button
        className="refresh-button"
        type="button"
        disabled={!selectedFeedId || isRefreshing}
        onClick={() => selectedFeedId && onRefreshFeed(selectedFeedId)}
      >
        <RefreshCw size={17} />
        <span>Refresh selected</span>
      </button>

      {/* 删除确认弹窗 */}
      {deleteConfirmFeedId && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteConfirmFeedId(null)}>
          <div className="add-feed-dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Confirm Delete</h2>
              <button type="button" onClick={() => setDeleteConfirmFeedId(null)}>
                <X size={17} />
              </button>
            </div>
            <div className="confirm-body">
              <p>Are you sure you want to delete &quot;{feeds.find(f => f.id === deleteConfirmFeedId)?.title}&quot;?</p>
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setDeleteConfirmFeedId(null)}>
                Cancel
              </button>
              <button 
                className="primary-button" 
                onClick={() => {
                  if (deleteConfirmFeedId) {
                    onDeleteFeed(deleteConfirmFeedId);
                    setDeleteConfirmFeedId(null);
                  }
                }}
                disabled={isDeleting}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {addFeedDialog ? createPortal(addFeedDialog, document.body) : null}
    </aside>
  );
}
