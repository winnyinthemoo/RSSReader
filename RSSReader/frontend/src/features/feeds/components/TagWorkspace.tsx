import { Check, GitMerge, Pencil, Search, SlidersHorizontal, Tags, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { TagSummary } from "../../../../../shared/feed";
import { getAppText } from "../../../i18n";
import type { AppLanguage } from "../../../i18n";

interface TagWorkspaceProps {
  appLanguage: AppLanguage;
  tags: TagSummary[];
  visibleTags: TagSummary[];
  selectedTagIds: string[];
  selectedTagSet: Set<string>;
  tagSearch: string;
  onTagSearchChange: (value: string) => void;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  onRenameTag: (tagId: string, name: string) => Promise<void>;
  onMergeTag: (tag: TagSummary) => void;
  onDeleteTag: (tag: TagSummary) => void;
}

export function TagWorkspace({
  appLanguage,
  tags,
  visibleTags,
  selectedTagIds,
  selectedTagSet,
  tagSearch,
  onTagSearchChange,
  onToggleTag,
  onClearTags,
  onRenameTag,
  onMergeTag,
  onDeleteTag,
}: TagWorkspaceProps) {
  const text = getAppText(appLanguage);
  const tagText = text.tagWorkspace;
  const localText = tagWorkspaceLocalText(appLanguage);
  const [isManagingTags, setIsManagingTags] = useState(false);
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
      setRenameHint(tagText.nameCannotBeEmpty);
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

  function handleManageToggle() {
    setIsManagingTags((value) => !value);
    cancelRename();
  }

  const workspaceTitle = isManagingTags ? localText.manageTitle : localText.quickTitle;
  const manageButtonTitle = isManagingTags ? localText.backToFilter : localText.manageTags;

  return (
    <div className="tag-workspace">
      <div className="tag-workspace-header">
        <div className="tag-workspace-heading">
          <span>{workspaceTitle}</span>
        </div>
        <button
          className="tag-manage-button"
          type="button"
          title={manageButtonTitle}
          aria-label={manageButtonTitle}
          onClick={handleManageToggle}
        >
          {isManagingTags ? <X size={15} /> : <SlidersHorizontal size={15} />}
        </button>
      </div>

      <label className="tag-search-field">
        <Search size={15} />
        <input
          value={tagSearch}
          onChange={(event) => onTagSearchChange(event.target.value)}
          placeholder={tagText.searchTags}
        />
      </label>

      <div className={`feed-list tag-list ${isManagingTags ? "tag-management-list" : ""}`}>
        {tags.length === 0 ? (
          <div className="sidebar-empty">{tagText.noTagsYet}</div>
        ) : visibleTags.length === 0 ? (
          <div className="sidebar-empty">{tagText.noMatchingTags}</div>
        ) : isManagingTags ? (
          visibleTags.map((tag) => {
            const isEditing = editingTagId === tag.id;

            return (
              <div className={`feed-item-row tag-item-row ${isEditing ? "editing" : ""}`} key={tag.id}>
                {isEditing ? (
                  <div className="feed-item tag-rename-form">
                    <span className="feed-icon tag-icon">
                      <Tags size={17} />
                    </span>
                    <label className="tag-rename-field">
                      <input
                        ref={editInputRef}
                        value={editingName}
                        aria-label={tagText.tagName}
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
                        title={tagText.saveTagName}
                        aria-label={tagText.saveTagNameAria(tag.name)}
                        disabled={isRenaming}
                        onClick={() => void submitRename(tag)}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className="tag-rename-cancel"
                        type="button"
                        title={tagText.cancelRename}
                        aria-label={tagText.cancelRenameAria(tag.name)}
                        disabled={isRenaming}
                        onClick={cancelRename}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {renameHint ? <span className="tag-rename-hint">{renameHint}</span> : null}
                  </div>
                ) : (
                  <div className="feed-item tag-management-item">
                    <span className="feed-icon tag-icon">
                      <Tags size={17} />
                    </span>
                    <span className="feed-main">
                      <span className="feed-title">{tag.name}</span>
                      <span className="feed-url">{localText.articleCount(tag.articleCount)}</span>
                    </span>
                    <div className="tag-row-actions" aria-label={tagText.tagActions(tag.name)}>
                      <button type="button" title={tagText.renameTag} onClick={() => startRename(tag)}>
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        title={tagText.mergeTag}
                        disabled={tags.length < 2}
                        onClick={() => onMergeTag(tag)}
                      >
                        <GitMerge size={12} />
                      </button>
                      <button type="button" title={tagText.deleteTag} onClick={() => onDeleteTag(tag)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          visibleTags.map((tag) => {
            const isSelected = selectedTagSet.has(tag.id);

            return (
              <button
                className={`feed-item tag-filter-item ${isSelected ? "selected" : ""}`}
                type="button"
                key={tag.id}
                aria-pressed={isSelected}
                onClick={() => onToggleTag(tag.id)}
              >
                <span className="feed-icon tag-icon">
                  <Tags size={17} />
                </span>
                <span className="feed-main">
                  <span className="feed-title">{tag.name}</span>
                  <span className="feed-url">
                    {isSelected ? localText.selected : localText.articleCount(tag.articleCount)}
                  </span>
                </span>
                <span className="unread-count">{tag.articleCount}</span>
              </button>
            );
          })
        )}
      </div>

      {!isManagingTags && selectedTagIds.length > 0 ? (
        <button className="clear-tag-filter-button" type="button" onClick={onClearTags}>
          <X size={13} />
          <span>{tagText.clear}</span>
        </button>
      ) : null}
    </div>
  );
}

function tagWorkspaceLocalText(appLanguage: AppLanguage) {
  if (appLanguage === "zh-Hans") {
    return {
      articleCount: (count: number) => `${count} \u7bc7`,
      backToFilter: "\u8fd4\u56de\u7b5b\u9009",
      manageTags: "\u7ba1\u7406\u6807\u7b7e",
      manageTitle: "\u7ba1\u7406\u6807\u7b7e",
      quickTitle: "\u6807\u7b7e\u7b5b\u9009",
      selected: "\u6b63\u5728\u7b5b\u9009",
    };
  }

  return {
    articleCount: (count: number) => `${count} articles`,
    backToFilter: "Back to filter",
    manageTags: "Manage tags",
    manageTitle: "Manage tags",
    quickTitle: "Tag filter",
    selected: "Filtering",
  };
}
