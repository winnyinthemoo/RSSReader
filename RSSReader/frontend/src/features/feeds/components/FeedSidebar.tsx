import { ChevronLeft, Download, FolderOpen, Plus, Rss, Star, Tags, Upload } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import vortexLogo from "../../../assets/vortex-logo.png";
import type { FeedAddRequest, TagSummary } from "../../../../../shared/feed";
import type { FeedSidebarProps } from "../types";
import { AddFeedDialog } from "./AddFeedDialog";
import { DeleteFeedDialog } from "./DeleteFeedDialog";
import { FeedList } from "./FeedList";
import { FeedStatsPanel } from "./FeedStatsPanel";
import { MergeTagDialog } from "./MergeTagDialog";
import { TagWorkspace } from "./TagWorkspace";

const feedsToShow = 4;

export function FeedSidebar({
  feeds,
  tags,
  starredCount,
  selection,
  mode,
  isAdding,
  isDeleting,
  isImporting,
  onHideSidebar,
  onModeChange,
  onSelectAll,
  onSelectFeed,
  onSelectStarred,
  onToggleTag,
  onClearTags,
  onTagMatchChange,
  onRenameTag,
  onMergeTags,
  onDeleteTag,
  onAddFeed,
  onImportOpml,
  onExportOpml,
  onRenameFeed,
  onDeleteFeed,
}: FeedSidebarProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showMoreFeeds, setShowMoreFeeds] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [formHint, setFormHint] = useState<string | undefined>();
  const [tagSearch, setTagSearch] = useState("");
  const [tagSort, setTagSort] = useState<"name" | "count">("count");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmFeedId, setDeleteConfirmFeedId] = useState<string | null>(null);
  const [mergeSourceTagId, setMergeSourceTagId] = useState<string | null>(null);
  const [mergeTargetTagId, setMergeTargetTagId] = useState("");
  const [mergeHint, setMergeHint] = useState<string | undefined>();
  const [isMergingTag, setIsMergingTag] = useState(false);

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
      setFormHint("Please enter an RSS or Atom URL.");
      return;
    }

    setFormHint(undefined);
    const request: FeedAddRequest = {
      url: trimmedUrl,
      name: trimmedName || undefined,
    };
    await onAddFeed(request);
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

  function handleMergeTag(tag: TagSummary) {
    setMergeSourceTagId(tag.id);
    setMergeTargetTagId(tags.find((candidate) => candidate.id !== tag.id)?.id ?? "");
    setMergeHint(undefined);
  }

  function handleCloseMergeDialog() {
    if (isMergingTag) {
      return;
    }
    setMergeSourceTagId(null);
    setMergeTargetTagId("");
    setMergeHint(undefined);
  }

  async function handleConfirmMergeTag() {
    if (!mergeSourceTagId || !mergeTargetTagId || mergeSourceTagId === mergeTargetTagId) {
      setMergeHint("Choose a different target tag.");
      return;
    }

    try {
      setIsMergingTag(true);
      setMergeHint(undefined);
      await onMergeTags(mergeSourceTagId, mergeTargetTagId);
      handleCloseMergeDialog();
    } catch (error) {
      setMergeHint(error instanceof Error ? error.message : String(error));
    } finally {
      setIsMergingTag(false);
    }
  }

  async function handleDeleteTag(tag: TagSummary) {
    if (!window.confirm(`Delete tag "${tag.name}" from all articles?`)) {
      return;
    }

    await onDeleteTag(tag.id);
  }

  const selectedFeedId = selection.type === "feed" ? selection.feedId : undefined;
  const selectedFeed = selectedFeedId
    ? feeds.find((feed) => feed.id === selectedFeedId)
    : undefined;
  const selectedTagIds = selection.type === "tag" ? selection.tagIds : [];
  const selectedTagSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const selectedTags = selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagSummary => Boolean(tag));
  const mergeSourceTag = tags.find((tag) => tag.id === mergeSourceTagId);
  const mergeTargetTags = tags.filter((tag) => tag.id !== mergeSourceTagId);
  const visibleTags = useMemo(() => {
    const normalizedSearch = tagSearch.trim().toLowerCase();
    return tags
      .filter((tag) => tag.name.toLowerCase().includes(normalizedSearch))
      .sort((first, second) => {
        if (tagSort === "count") {
          return second.articleCount - first.articleCount || first.name.localeCompare(second.name);
        }
        return first.name.localeCompare(second.name);
      });
  }, [tagSearch, tagSort, tags]);
  const totalUnread = feeds.reduce((total, feed) => total + feed.unreadCount, 0);
  const deleteConfirmFeed = feeds.find((feed) => feed.id === deleteConfirmFeedId);

  return (
    <aside className="feed-sidebar">
      <div className="pane-header">
        <div className="brand-lockup">
          <img className="brand-logo" src={vortexLogo} alt="Vortex logo" />
          <div className="brand-text">
            <h1>Vortex</h1>
          </div>
        </div>
        <button
          className="sidebar-hide-button"
          type="button"
          aria-label="隐藏侧栏"
          title="隐藏侧栏"
          onClick={onHideSidebar}
        >
          <ChevronLeft size={18} strokeWidth={2.4} />
        </button>
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
        <button type="button" title="Import OPML" disabled={isImporting} onClick={onImportOpml}>
          <Upload size={16} />
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

      <div className="sidebar-divider" />
      <div className="feeds-header">
        <span>FEEDS</span>
      </div>

      {mode === "feeds" ? (
        <FeedList
          feeds={feeds}
          selectedFeedId={selectedFeedId}
          isDeleting={isDeleting}
          showMoreFeeds={showMoreFeeds}
          feedsToShow={feedsToShow}
          onShowMoreFeedsChange={setShowMoreFeeds}
          onSelectFeed={onSelectFeed}
          onRenameFeed={onRenameFeed}
          onRequestDeleteFeed={setDeleteConfirmFeedId}
        />
      ) : (
        <TagWorkspace
          tags={tags}
          visibleTags={visibleTags}
          selectedTagIds={selectedTagIds}
          selectedTags={selectedTags}
          selectedTagSet={selectedTagSet}
          tagSearch={tagSearch}
          tagSort={tagSort}
          tagMatch={selection.type === "tag" ? selection.tagMatch : "any"}
          isTagSelection={selection.type === "tag"}
          onTagSearchChange={setTagSearch}
          onTagSortChange={setTagSort}
          onTagMatchChange={onTagMatchChange}
          onToggleTag={onToggleTag}
          onClearTags={onClearTags}
          onRenameTag={onRenameTag}
          onMergeTag={handleMergeTag}
          onDeleteTag={(tag) => void handleDeleteTag(tag)}
        />
      )}

      <FeedStatsPanel feeds={feeds} selectedFeed={selectedFeed} />

      {deleteConfirmFeedId
        ? createPortal(
            <DeleteFeedDialog
              feedTitle={deleteConfirmFeed?.title}
              isDeleting={isDeleting}
              onClose={() => setDeleteConfirmFeedId(null)}
              onConfirm={() => {
                if (deleteConfirmFeedId) {
                  void onDeleteFeed(deleteConfirmFeedId);
                  setDeleteConfirmFeedId(null);
                }
              }}
            />,
            document.body,
          )
        : null}

      {isAddDialogOpen
        ? createPortal(
            <AddFeedDialog
              name={name}
              url={url}
              formHint={formHint}
              isAdding={isAdding}
              nameInputRef={nameInputRef}
              onSubmit={(event) => void handleSubmit(event)}
              onClose={handleCloseDialog}
              onNameChange={setName}
              onUrlChange={(value) => {
                setUrl(value);
                if (formHint) {
                  setFormHint(undefined);
                }
              }}
            />,
            document.body,
          )
        : null}

      {mergeSourceTag
        ? createPortal(
            <MergeTagDialog
              sourceTag={mergeSourceTag}
              targetTags={mergeTargetTags}
              targetTagId={mergeTargetTagId}
              hint={mergeHint}
              isMerging={isMergingTag}
              onTargetTagChange={(tagId) => {
                setMergeTargetTagId(tagId);
                setMergeHint(undefined);
              }}
              onClose={handleCloseMergeDialog}
              onConfirm={() => void handleConfirmMergeTag()}
            />,
            document.body,
          )
        : null}
    </aside>
  );
}

export type { FeedSyncMode } from "../types";
