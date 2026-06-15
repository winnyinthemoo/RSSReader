import { Circle, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  ArticleListItem,
  FeedSummary,
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
}: ArticleListProps) {
  const text = getAppText(appLanguage);
  const [filterType, setFilterType] = useState<"unread" | "read" | null>(null);
  const normalizedSearchQuery = searchQuery.trim();

  useEffect(() => {
    setFilterType(null);
  }, [selection, normalizedSearchQuery]);

  const title = getArticleListTitle(selection, feeds, tags, appLanguage);
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
      return `${selectedNames[0]} +${selectedNames.length - 1} (${selection.tagMatch})`;
    }
    case "all":
    default:
      return text.articleList.allArticles;
  }
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
