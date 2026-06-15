import type { FormEvent, RefObject } from "react";
import { X } from "lucide-react";

import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";

interface AddFeedDialogProps {
  appLanguage: AppLanguage;
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
  appLanguage,
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
  const text = getAppText(appLanguage);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="add-feed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={text.addFeedDialog.aria}
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>{text.addFeedDialog.title}</h2>
          <button type="button" title={text.common.close} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <label className="dialog-field">
          <span>{text.addFeedDialog.name}</span>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={text.addFeedDialog.optionalName}
            disabled={isAdding}
          />
        </label>

        <label className="dialog-field">
          <span>{text.addFeedDialog.url}</span>
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
            {text.common.cancel}
          </button>
          <button className="primary-button" type="submit" disabled={isAdding}>
            {text.addFeedDialog.add}
          </button>
        </div>
      </form>
    </div>
  );
}
