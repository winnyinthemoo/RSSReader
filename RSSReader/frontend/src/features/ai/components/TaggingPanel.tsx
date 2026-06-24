import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import type { ArticleTag } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { assignTags, suggestTags } from "../../../services/aiService";

interface TaggingPanelProps {
  appLanguage: AppLanguage;
  articleId?: string;
  onApplied: (tags: ArticleTag[]) => void;
  onTagsChanged?: () => void;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function taggingText(appLanguage: AppLanguage) {
  if (appLanguage === "zh-Hans") {
    return {
      aria: "AI \u6807\u7b7e\u63a8\u8350\u7ed3\u679c",
      suggest: "AI \u63a8\u8350\u6807\u7b7e",
      suggesting: "\u63a8\u8350\u4e2d...",
      suggestionsReady: "AI \u6807\u7b7e\u5df2\u5c31\u7eea",
      noSuggestions: "\u6682\u65e0\u660e\u786e\u7684\u6807\u7b7e\u63a8\u8350",
      applying: "\u5e94\u7528\u4e2d...",
      applySelected: "\u5e94\u7528\u5df2\u9009\u6807\u7b7e",
      tagsApplied: "AI \u6807\u7b7e\u5df2\u5e94\u7528",
    };
  }

  return {
    aria: "AI tagging result",
    suggest: "Suggest with AI",
    suggesting: "Suggesting...",
    suggestionsReady: "AI suggestions ready",
    noSuggestions: "No strong tag suggestions",
    applying: "Applying...",
    applySelected: "Apply selected",
    tagsApplied: "AI tags applied",
  };
}

export function TaggingPanel({ appLanguage, articleId, onApplied, onTagsChanged }: TaggingPanelProps) {
  const text = taggingText(appLanguage);
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
      setStatus(result.tags.length > 0 ? text.suggestionsReady : text.noSuggestions);
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
      setStatus(text.tagsApplied);
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
    <div className="reader-ai-tagging-panel" aria-label={text.aria}>
      <button
        className="secondary-button"
        type="button"
        onClick={() => void handleSuggestTags()}
        disabled={!articleId || isSuggesting}
      >
        {isSuggesting ? text.suggesting : text.suggest}
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
            {isApplying ? text.applying : text.applySelected}
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
