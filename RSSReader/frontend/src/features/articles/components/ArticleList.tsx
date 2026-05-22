import { Circle, Star } from "lucide-react";

import type { ArticleListItem, FeedSummary } from "../../../../../shared/feed";

interface ArticleListProps {
  articles: ArticleListItem[];
  feeds: FeedSummary[];
  selectedArticleId?: string;
  selectedFeedId?: string;
  onSelectArticle: (articleId: string) => void;
}

export function ArticleList({
  articles,
  feeds,
  selectedArticleId,
  selectedFeedId,
  onSelectArticle,
}: ArticleListProps) {
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);
  const title = selectedFeed?.title ?? "All articles";

  return (
    <section className="article-list-pane">
      <div className="pane-header article-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>{title}</h2>
        </div>
        <span className="article-count">{articles.length}</span>
      </div>

      <div className="article-list">
        {articles.length === 0 ? (
          <div className="empty-panel">
            <p>No articles yet.</p>
          </div>
        ) : (
          articles.map((article) => (
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
                <span>{article.title}</span>
                {article.isFavorite ? <Star size={16} fill="currentColor" /> : null}
              </span>
              <span className="article-excerpt">{article.excerpt}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
