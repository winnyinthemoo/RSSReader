import { Check, GitMerge, Pencil, Search, Tags, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { TagMatchMode, TagSummary } from "../../../../../shared/feed";

interface TagWorkspaceProps {
  tags: TagSummary[];
  visibleTags: TagSummary[];
  selectedTagIds: string[];
  selectedTags: TagSummary[];
  selectedTagSet: Set<string>;
  tagSearch: string;
  tagSort: "name" | "count";
  tagMatch: TagMatchMode;
  isTagSelection: boolean;
  onTagSearchChange: (value: string) => void;
  onTagSortChange: (value: "name" | "count") => void;
  onTagMatchChange: (mode: TagMatchMode) => void;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  onRenameTag: (tagId: string, name: string) => Promise<void>;
  onMergeTag: (tag: TagSummary) => void;
  onDeleteTag: (tag: TagSummary) => void;
}

export function TagWorkspace({
  tags,
  visibleTags,
  selectedTagIds,
  selectedTags,
  selectedTagSet,
  tagSearch,
  tagSort,
  tagMatch,
  isTagSelection,
  onTagSearchChange,
  onTagSortChange,
  onTagMatchChange,
  onToggleTag,
  onClearTags,
  onRenameTag,
  onMergeTag,
  onDeleteTag,
}: TagWorkspaceProps) {
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renameHint, setRenameHint] = useState<string | undefined>();
  const [isRenaming, setIsRenaming] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTagId) {
      window.setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 0);
    }
  }, [editingTagId]);

  function startRename(tag: TagSummary) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setRenameHint(undefined);
  }

  function cancelRename() {
    if (isRenaming) {
      return;
    }
    setEditingTagId(null);
    setEditingName("");
    setRenameHint(undefined);
  }

  async function submitRename(tag: TagSummary) {
    const nextName = editingName.trim();
    if (!nextName) {
      setRenameHint("Name cannot be empty.");
      return;
    }
    if (nextName === tag.name) {
      cancelRename();
      return;
    }

    try {
      setIsRenaming(true);
      setRenameHint(undefined);
      await onRenameTag(tag.id, nextName);
      setEditingTagId(null);
      setEditingName("");
    } catch (error) {
      setRenameHint(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRenaming(false);
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, tag: TagSummary) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename(tag);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }

  return (
    <div className="tag-workspace">
      <label className="tag-search-field">
        <Search size={15} />
        <input
          value={tagSearch}
          onChange={(event) => onTagSearchChange(event.target.value)}
          placeholder="Search tags"
        />
      </label>

      <div className="tag-filter-toolbar">
        <div className="tag-match-toggle" aria-label="Tag match mode">
          <button
            className={!isTagSelection || tagMatch === "any" ? "active" : ""}
            type="button"
            disabled={selectedTagIds.length <= 1}
            onClick={() => onTagMatchChange("any")}
          >
            Any
          </button>
          <button
            className={isTagSelection && tagMatch === "all" ? "active" : ""}
            type="button"
            disabled={selectedTagIds.length <= 1}
            onClick={() => onTagMatchChange("all")}
          >
            All
          </button>
        </div>
        <select
          value={tagSort}
          onChange={(event) => onTagSortChange(event.target.value as "name" | "count")}
          aria-label="Sort tags"
        >
          <option value="count">Usage</option>
          <option value="name">Name</option>
        </select>
      </div>

      {selectedTags.length > 0 ? (
        <div className="selected-tag-strip" aria-label="Selected tags">
          {selectedTags.map((tag) => (
            <button type="button" key={tag.id} onClick={() => onToggleTag(tag.id)}>
              {tag.name}
              <X size={12} />
            </button>
          ))}
          <button className="clear-tags-button" type="button" onClick={onClearTags}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="feed-list tag-list">
        {tags.length === 0 ? (
          <div className="sidebar-empty">No tags yet.</div>
        ) : visibleTags.length === 0 ? (
          <div className="sidebar-empty">No matching tags.</div>
        ) : (
          visibleTags.map((tag) => {
            const isSelected = selectedTagSet.has(tag.id);
            const isDisabled = !isSelected && selectedTagIds.length >= 5;
            const isEditing = editingTagId === tag.id;

            return (
              <div className={`feed-item-row tag-item-row ${isEditing ? "editing" : ""}`} key={tag.id}>
                {isEditing ? (
                  <div className={`feed-item tag-rename-form ${isSelected ? "selected" : ""}`}>
                    <span className="feed-icon tag-icon">
                      <Tags size={17} />
                    </span>
                    <label className="tag-rename-field">
                      <input
                        ref={editInputRef}
                        value={editingName}
                        aria-label="Tag name"
                        disabled={isRenaming}
                        onChange={(event) => {
                          setEditingName(event.target.value);
                          if (renameHint) {
                            setRenameHint(undefined);
                          }
                        }}
                        onKeyDown={(event) => handleRenameKeyDown(event, tag)}
                      />
                    </label>
                    <div className="tag-rename-actions">
                      <button
                        className="tag-rename-save"
                        type="button"
                        title="Save tag name"
                        aria-label={`Save ${tag.name} name`}
                        disabled={isRenaming}
                        onClick={() => void submitRename(tag)}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className="tag-rename-cancel"
                        type="button"
                        title="Cancel rename"
                        aria-label={`Cancel renaming ${tag.name}`}
                        disabled={isRenaming}
                        onClick={cancelRename}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {renameHint ? <span className="tag-rename-hint">{renameHint}</span> : null}
                  </div>
                ) : (
                  <>
                    <button
                      className={`feed-item ${isSelected ? "selected" : ""}`}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onToggleTag(tag.id)}
                    >
                      <span className="feed-icon tag-icon">
                        <Tags size={17} />
                      </span>
                      <span className="feed-main">
                        <span className="feed-title">{tag.name}</span>
                        <span className="feed-url">
                          {isSelected ? "Selected" : isDisabled ? "Limit reached" : "Tagged articles"}
                        </span>
                      </span>
                      <span className="unread-count">{tag.articleCount}</span>
                    </button>
                    <div className="tag-row-actions" aria-label={`${tag.name} tag actions`}>
                      <button type="button" title="Rename tag" onClick={() => startRename(tag)}>
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        title="Merge tag"
                        disabled={tags.length < 2}
                        onClick={() => onMergeTag(tag)}
                      >
                        <GitMerge size={12} />
                      </button>
                      <button type="button" title="Delete tag" onClick={() => onDeleteTag(tag)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
