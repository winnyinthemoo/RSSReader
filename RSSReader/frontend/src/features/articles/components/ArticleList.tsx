import { Circle, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  ArticleListItem,
  FeedSummary,
  TagSummary,
} from "../../../../../shared/feed";
import type { SidebarSelection } from "../../feeds/types";

interface ArticleListProps {
  articles: ArticleListItem[];
  feeds: FeedSummary[];
  tags: TagSummary[];
  selectedArticleId?: string;
  selection: SidebarSelection;
  searchQuery?: string;
  onSelectArticle: (articleId: string) => void;
  onToggleFavorite: (articleId: string, isFavorite: boolean) => void;
}

const compactDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

export function ArticleList({
  articles,
  feeds,
  tags,
  selectedArticleId,
  selection,
  searchQuery = "",
  onSelectArticle,
  onToggleFavorite,
}: ArticleListProps) {
  const [filterType, setFilterType] = useState<"unread" | "read" | null>(null);
  const normalizedSearchQuery = searchQuery.trim();

  useEffect(() => {
    setFilterType(null);
  }, [selection, normalizedSearchQuery]);

  const title = getArticleListTitle(selection, feeds, tags);
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
          <p className="eyebrow">
            {normalizedSearchQuery ? "Search" : selection.type === "starred" ? "Saved" : "Inbox"}
          </p>
          <div className="header-title-row">
            <h2>{normalizedSearchQuery ? "Search results" : title}</h2>
            <div className="article-stats">
              <button
                type="button"
                className={`unread-count-badge ${filterType === "unread" ? "active" : ""}`}
                aria-pressed={filterType === "unread"}
                onClick={() => setFilterType(filterType === "unread" ? null : "unread")}
              >
                Unread {unreadCount}
              </button>
              <button
                type="button"
                className={`read-count-badge ${filterType === "read" ? "active" : ""}`}
                aria-pressed={filterType === "read"}
                onClick={() => setFilterType(filterType === "read" ? null : "read")}
              >
                Read {readCount}
              </button>
            </div>
          </div>
          {normalizedSearchQuery ? (
            <p className="article-search-context">
              {articles.length} result{articles.length === 1 ? "" : "s"} in {title} for "
              {normalizedSearchQuery}"
            </p>
          ) : null}
        </div>
      </div>

      <div className="article-list">
        {articles.length === 0 ? (
          <div className="empty-panel">
            <p>
              {normalizedSearchQuery
                ? `No articles found for "${normalizedSearchQuery}".`
                : "No articles yet."}
            </p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-panel">
            <p>No articles match the current read filter.</p>
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
                <span className="read-dot" aria-label={article.isRead ? "Read" : "Unread"}>
                  <Circle size={9} fill={article.isRead ? "transparent" : "currentColor"} />
                </span>
                <span>{article.feedTitle}</span>
                <span>{formatDate(article.publishedAt)}</span>
              </span>
              <span className="article-title-line">
                <span className="article-title-text">{article.title}</span>
                <span
                  className={`article-star-button${article.isFavorite ? " active" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={article.isFavorite ? "Remove from starred" : "Add to starred"}
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
) {
  switch (selection.type) {
    case "feed":
      return feeds.find((feed) => feed.id === selection.feedId)?.title ?? "Feed";
    case "starred":
      return "Starred";
    case "tag": {
      const selectedNames = selection.tagIds
        .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
        .filter((name): name is string => Boolean(name));
      if (selectedNames.length <= 1) {
        return selectedNames[0] ?? "Tag";
      }
      return `${selectedNames[0]} +${selectedNames.length - 1} (${selection.tagMatch})`;
    }
    case "all":
    default:
      return "All articles";
  }
}

function formatDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return compactDateFormatter.format(new Date(value));
}
