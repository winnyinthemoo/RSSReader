import type { FormEvent, RefObject } from "react";
import { X } from "lucide-react";

interface AddFeedDialogProps {
  name: string;
  url: string;
  formHint?: string;
  isAdding: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
}

export function AddFeedDialog({
  name,
  url,
  formHint,
  isAdding,
  nameInputRef,
  onSubmit,
  onClose,
  onNameChange,
  onUrlChange,
}: AddFeedDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add feed"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Add Feed</h2>
          <button type="button" title="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <label className="dialog-field">
          <span>Name</span>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Optional display name"
            disabled={isAdding}
          />
        </label>

        <label className="dialog-field">
          <span>URL</span>
          <input
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://example.com/feed.xml"
            disabled={isAdding}
          />
        </label>

        {formHint ? <p className="feed-form-hint">{formHint}</p> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={isAdding}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
