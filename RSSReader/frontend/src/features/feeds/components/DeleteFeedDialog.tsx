import { X } from "lucide-react";

interface DeleteFeedDialogProps {
  feedTitle?: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteFeedDialog({
  feedTitle,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteFeedDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Confirm Delete</h2>
          <button type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="confirm-body">
          <p>Are you sure you want to delete &quot;{feedTitle}&quot;?</p>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={onConfirm} disabled={isDeleting}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
