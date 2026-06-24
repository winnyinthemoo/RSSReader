import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { FeedSummary } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";

interface FeedListProps {
  appLanguage: AppLanguage;
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
  appLanguage,
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
  const text = getAppText(appLanguage);
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
      setRenameHint(text.feedList.nameCannotBeEmpty);
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

  function renderMoreFeedsButton(className = "more-feeds-button") {
    return (
      <button
        className={className}
        type="button"
        onClick={() => onShowMoreFeedsChange(!showMoreFeeds)}
      >
        <span>{showMoreFeeds ? text.feedList.showLess : text.feedList.moreFeeds}</span>
        {showMoreFeeds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    );
  }

  const visibleFeeds = buildVisibleFeeds(feeds, showMoreFeeds, feedsToShow, selectedFeedId);
  const hasOverflowFeeds = feeds.length > feedsToShow;

  return (
    <div className={`feed-list feed-list-with-footer${showMoreFeeds ? " expanded" : ""}`}>
      <div className="feed-list-scroll">
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
                      aria-label={text.feedList.feedName}
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
                      title={text.feedList.saveFeedName}
                      aria-label={`${text.feedList.saveFeedName}: ${feed.title}`}
                      disabled={isRenaming}
                      onClick={() => void submitRename(feed)}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      className="feed-rename-cancel"
                      type="button"
                      title={text.feedList.cancelRename}
                      aria-label={`${text.feedList.cancelRename}: ${feed.title}`}
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
                      title={text.feedList.renameFeed}
                      aria-label={`${text.feedList.renameFeed}: ${feed.title}`}
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
                      title={text.feedList.deleteFeed}
                      aria-label={`${text.feedList.deleteFeed}: ${feed.title}`}
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
        {hasOverflowFeeds && !showMoreFeeds ? renderMoreFeedsButton() : null}
      </div>
      {hasOverflowFeeds && showMoreFeeds ? renderMoreFeedsButton("more-feeds-button feed-collapse-button") : null}
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
