import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { FeedSummary } from "../../../../../shared/feed";

interface FeedListProps {
  feeds: FeedSummary[];
  selectedFeedId?: string;
  isDeleting: boolean;
  showMoreFeeds: boolean;
  feedsToShow: number;
  onShowMoreFeedsChange: (showMoreFeeds: boolean) => void;
  onSelectFeed: (feedId: string) => void;
  onRenameFeed: (feedId: string, title: string) => Promise<void>;
  onRequestDeleteFeed: (feedId: string) => void;
}

export function FeedList({
  feeds,
  selectedFeedId,
  isDeleting,
  showMoreFeeds,
  feedsToShow,
  onShowMoreFeedsChange,
  onSelectFeed,
  onRenameFeed,
  onRequestDeleteFeed,
}: FeedListProps) {
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameHint, setRenameHint] = useState<string | undefined>();
  const [isRenaming, setIsRenaming] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingFeedId) {
      window.setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 0);
    }
  }, [editingFeedId]);

  function startRename(feed: FeedSummary) {
    setEditingFeedId(feed.id);
    setEditingTitle(feed.title);
    setRenameHint(undefined);
  }

  function cancelRename() {
    if (isRenaming) {
      return;
    }
    setEditingFeedId(null);
    setEditingTitle("");
    setRenameHint(undefined);
  }

  async function submitRename(feed: FeedSummary) {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      setRenameHint("Name cannot be empty.");
      return;
    }
    if (nextTitle === feed.title) {
      cancelRename();
      return;
    }

    try {
      setIsRenaming(true);
      setRenameHint(undefined);
      await onRenameFeed(feed.id, nextTitle);
      setEditingFeedId(null);
      setEditingTitle("");
    } catch (error) {
      setRenameHint(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRenaming(false);
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, feed: FeedSummary) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename(feed);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }

  const visibleFeeds = buildVisibleFeeds(feeds, showMoreFeeds, feedsToShow, selectedFeedId);

  return (
    <div className="feed-list">
      {visibleFeeds.map((feed) => {
        const isEditing = editingFeedId === feed.id;

        return (
          <div className={`feed-item-row ${isEditing ? "editing" : ""}`} key={feed.id}>
            {isEditing ? (
              <div className={`feed-item feed-rename-form ${selectedFeedId === feed.id ? "selected" : ""}`}>
                <span className="feed-icon-custom">{feed.title.charAt(0).toUpperCase()}</span>
                <label className="feed-rename-field">
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    aria-label="Feed name"
                    disabled={isRenaming}
                    onChange={(event) => {
                      setEditingTitle(event.target.value);
                      if (renameHint) {
                        setRenameHint(undefined);
                      }
                    }}
                    onKeyDown={(event) => handleRenameKeyDown(event, feed)}
                  />
                </label>
                <div className="feed-rename-actions">
                  <button
                    className="feed-rename-save"
                    type="button"
                    title="Save feed name"
                    aria-label={`Save ${feed.title} name`}
                    disabled={isRenaming}
                    onClick={() => void submitRename(feed)}
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="feed-rename-cancel"
                    type="button"
                    title="Cancel rename"
                    aria-label={`Cancel renaming ${feed.title}`}
                    disabled={isRenaming}
                    onClick={cancelRename}
                  >
                    <X size={13} />
                  </button>
                </div>
                {renameHint ? <span className="feed-rename-hint">{renameHint}</span> : null}
              </div>
            ) : (
              <>
                <button
                  className={`feed-item ${selectedFeedId === feed.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => onSelectFeed(feed.id)}
                >
                  <span className="feed-icon-custom">{feed.title.charAt(0).toUpperCase()}</span>
                  <span className="feed-main">
                    <span className="feed-title">{feed.title}</span>
                  </span>
                  <span className="unread-count">{feed.unreadCount}</span>
                </button>
                <div className="feed-row-actions">
                  <button
                    className="feed-edit-button"
                    type="button"
                    title="Rename feed"
                    aria-label={`Rename ${feed.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      startRename(feed);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="feed-delete-button"
                    type="button"
                    title="Delete feed"
                    aria-label={`Delete ${feed.title}`}
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDeleteFeed(feed.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {feeds.length > feedsToShow ? (
        <button
          className="more-feeds-button"
          type="button"
          onClick={() => onShowMoreFeedsChange(!showMoreFeeds)}
        >
          <span>{showMoreFeeds ? "Show less" : "More feeds"}</span>
          {showMoreFeeds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      ) : null}
    </div>
  );
}

function buildVisibleFeeds(
  feeds: FeedSummary[],
  showMoreFeeds: boolean,
  feedsToShow: number,
  selectedFeedId?: string,
) {
  if (showMoreFeeds || feeds.length <= feedsToShow) {
    return feeds;
  }

  const visibleFeeds = feeds.slice(0, feedsToShow);
  if (!selectedFeedId || visibleFeeds.some((feed) => feed.id === selectedFeedId)) {
    return visibleFeeds;
  }

  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);
  return selectedFeed ? [...visibleFeeds, selectedFeed] : visibleFeeds;
}
