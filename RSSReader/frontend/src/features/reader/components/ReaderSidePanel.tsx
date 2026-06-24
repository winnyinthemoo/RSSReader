import { forwardRef } from "react";
import { Download, Share2, X } from "lucide-react";

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
  onSaveTags: () => void;
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
    const text = getAppText(appLanguage);
    const localText = readerSidePanelLocalText(appLanguage);
    const title = activePanel === "tag" ? text.reader.tags : text.reader.note;
    const currentTagNames = new Set(tags.map((tag) => normalizeTagName(tag.name)));
    const inputTagNames = new Set(parseTagInput(tagInput).map(normalizeTagName));
    const existingTags = availableTags
      .filter((tag) => {
        const name = normalizeTagName(tag.name);
        return name && !currentTagNames.has(name) && !inputTagNames.has(name);
      })
      .slice(0, 18);

    function appendExistingTag(name: string) {
      const nextTags = parseTagInput(tagInput);
      if (!nextTags.map(normalizeTagName).includes(normalizeTagName(name))) {
        nextTags.push(name);
      }
      onTagInputChange(nextTags.join(", "));
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
              <input
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                placeholder="AI, Rust, Product"
              />
            </label>
            <button className="secondary-button" type="button" onClick={onSaveTags}>
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
                placeholder="Write a local note for this article..."
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

function readerSidePanelLocalText(appLanguage: AppLanguage) {
  if (appLanguage === "zh-Hans") {
    return {
      existingTags: "\u5df2\u6709\u6807\u7b7e",
      noMoreTags: "\u6ca1\u6709\u66f4\u591a\u53ef\u9009\u6807\u7b7e\u3002",
      addExistingTag: (name: string) => `\u6dfb\u52a0\u6807\u7b7e\u201c${name}\u201d`,
    };
  }

  return {
    existingTags: "Existing tags",
    noMoreTags: "No more tags available.",
    addExistingTag: (name: string) => `Add tag ${name}`,
  };
}
