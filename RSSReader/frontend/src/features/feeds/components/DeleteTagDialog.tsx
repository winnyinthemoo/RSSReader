import { X } from "lucide-react";

import { getAppText } from "../../../i18n";
import type { AppLanguage } from "../../../i18n";

interface DeleteTagDialogProps {
  appLanguage: AppLanguage;
  tagName?: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTagDialog({
  appLanguage,
  tagName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteTagDialogProps) {
  const text = getAppText(appLanguage);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={text.deleteTagDialog.aria}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>{text.deleteTagDialog.title}</h2>
          <button type="button" title={text.common.close} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="confirm-body">
          <p>{text.deleteTagDialog.message(tagName)}</p>
        </div>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={isDeleting}
          >
            {text.common.cancel}
          </button>
          <button
            className="primary-button delete-button"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? text.deleteTagDialog.deleting : text.common.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
