import { Circle, Star } from "lucide-react";

import type { ArticleListItem, FeedSummary, TagSummary } from "../../../../../shared/feed";

import { useState, useMemo, useEffect } from "react";

type SidebarSelection =
  | { type: "all" }
  | { type: "feed"; feedId: string }
  | { type: "starred" }
  | { type: "tag"; tagId: string };

interface ArticleListProps {
  articles: ArticleListItem[];
  feeds: FeedSummary[];
  tags: TagSummary[];
  selectedArticleId?: string;
  selection: SidebarSelection;
  onSelectArticle: (articleId: string) => void;
  onToggleFavorite: (articleId: string, isFavorite: boolean) => void;
}

export function ArticleList({
  articles,
  feeds,
  tags,
  selectedArticleId,
  selection,
  onSelectArticle,
  onToggleFavorite,
}: ArticleListProps) {
  
  // 筛选模式：null 表示显示全部，'unread' 表示只显示未读，'read' 表示只显示已读
  const [filterType, setFilterType] = useState<'unread' | 'read' | null>(null);

  // 当切换 Feed 时，重置筛选状态
  useEffect(() => {
    setFilterType(null);
  }, [selection]);

  const title = getArticleListTitle(selection, feeds, tags);

  // 计算已读和未读数量
  const readCount = articles.filter(a => a.isRead).length;
  const unreadCount = articles.filter(a => !a.isRead).length;

  // 根据筛选模式过滤文章
  const filteredArticles = useMemo(() => {
    if (filterType === 'unread') {
      return articles.filter(a => !a.isRead);
    }
    if (filterType === 'read') {
      return articles.filter(a => a.isRead);
    }
    return articles;
  }, [articles, filterType]);

  return (
    <section className="article-list-pane">
      <div className="pane-header article-header">
        <div>
          <p className="eyebrow">{selection.type === "starred" ? "Saved" : "Inbox"}</p>
          <div className="header-title-row">
            <h2>{title}</h2>
            {/* {selection.type !== "starred" && ( */}
              <div className="article-stats">
                <span 
                  className={`unread-count-badge ${filterType === 'unread' ? 'active' : ''}`}
                  onClick={() => setFilterType(filterType === 'unread' ? null : 'unread')}
                  style={{ cursor: 'pointer' }}
                >
                  Unread {unreadCount}
                </span>
                <span 
                  className={`read-count-badge ${filterType === 'read' ? 'active' : ''}`}
                  onClick={() => setFilterType(filterType === 'read' ? null : 'read')}
                  style={{ cursor: 'pointer' }}
                >
                  Read {readCount}
                </span>
              </div>
            {/* )} */}
          </div>
        </div>
      </div>

      <div className="article-list">
        {articles.length === 0 ? (
          <div className="empty-panel">
            <p>No articles yet.</p>
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
    case "tag":
      return tags.find((tag) => tag.id === selection.tagId)?.name ?? "Tag";
    case "all":
    default:
      return "All articles";
  }
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
