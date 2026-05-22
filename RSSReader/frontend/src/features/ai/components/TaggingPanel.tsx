interface TaggingPanelProps {
  articleId?: string;
  open: boolean;
  onClose: () => void;
}

export function TaggingPanel({ articleId, open, onClose }: TaggingPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="tagging-panel" role="dialog" aria-label="Tagging">
      <header>
        <strong>Tags</strong>
        <button className="tool-button" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="muted">
        {articleId
          ? "TODO(AI-12): AI suggestions on open + manual tag input."
          : "Select an article first."}
      </p>
    </div>
  );
}
