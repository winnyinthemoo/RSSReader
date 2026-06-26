import { forwardRef, type KeyboardEvent, useState } from "react";
import { Download, Plus, Share2, X } from "lucide-react";

import type { ArticleTag, TagSummary } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { TaggingPanel } from "../../ai/components/TaggingPanel";
import type { ReaderPanel } from "../types";

interface ReaderSidePanelProps {
  appLanguage: AppLanguage;
  activePanel: ReaderPanel;
  articleId?: string;
  tags: ArticleTag[];
  availableTags: TagSummary[];
  tagInput: string;
  tagStatus?: string;
  noteContent: string;
  noteStatus?: string;
  onClose: () => void;
  onTagInputChange: (value: string) => void;
  onSaveTags: (tags?: string[]) => void | Promise<void>;
  onAiTagsApplied: (tags: ArticleTag[]) => void;
  onTagsChanged?: () => void;
  onDeleteTag: (tagId: string) => void;
  onNoteChange: (value: string) => void;
  onShareNote: () => void;
  onExportNote: () => void;
}

export const ReaderSidePanel = forwardRef<HTMLElement, ReaderSidePanelProps>(
  function ReaderSidePanel(
    {
      appLanguage,
      activePanel,
      articleId,
      tags,
      availableTags,
      tagInput,
      tagStatus,
      noteContent,
      noteStatus,
      onClose,
      onTagInputChange,
      onSaveTags,
      onAiTagsApplied,
      onTagsChanged,
      onDeleteTag,
      onNoteChange,
      onShareNote,
      onExportNote,
    },
    ref,
  ) {
    const [draftTag, setDraftTag] = useState("");
    const text = getAppText(appLanguage);
    const localText = readerSidePanelLocalText(appLanguage);
    const title = activePanel === "tag" ? text.reader.tags : text.reader.note;
    const currentTagNames = new Set(tags.map((tag) => normalizeTagName(tag.name)));
    const pendingTags = mergeTagNames(parseTagInput(tagInput), [], currentTagNames);
    const inputTagNames = new Set(pendingTags.map(normalizeTagName));
    const existingTags = availableTags
      .filter((tag) => {
        const name = normalizeTagName(tag.name);
        return name && !currentTagNames.has(name) && !inputTagNames.has(name);
      })
      .slice(0, 18);

    function appendExistingTag(name: string) {
      const nextTags = mergeTagNames(pendingTags, [name], currentTagNames);
      onTagInputChange(nextTags.join(", "));
    }

    function commitDraftTags() {
      const nextTags = mergeTagNames(pendingTags, parseTagInput(draftTag), currentTagNames);
      if (nextTags.length === pendingTags.length) {
        setDraftTag("");
        return nextTags;
      }

      onTagInputChange(nextTags.join(", "));
      setDraftTag("");
      return nextTags;
    }

    function removePendingTag(name: string) {
      const normalizedName = normalizeTagName(name);
      onTagInputChange(pendingTags.filter((tag) => normalizeTagName(tag) !== normalizedName).join(", "));
    }

    function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key !== "Enter" && event.key !== ",") {
        return;
      }

      event.preventDefault();
      commitDraftTags();
    }

    async function handleSavePendingTags() {
      const nextTags = commitDraftTags();
      if (nextTags.length === 0) {
        return;
      }

      await onSaveTags(nextTags);
    }

    return (
      <aside className="reader-side-panel" aria-label={title} ref={ref}>
        <header className="reader-side-panel-header">
          <strong>{title}</strong>
          <button className="tool-button" type="button" title={text.common.close} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {activePanel === "tag" ? (
          <div className="reader-panel-body">
            {!articleId ? <p className="muted">{text.reader.selectArticleFirst}</p> : null}
            <div className="tag-chip-list">
              {tags.length === 0 ? (
                <span className="muted">{text.reader.noTagsYet}</span>
              ) : (
                tags.map((tag) => (
                  <span className="tag-chip" key={tag.id}>
                    {tag.name}
                    <button type="button" title={text.reader.removeTag} onClick={() => onDeleteTag(tag.id)}>
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
            <label className="reader-panel-field">
              <span>{text.reader.addTags}</span>
              <div className="tag-compose-row">
                <input
                  value={draftTag}
                  onChange={(event) => setDraftTag(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder={localText.tagInputPlaceholder}
                />
                <button
                  className="tag-add-button"
                  type="button"
                  title={localText.addTypedTags}
                  disabled={parseTagInput(draftTag).length === 0}
                  onClick={commitDraftTags}
                >
                  <Plus size={15} />
                </button>
              </div>
            </label>
            {pendingTags.length > 0 ? (
              <section className="tag-pending-panel" aria-label={localText.pendingTags}>
                <div className="reader-panel-subtitle">{localText.pendingTags}</div>
                <div className="tag-chip-list">
                  {pendingTags.map((tag) => (
                    <span className="tag-chip tag-pending-chip" key={tag}>
                      {tag}
                      <button type="button" title={localText.removePendingTag(tag)} onClick={() => removePendingTag(tag)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={!articleId || (pendingTags.length === 0 && parseTagInput(draftTag).length === 0)}
              onClick={() => void handleSavePendingTags()}
            >
              {text.reader.saveTags}
            </button>
            {availableTags.length > 0 ? (
              <section className="existing-tags-panel" aria-label={localText.existingTags}>
                <div className="reader-panel-subtitle">{localText.existingTags}</div>
                {existingTags.length > 0 ? (
                  <div className="tag-chip-list">
                    {existingTags.map((tag) => (
                      <button
                        className="tag-chip tag-existing-chip"
                        type="button"
                        key={tag.id}
                        title={localText.addExistingTag(tag.name)}
                        onClick={() => appendExistingTag(tag.name)}
                      >
                        {tag.name}
                        <span>{tag.articleCount}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="reader-panel-status">{localText.noMoreTags}</p>
                )}
              </section>
            ) : null}
            <TaggingPanel
              appLanguage={appLanguage}
              articleId={articleId}
              onApplied={onAiTagsApplied}
              onTagsChanged={onTagsChanged}
            />
            {tagStatus ? <p className="reader-panel-status">{tagStatus}</p> : null}
          </div>
        ) : null}

        {activePanel === "note" ? (
          <div className="reader-panel-body">
            {!articleId ? <p className="muted">{text.reader.selectArticleFirst}</p> : null}
            <label className="reader-panel-field">
              <span>{text.reader.articleNote}</span>
              <textarea
                value={noteContent}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder={localText.notePlaceholder}
              />
            </label>
            <div className="note-panel-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={!articleId || !noteContent.trim()}
                onClick={onShareNote}
              >
                <Share2 size={15} />
                <span>{text.reader.share}</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!articleId || !noteContent.trim()}
                onClick={onExportNote}
              >
                <Download size={15} />
                <span>{text.reader.export}</span>
              </button>
            </div>
            {noteStatus ? <p className="reader-panel-status">{noteStatus}</p> : null}
          </div>
        ) : null}
      </aside>
    );
  },
);

function parseTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeTagName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function mergeTagNames(baseTags: string[], addedTags: string[], blockedNames = new Set<string>()) {
  const nextTags: string[] = [];
  const seen = new Set<string>();

  [...baseTags, ...addedTags].forEach((tag) => {
    const trimmedTag = tag.trim();
    const normalizedTag = normalizeTagName(trimmedTag);
    if (!trimmedTag || seen.has(normalizedTag) || blockedNames.has(normalizedTag)) {
      return;
    }

    seen.add(normalizedTag);
    nextTags.push(trimmedTag);
  });

  return nextTags;
}

function readerSidePanelLocalText(appLanguage: AppLanguage) {
  if (appLanguage === "zh-Hans") {
    return {
      existingTags: "\u5df2\u6709\u6807\u7b7e",
      noMoreTags: "\u6ca1\u6709\u66f4\u591a\u53ef\u9009\u6807\u7b7e\u3002",
      addExistingTag: (name: string) => `\u6dfb\u52a0\u6807\u7b7e\u201c${name}\u201d`,
      pendingTags: "\u5f85\u6dfb\u52a0",
      addTypedTags: "\u6dfb\u52a0\u8f93\u5165\u7684\u6807\u7b7e",
      removePendingTag: (name: string) => `\u79fb\u9664\u5f85\u6dfb\u52a0\u6807\u7b7e\u201c${name}\u201d`,
      tagInputPlaceholder: "\u8f93\u5165\u6807\u7b7e\u540e\u6309 Enter",
      notePlaceholder: "\u8bb0\u4e0b\u8fd9\u7bc7\u6587\u7ae0\u7684\u60f3\u6cd5...",
    };
  }

  return {
    existingTags: "Existing tags",
    noMoreTags: "No more tags available.",
    addExistingTag: (name: string) => `Add tag ${name}`,
    pendingTags: "To add",
    addTypedTags: "Add typed tags",
    removePendingTag: (name: string) => `Remove pending tag ${name}`,
    tagInputPlaceholder: "Type a tag, then press Enter",
    notePlaceholder: "Write a local note for this article...",
  };
}
