import { X } from "lucide-react";

import type { TagSummary } from "../../../../../shared/feed";

interface MergeTagDialogProps {
  sourceTag: TagSummary;
  targetTags: TagSummary[];
  targetTagId: string;
  hint?: string;
  isMerging: boolean;
  onTargetTagChange: (tagId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function MergeTagDialog({
  sourceTag,
  targetTags,
  targetTagId,
  hint,
  isMerging,
  onTargetTagChange,
  onClose,
  onConfirm,
}: MergeTagDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Merge tag"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Merge Tag</h2>
          <button type="button" title="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <p className="merge-tag-summary">
          Merge <strong>{sourceTag.name}</strong> into another tag.
        </p>

        <label className="dialog-field">
          <span>Target tag</span>
          <select
            value={targetTagId}
            onChange={(event) => onTargetTagChange(event.target.value)}
            disabled={isMerging}
          >
            {targetTags.map((tag) => (
              <option value={tag.id} key={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>

        {hint ? <p className="feed-form-hint">{hint}</p> : null}

        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={isMerging}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onConfirm}
            disabled={isMerging || targetTags.length === 0}
          >
            {isMerging ? "Merging..." : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
