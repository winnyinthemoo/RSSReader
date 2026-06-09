import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import type { ArticleTag } from "../../../../../shared/feed";
import { assignTags, suggestTags } from "../../../services/aiService";

interface TaggingPanelProps {
  articleId?: string;
  onApplied: (tags: ArticleTag[]) => void;
  onTagsChanged?: () => void;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function TaggingPanel({ articleId, onApplied, onTagsChanged }: TaggingPanelProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [assignedTags, setAssignedTags] = useState<ArticleTag[]>([]);
  const [notice, setNotice] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setSuggestions([]);
    setSelectedSuggestions([]);
    setAssignedTags([]);
    setNotice(undefined);
    setStatus(undefined);
    setIsSuggesting(false);
    setIsApplying(false);
  }, [articleId]);

  async function handleSuggestTags() {
    if (!articleId) {
      return;
    }

    try {
      setIsSuggesting(true);
      setStatus(undefined);
      setNotice(undefined);
      setAssignedTags([]);
      const result = await suggestTags({ articleId });
      setSuggestions(result.tags);
      setSelectedSuggestions(result.tags);
      setNotice(result.fallbackNotice);
      setStatus(result.tags.length > 0 ? "AI suggestions ready" : "No strong tag suggestions");
    } catch (error) {
      setSuggestions([]);
      setSelectedSuggestions([]);
      setStatus(getErrorMessage(error));
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleApplyTags() {
    if (!articleId || selectedSuggestions.length === 0) {
      return;
    }

    try {
      setIsApplying(true);
      setStatus(undefined);
      const result = await assignTags({
        articleId,
        tags: selectedSuggestions,
        source: "ai",
      });
      setAssignedTags(result.tags);
      onApplied(result.tags);
      onTagsChanged?.();
      setSuggestions([]);
      setSelectedSuggestions([]);
      setStatus("AI tags applied");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setIsApplying(false);
    }
  }

  function handleToggleSuggestedTag(tag: string) {
    setSelectedSuggestions((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  return (
    <div className="reader-ai-tagging-panel" aria-label="AI tagging result">
      <button
        className="secondary-button"
        type="button"
        onClick={() => void handleSuggestTags()}
        disabled={!articleId || isSuggesting}
      >
        {isSuggesting ? "Suggesting..." : "Suggest with AI"}
      </button>

      {suggestions.length > 0 ? (
        <div className="tag-suggestion-box">
          <div className="tag-chip-list">
            {suggestions.map((tag) => (
              <button
                className={`tag-chip tag-suggestion-chip ${
                  selectedSuggestions.includes(tag) ? "selected" : ""
                }`}
                key={tag}
                type="button"
                onClick={() => handleToggleSuggestedTag(tag)}
              >
                {tag}
                {selectedSuggestions.includes(tag) ? <Check size={12} /> : null}
              </button>
            ))}
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleApplyTags()}
            disabled={selectedSuggestions.length === 0 || isApplying}
          >
            {isApplying ? "Applying..." : "Apply selected"}
          </button>
        </div>
      ) : null}

      {assignedTags.length > 0 ? (
        <div className="tag-suggestion-box">
          <div className="tag-chip-list">
            {assignedTags
              .filter((tag) => tag.source === "ai")
              .map((tag) => (
                <span className="tag-chip tag-suggestion-chip selected" key={tag.id}>
                  {tag.name}
                  <Check size={12} />
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {notice ? <p className="reader-panel-status">{notice}</p> : null}
      {status ? <p className="reader-panel-status">{status}</p> : null}
    </div>
  );
}
