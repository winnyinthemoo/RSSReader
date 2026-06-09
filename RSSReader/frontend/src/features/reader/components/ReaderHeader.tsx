import { ExternalLink, Star } from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";
import { formatFullDate } from "../utils/date";

interface ReaderHeaderProps {
  article: ArticleDetail;
  variant?: "default" | "compact";
}

export function ReaderHeader({ article, variant = "default" }: ReaderHeaderProps) {
  return (
    <header className={`reader-header${variant === "compact" ? " compact" : ""}`}>
      <p className="eyebrow">{article.feedTitle}</p>
      <h2>{article.title}</h2>
      <div className="reader-meta">
        <span>{article.author ?? "Unknown author"}</span>
        <span>{formatFullDate(article.publishedAt)}</span>
        {article.isFavorite ? (
          <span className="favorite-label">
            <Star size={15} fill="currentColor" />
            Saved
          </span>
        ) : null}
        <a href={article.url} target="_blank" rel="noreferrer" title="Open original article">
          <ExternalLink size={16} />
        </a>
      </div>
    </header>
  );
}
