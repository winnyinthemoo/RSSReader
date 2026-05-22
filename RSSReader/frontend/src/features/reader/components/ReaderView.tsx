import {
  Columns2,
  ExternalLink,
  FileText,
  Languages,
  NotebookPen,
  Palette,
  Search,
  Share2,
  Star,
  Tags,
  WholeWord,
} from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";

interface ReaderViewProps {
  article?: ArticleDetail;
}

export function ReaderView({ article }: ReaderViewProps) {
  if (!article) {
    return (
      <section className="reader-pane">
        <ReaderToolbar />
        <div className="reader-empty">
          <p className="eyebrow">Reader</p>
          <h2>Select an article</h2>
          <p>Choose a feed item from the middle column to open the reading view.</p>
        </div>
      </section>
    );
  }

  return (
    <article className="reader-pane">
      <ReaderToolbar />
      <header className="reader-header">
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

      <div
        className="reader-content"
        dangerouslySetInnerHTML={{ __html: article.sanitizedHtml }}
      />
    </article>
  );
}

function ReaderToolbar() {
  return (
    <div className="reader-toolbar" aria-label="Reader tools">
      <div className="tool-group" aria-label="Display mode">
        <button className="tool-button active" type="button" title="Markdown view">
          <FileText size={17} />
        </button>
        <button className="tool-button" type="button" title="Web view">
          <WholeWord size={17} />
        </button>
        <button className="tool-button" type="button" title="Compare view">
          <Columns2 size={17} />
        </button>
      </div>

      <div className="tool-group" aria-label="Article actions">
        <button className="tool-button" type="button" title="Translate">
          <Languages size={17} />
        </button>
        <button className="tool-button" type="button" title="Tag">
          <Tags size={17} />
        </button>
        <button className="tool-button" type="button" title="Note">
          <NotebookPen size={17} />
        </button>
        <button className="tool-button" type="button" title="Theme">
          <Palette size={17} />
        </button>
        <button className="tool-button" type="button" title="Share">
          <Share2 size={17} />
        </button>
      </div>

      <div className="tool-group search-group" aria-label="Search">
        <button className="tool-button" type="button" title="Search">
          <Search size={17} />
        </button>
      </div>
    </div>
  );
}

function formatFullDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
