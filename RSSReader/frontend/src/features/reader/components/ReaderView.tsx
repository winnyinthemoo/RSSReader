import { useCallback, useEffect, useState } from "react";
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

import { BilingualTranslationView } from "../../ai/components/BilingualTranslationView";
import { SummaryPanel } from "../../ai/components/SummaryPanel";
import type { TranslationView } from "../../../../../shared/ai";
import type { ArticleDetail } from "../../../../../shared/feed";
import { getArticleTranslation, startTranslation } from "../../../services/aiService";

interface ReaderViewProps {
  article?: ArticleDetail;
}

export function ReaderView({ article }: ReaderViewProps) {
  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans");
  const [translation, setTranslation] = useState<TranslationView | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | undefined>();

  const loadCachedTranslation = useCallback(async () => {
    if (!article?.id) {
      setTranslation(undefined);
      return;
    }
    try {
      const cached = await getArticleTranslation(article.id, targetLanguage);
      setTranslation(cached ?? undefined);
      setTranslationError(undefined);
    } catch (error) {
      setTranslation(undefined);
      setTranslationError(getErrorMessage(error));
    }
  }, [article?.id, targetLanguage]);

  useEffect(() => {
    setBilingualOpen(false);
    setTranslation(undefined);
    setTranslationError(undefined);
  }, [article?.id]);

  useEffect(() => {
    if (bilingualOpen && article?.id) {
      void loadCachedTranslation();
    }
  }, [bilingualOpen, loadCachedTranslation, article?.id, targetLanguage]);

  async function handleTranslate() {
    if (!article?.id) {
      return;
    }

    if (bilingualOpen) {
      setBilingualOpen(false);
      return;
    }

    setBilingualOpen(true);
    setTranslationError(undefined);

    const cached = await getArticleTranslation(article.id, targetLanguage).catch((error) => {
      setTranslationError(getErrorMessage(error));
      return null;
    });

    if (cached && cached.segments.length > 0 && cached.status !== "failed") {
      setTranslation(cached);
      return;
    }

    try {
      setTranslationLoading(true);
      setTranslation(undefined);
      const result = await startTranslation({
        articleId: article.id,
        targetLanguage,
      });
      setTranslation(result);
      setTranslationError(undefined);
    } catch (error) {
      setTranslationError(getErrorMessage(error));
    } finally {
      setTranslationLoading(false);
    }
  }

  if (!article) {
    return (
      <section className="reader-pane">
        <ReaderToolbar bilingualOpen={false} onTranslate={() => undefined} />
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
      <ReaderToolbar
        bilingualOpen={bilingualOpen}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={setTargetLanguage}
        onTranslate={() => void handleTranslate()}
        translateDisabled={translationLoading}
      />
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

      {bilingualOpen ? (
        <BilingualTranslationView
          articleHtml={article.sanitizedHtml}
          translation={translation}
          isLoading={translationLoading}
          errorMessage={translationError}
        />
      ) : (
        <div
          className="reader-content"
          dangerouslySetInnerHTML={{ __html: article.sanitizedHtml }}
        />
      )}

      <SummaryPanel articleId={article.id} />
    </article>
  );
}

interface ReaderToolbarProps {
  bilingualOpen: boolean;
  targetLanguage?: string;
  onTargetLanguageChange?: (value: string) => void;
  onTranslate: () => void;
  translateDisabled?: boolean;
}

function ReaderToolbar({
  bilingualOpen,
  targetLanguage = "zh-Hans",
  onTargetLanguageChange,
  onTranslate,
  translateDisabled,
}: ReaderToolbarProps) {
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
        {bilingualOpen && onTargetLanguageChange ? (
          <select
            className="translation-lang-select"
            value={targetLanguage}
            onChange={(event) => onTargetLanguageChange(event.target.value)}
            disabled={translateDisabled}
            aria-label="Translation language"
          >
            <option value="zh-Hans">简体中文</option>
            <option value="en">English</option>
          </select>
        ) : null}
        <button
          className={`tool-button ${bilingualOpen ? "active" : ""}`}
          type="button"
          title={bilingualOpen ? "Show original" : "Translate"}
          disabled={translateDisabled}
          onClick={onTranslate}
        >
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
