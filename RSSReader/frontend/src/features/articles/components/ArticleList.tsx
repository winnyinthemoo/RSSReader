import { Circle, Plus, Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ArticleListItem,
  FeedSummary,
  TagMatchMode,
  TagSummary,
} from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { appLocale, getAppText } from "../../../i18n";
import type { SidebarSelection } from "../../feeds/types";

interface ArticleListProps {
  appLanguage: AppLanguage;
  articles: ArticleListItem[];
  feeds: FeedSummary[];
  tags: TagSummary[];
  selectedArticleId?: string;
  selection: SidebarSelection;
  searchQuery?: string;
  onSelectArticle: (articleId: string) => void;
  onToggleFavorite: (articleId: string, isFavorite: boolean) => void;
  onAddTagFilter: (tagId: string) => void;
  onRemoveTagFilter: (tagId: string) => void;
  onClearTagFilters: () => void;
  onTagMatchChange: (tagMatch: TagMatchMode) => void;
}

export function ArticleList({
  appLanguage,
  articles,
  feeds,
  tags,
  selectedArticleId,
  selection,
  searchQuery = "",
  onSelectArticle,
  onToggleFavorite,
  onAddTagFilter,
  onRemoveTagFilter,
  onClearTagFilters,
  onTagMatchChange,
}: ArticleListProps) {
  const text = getAppText(appLanguage);
  const [filterType, setFilterType] = useState<"unread" | "read" | null>(null);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [tagPickerQuery, setTagPickerQuery] = useState("");
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const normalizedSearchQuery = searchQuery.trim();

  useEffect(() => {
    setFilterType(null);
  }, [selection, normalizedSearchQuery]);

  useEffect(() => {
    if (!isTagPickerOpen) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (!tagPickerRef.current?.contains(event.target as Node)) {
        setIsTagPickerOpen(false);
      }
    }

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [isTagPickerOpen]);

  useEffect(() => {
    if (selection.type !== "tag") {
      setIsTagPickerOpen(false);
      setTagPickerQuery("");
    }
  }, [selection.type]);

  const title = getArticleListTitle(selection, feeds, tags, appLanguage);
  const tagFilterText = getArticleTagFilterText(appLanguage);
  const selectedTagIds = selection.type === "tag" ? selection.tagIds : [];
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const selectedTags = useMemo(
    () =>
      selectedTagIds
        .map((tagId) => tagMap.get(tagId))
        .filter((tag): tag is TagSummary => Boolean(tag)),
    [selectedTagIds, tagMap],
  );
  const selectedTagIdSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const availableFilterTags = useMemo(() => {
    const normalizedQuery = tagPickerQuery.trim().toLowerCase();
    return tags
      .filter((tag) => !selectedTagIdSet.has(tag.id))
      .filter((tag) => !normalizedQuery || tag.name.toLowerCase().includes(normalizedQuery))
      .sort((firstTag, secondTag) => {
        if (secondTag.articleCount !== firstTag.articleCount) {
          return secondTag.articleCount - firstTag.articleCount;
        }
        return firstTag.name.localeCompare(secondTag.name);
      });
  }, [selectedTagIdSet, tagPickerQuery, tags]);
  const { filteredArticles, readCount, unreadCount } = useMemo(() => {
    let readCount = 0;
    let unreadCount = 0;
    const filteredArticles: ArticleListItem[] = [];

    for (const article of articles) {
      if (article.isRead) {
        readCount += 1;
      } else {
        unreadCount += 1;
      }

      if (
        filterType === null ||
        (filterType === "read" && article.isRead) ||
        (filterType === "unread" && !article.isRead)
      ) {
        filteredArticles.push(article);
      }
    }

    return { filteredArticles, readCount, unreadCount };
  }, [articles, filterType]);

  return (
    <section className="article-list-pane">
      <div className="pane-header article-header">
        <div>
          <div className="header-title-row">
            <h2>{normalizedSearchQuery ? text.articleList.searchResults : title}</h2>
            <div className="article-stats">
              <button
                type="button"
                className={`unread-count-badge ${filterType === "unread" ? "active" : ""}`}
                aria-pressed={filterType === "unread"}
                onClick={() => setFilterType(filterType === "unread" ? null : "unread")}
              >
                {text.articleList.unread(unreadCount)}
              </button>
              <button
                type="button"
                className={`read-count-badge ${filterType === "read" ? "active" : ""}`}
                aria-pressed={filterType === "read"}
                onClick={() => setFilterType(filterType === "read" ? null : "read")}
              >
                {text.articleList.read(readCount)}
              </button>
            </div>
          </div>
          {normalizedSearchQuery ? (
            <p className="article-search-context">
              {text.articleList.resultContext(articles.length, title, normalizedSearchQuery)}
            </p>
          ) : null}
          {selection.type === "tag" ? (
            <div className="article-tag-filter-bar" aria-label={tagFilterText.tagFilters}>
              <div className="article-tag-chip-list">
                {selectedTags.map((tag) => (
                  <button
                    className="article-tag-chip"
                    type="button"
                    key={tag.id}
                    title={tagFilterText.removeTag(tag.name)}
                    aria-label={tagFilterText.removeTag(tag.name)}
                    onClick={() => onRemoveTagFilter(tag.id)}
                  >
                    <span>{tag.name}</span>
                    <X size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className="article-tag-filter-tools" ref={tagPickerRef}>
                {selectedTagIds.length > 1 ? (
                  <div className="article-tag-match-toggle" aria-label={tagFilterText.matchMode}>
                    {(["any", "all"] as const).map((tagMatch) => (
                      <button
                        type="button"
                        key={tagMatch}
                        className={selection.tagMatch === tagMatch ? "active" : ""}
                        aria-pressed={selection.tagMatch === tagMatch}
                        onClick={() => onTagMatchChange(tagMatch)}
                      >
                        {getTagMatchLabel(tagMatch, appLanguage)}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  className="article-tag-add-button"
                  type="button"
                  aria-expanded={isTagPickerOpen}
                  onClick={() => setIsTagPickerOpen((isOpen) => !isOpen)}
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>{tagFilterText.addTag}</span>
                </button>
                <button
                  className="article-tag-clear-button"
                  type="button"
                  onClick={onClearTagFilters}
                >
                  {tagFilterText.clear}
                </button>

                {isTagPickerOpen ? (
                  <div className="article-tag-picker" role="dialog" aria-label={tagFilterText.tagFilters}>
                    <label className="article-tag-search">
                      <Search size={14} aria-hidden="true" />
                      <input
                        type="search"
                        value={tagPickerQuery}
                        placeholder={tagFilterText.searchTags}
                        autoFocus
                        onChange={(event) => setTagPickerQuery(event.target.value)}
                      />
                    </label>
                    <div className="article-tag-option-list">
                      {availableFilterTags.length === 0 ? (
                        <div className="article-tag-empty">{tagFilterText.noMoreTags}</div>
                      ) : (
                        availableFilterTags.map((tag) => (
                          <button
                            className="article-tag-option"
                            type="button"
                            key={tag.id}
                            onClick={() => {
                              onAddTagFilter(tag.id);
                              setTagPickerQuery("");
                              setIsTagPickerOpen(false);
                            }}
                          >
                            <span>{tag.name}</span>
                            <span className="article-tag-option-count">
                              {tagFilterText.count(tag.articleCount)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="article-list">
        {articles.length === 0 ? (
          <div className="empty-panel">
            <p>
              {normalizedSearchQuery
                ? text.articleList.noArticlesFound(normalizedSearchQuery)
                : text.articleList.noArticlesYet}
            </p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-panel">
            <p>{text.articleList.noArticlesMatchFilter}</p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <button
              className={`article-item ${selectedArticleId === article.id ? "selected" : ""} ${
                article.isRead ? "read" : "unread"
              }`}
              type="button"
              key={article.id}
              onClick={() => onSelectArticle(article.id)}
            >
              <span className="article-row-meta">
                <span
                  className="read-dot"
                  aria-label={article.isRead ? text.articleList.readStatus : text.articleList.unreadStatus}
                >
                  <Circle size={9} fill={article.isRead ? "transparent" : "currentColor"} />
                </span>
                <span>{article.feedTitle}</span>
                <span>{formatDate(article.publishedAt, appLanguage)}</span>
              </span>
              <span className="article-title-line">
                <span className="article-title-text">{article.title}</span>
                <span
                  className={`article-star-button${article.isFavorite ? " active" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={
                    article.isFavorite
                      ? text.articleList.removeFromStarred
                      : text.articleList.addToStarred
                  }
                  aria-pressed={article.isFavorite}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(article.id, !article.isFavorite);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleFavorite(article.id, !article.isFavorite);
                    }
                  }}
                >
                  <Star size={16} fill={article.isFavorite ? "currentColor" : "transparent"} />
                </span>
              </span>
              <span className="article-excerpt">{article.excerpt}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function getArticleListTitle(
  selection: SidebarSelection,
  feeds: FeedSummary[],
  tags: TagSummary[],
  language: AppLanguage,
) {
  const text = getAppText(language);
  switch (selection.type) {
    case "feed":
      return feeds.find((feed) => feed.id === selection.feedId)?.title ?? text.articleList.feed;
    case "starred":
      return text.articleList.starred;
    case "tag": {
      const selectedNames = selection.tagIds
        .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
        .filter((name): name is string => Boolean(name));
      if (selectedNames.length <= 1) {
        return selectedNames[0] ?? text.articleList.tag;
      }
      return `${selectedNames[0]} +${selectedNames.length - 1} (${getTagMatchLabel(selection.tagMatch, language)})`;
    }
    case "all":
    default:
      return text.articleList.allArticles;
  }
}

function getTagMatchLabel(tagMatch: TagMatchMode, language: AppLanguage) {
  if (language === "zh-Hans") {
    return tagMatch === "all" ? "\u5168\u90e8" : "\u4efb\u4e00";
  }

  return tagMatch === "all" ? "All" : "Any";
}

function getArticleTagFilterText(language: AppLanguage) {
  if (language === "zh-Hans") {
    return {
      addTag: "\u6dfb\u52a0\u6807\u7b7e",
      clear: "\u6e05\u9664",
      count: (count: number) => `${count} \u7bc7`,
      matchMode: "\u6807\u7b7e\u5339\u914d\u65b9\u5f0f",
      noMoreTags: "\u6ca1\u6709\u53ef\u6dfb\u52a0\u7684\u6807\u7b7e",
      removeTag: (name: string) => `\u79fb\u9664\u6807\u7b7e ${name}`,
      searchTags: "\u641c\u7d22\u6807\u7b7e",
      tagFilters: "\u6807\u7b7e\u7b5b\u9009",
    };
  }

  return {
    addTag: "Add tag",
    clear: "Clear",
    count: (count: number) => `${count} article${count === 1 ? "" : "s"}`,
    matchMode: "Tag match mode",
    noMoreTags: "No tags to add",
    removeTag: (name: string) => `Remove tag ${name}`,
    searchTags: "Search tags",
    tagFilters: "Tag filters",
  };
}

function formatDate(value: string | undefined, language: AppLanguage) {
  if (!value) {
    return getAppText(language).common.noDate;
  }

  return new Intl.DateTimeFormat(appLocale(language), {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
