import { forwardRef } from "react";
import { Download, Share2, X } from "lucide-react";

import type { ArticleTag } from "../../../../../shared/feed";
import { TaggingPanel } from "../../ai/components/TaggingPanel";
import type { ReaderPanel } from "../types";

interface ReaderSidePanelProps {
  activePanel: ReaderPanel;
  articleId?: string;
  tags: ArticleTag[];
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
      activePanel,
      articleId,
      tags,
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
    const title = activePanel === "tag" ? "Tags" : "Note";

    return (
      <aside className="reader-side-panel" aria-label={title} ref={ref}>
        <header className="reader-side-panel-header">
          <strong>{title}</strong>
          <button className="tool-button" type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {activePanel === "tag" ? (
          <div className="reader-panel-body">
            {!articleId ? <p className="muted">Select an article first.</p> : null}
            <div className="tag-chip-list">
              {tags.length === 0 ? (
                <span className="muted">No tags yet.</span>
              ) : (
                tags.map((tag) => (
                  <span className="tag-chip" key={tag.id}>
                    {tag.name}
                    <button type="button" title="Remove tag" onClick={() => onDeleteTag(tag.id)}>
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
            <label className="reader-panel-field">
              <span>Add tags</span>
              <input
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                placeholder="AI, Rust, Product"
              />
            </label>
            <button className="secondary-button" type="button" onClick={onSaveTags}>
              Save tags
            </button>
            <TaggingPanel
              articleId={articleId}
              onApplied={onAiTagsApplied}
              onTagsChanged={onTagsChanged}
            />
            {tagStatus ? <p className="reader-panel-status">{tagStatus}</p> : null}
          </div>
        ) : null}

        {activePanel === "note" ? (
          <div className="reader-panel-body">
            {!articleId ? <p className="muted">Select an article first.</p> : null}
            <label className="reader-panel-field">
              <span>Article note</span>
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
                <span>Share</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!articleId || !noteContent.trim()}
                onClick={onExportNote}
              >
                <Download size={15} />
                <span>Export</span>
              </button>
            </div>
            {noteStatus ? <p className="reader-panel-status">{noteStatus}</p> : null}
          </div>
        ) : null}
      </aside>
    );
  },
);
