import { Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

import vortexLogo from "../../../assets/vortex-logo.png";
import type { FeedSummary } from "../../../../../shared/feed";

interface FeedSidebarProps {
  feeds: FeedSummary[];
  selectedFeedId?: string;
  isAdding: boolean;
  isRefreshing: boolean;
  isDeleting: boolean;
  onSelectFeed: (feedId?: string) => void;
  onAddFeed: (url: string) => Promise<void>;
  onRefreshFeed: (feedId: string) => Promise<void>;
  onDeleteFeed: (feedId: string) => Promise<void>;
}

export function FeedSidebar({
  feeds,
  selectedFeedId,
  isAdding,
  isRefreshing,
  isDeleting,
  onSelectFeed,
  onAddFeed,
  onRefreshFeed,
  onDeleteFeed,
}: FeedSidebarProps) {
  const [url, setUrl] = useState("");
  const [formHint, setFormHint] = useState<string | undefined>();
  const urlInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) {
      setFormHint("请先在左侧输入框填写 RSS/Atom 地址，再点 + 或按 Enter。");
      urlInputRef.current?.focus();
      return;
    }

    setFormHint(undefined);
    await onAddFeed(url.trim());
    setUrl("");
  }

  const totalUnread = feeds.reduce((total, feed) => total + feed.unreadCount, 0);

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

      <form className="feed-form" onSubmit={handleSubmit}>
        <input
          ref={urlInputRef}
          aria-label="Feed URL"
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
        <button type="submit" title="Add feed" disabled={isAdding}>
          <Plus size={18} />
        </button>
      </form>
      {formHint ? <p className="feed-form-hint">{formHint}</p> : null}

      <button
        className={`feed-item all-feeds ${selectedFeedId ? "" : "selected"}`}
        type="button"
        onClick={() => onSelectFeed(undefined)}
      >
        <span className="feed-icon">
          <Rss size={18} />
        </span>
        <span className="feed-main">
          <span className="feed-title">All feeds</span>
          <span className="feed-url">Everything local</span>
        </span>
        <span className="unread-count">{totalUnread}</span>
      </button>

      <div className="feed-list">
        {feeds.map((feed) => (
          <div className="feed-item-row" key={feed.id}>
            <button
              className={`feed-item ${selectedFeedId === feed.id ? "selected" : ""}`}
              type="button"
              onClick={() => onSelectFeed(feed.id)}
            >
              <span className="feed-icon">
                <Rss size={18} />
              </span>
              <span className="feed-main">
                <span className="feed-title">{feed.title}</span>
                <span className="feed-url">{feed.siteUrl ?? feed.url}</span>
              </span>
              <span className="unread-count">{feed.unreadCount}</span>
            </button>
            <button
              className="feed-delete-button"
              type="button"
              title="Delete feed"
              disabled={isDeleting}
              onClick={(e) => { e.stopPropagation(); onDeleteFeed(feed.id); }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <button
        className="refresh-button"
        type="button"
        disabled={!selectedFeedId || isRefreshing}
        onClick={() => selectedFeedId && onRefreshFeed(selectedFeedId)}
      >
        <RefreshCw size={17} />
        <span>Refresh selected</span>
      </button>
    </aside>
  );
}
