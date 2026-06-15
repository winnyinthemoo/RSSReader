import { X } from "lucide-react";

import type { TagSummary } from "../../../../../shared/feed";
import { getAppText } from "../../../i18n";
import type { AppLanguage } from "../../../i18n";

interface MergeTagDialogProps {
  appLanguage: AppLanguage;
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
  appLanguage,
  sourceTag,
  targetTags,
  targetTagId,
  hint,
  isMerging,
  onTargetTagChange,
  onClose,
  onConfirm,
}: MergeTagDialogProps) {
  const text = getAppText(appLanguage);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={text.mergeTagDialog.aria}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>{text.mergeTagDialog.title}</h2>
          <button type="button" title={text.common.close} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <p className="merge-tag-summary">
          {text.mergeTagDialog.summary(sourceTag.name)}
        </p>

        <label className="dialog-field">
          <span>{text.mergeTagDialog.target}</span>
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
            {text.common.cancel}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onConfirm}
            disabled={isMerging || targetTags.length === 0}
          >
            {isMerging ? text.mergeTagDialog.merging : text.mergeTagDialog.merge}
          </button>
        </div>
      </div>
    </div>
  );
}
