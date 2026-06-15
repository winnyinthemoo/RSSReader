import { ExternalLink, Star } from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { formatFullDate } from "../utils/date";

interface ReaderHeaderProps {
  appLanguage: AppLanguage;
  article: ArticleDetail;
  variant?: "default" | "compact";
}

export function ReaderHeader({ appLanguage, article, variant = "default" }: ReaderHeaderProps) {
  const text = getAppText(appLanguage);

  return (
    <header className={`reader-header${variant === "compact" ? " compact" : ""}`}>
      <h2>{article.title}</h2>
      <div className="reader-meta">
        <span>{article.author ?? text.common.unknownAuthor}</span>
        <span>{formatFullDate(article.publishedAt, appLanguage)}</span>
        {article.isFavorite ? (
          <span className="favorite-label">
            <Star size={15} fill="currentColor" />
            {text.common.saved}
          </span>
        ) : null}
        <a href={article.url} target="_blank" rel="noreferrer" title={text.reader.openOriginalArticle}>
          <ExternalLink size={16} />
        </a>
      </div>
    </header>
  );
}
