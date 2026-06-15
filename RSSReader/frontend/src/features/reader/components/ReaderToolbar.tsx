import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  ExternalLink,
  FileText,
  Globe2,
  Languages,
  NotebookPen,
  RotateCw,
  Palette,
  Search,
  Settings,
  Share2,
  Tags,
  X,
} from "lucide-react";

import type { ArticleDetail } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { translationLanguageOptions } from "../options";
import type { FontSize, ReaderPanel, ThemeBg, ViewMode } from "../types";
import { ThemePanel } from "./ThemePanel";

interface ReaderToolbarProps {
  appLanguage: AppLanguage;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showThemePanel: boolean;
  onToggleThemePanel: () => void;
  themeBg: ThemeBg;
  onThemeBgChange: (bg: ThemeBg) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  bilingualOpen: boolean;
  targetLanguage?: string;
  onTargetLanguageChange?: (value: string) => void;
  onTranslate: () => void;
  onRetryTranslation?: () => void;
  translateDisabled?: boolean;
  activePanel?: ReaderPanel;
  searchQuery?: string;
  searchMatchCount?: number;
  activeSearchIndex?: number;
  searchPending?: boolean;
  onTogglePanel?: (panel: ReaderPanel) => void;
  onSearchQueryChange?: (value: string) => void;
  onSearchCompositionChange?: (isComposing: boolean) => void;
  onSearchStep?: (direction: 1 | -1) => void;
  onOpenAiSettings?: () => void;
  article?: ArticleDetail;
  shareStatus?: string;
  onShareStatusChange?: (status: string | undefined) => void;
  shareMarkdown?: string;
}

export function ReaderToolbar({
  appLanguage,
  viewMode,
  onViewModeChange,
  showThemePanel,
  onToggleThemePanel,
  themeBg,
  onThemeBgChange,
  fontSize,
  onFontSizeChange,
  bilingualOpen,
  targetLanguage = "zh-Hans",
  onTargetLanguageChange,
  onTranslate,
  onRetryTranslation,
  translateDisabled,
  activePanel,
  searchQuery = "",
  searchMatchCount = 0,
  activeSearchIndex = 0,
  searchPending = false,
  onTogglePanel,
  onSearchQueryChange,
  onSearchCompositionChange,
  onSearchStep,
  onOpenAiSettings,
  article,
  shareStatus,
  onShareStatusChange,
  shareMarkdown = "",
}: ReaderToolbarProps) {
  const text = getAppText(appLanguage);
  const themePanelRef = useRef<HTMLDivElement>(null);
  const sharePanelRef = useRef<HTMLDivElement>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const searchCountLabel = searchQuery.trim()
    ? searchPending
      ? "..."
      : searchMatchCount > 0
        ? `${Math.min(activeSearchIndex + 1, searchMatchCount)} / ${searchMatchCount}`
        : "0 / 0"
    : "";

  useEffect(() => {
    if (!showThemePanel) return;
    function handleClick(e: MouseEvent) {
      if (themePanelRef.current && !themePanelRef.current.contains(e.target as Node)) {
        onToggleThemePanel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showThemePanel, onToggleThemePanel]);

  useEffect(() => {
    if (!showSharePanel) return;
    function handleClick(e: MouseEvent) {
      if (sharePanelRef.current && !sharePanelRef.current.contains(e.target as Node)) {
        setShowSharePanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSharePanel]);

  async function handleCopyShare(value: string, status: string) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      onShareStatusChange?.(status);
      window.setTimeout(() => onShareStatusChange?.(undefined), 1500);
    } catch (error) {
      onShareStatusChange?.(error instanceof Error ? error.message : text.reader.copyFailed);
    }
  }

  return (
    <div className="reader-toolbar" aria-label={text.reader.readerTools}>
      <div className="tool-group reader-view-tools" aria-label={text.reader.displayMode}>
        <button
          className={`tool-button${viewMode === "markdown" ? " active" : ""}`}
          type="button"
          title={text.reader.markdownView}
          onClick={() => onViewModeChange("markdown")}
        >
          <FileText size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "source" ? " active" : ""}`}
          type="button"
          title={text.reader.originalPage}
          onClick={() => onViewModeChange("source")}
        >
          <Globe2 size={17} />
        </button>
        <button
          className={`tool-button${viewMode === "compare" ? " active" : ""}`}
          type="button"
          title={text.reader.compareOriginal}
          onClick={() => onViewModeChange("compare")}
        >
          <Columns2 size={17} />
        </button>
      </div>

      <div className="tool-group reader-action-tools" aria-label={text.reader.articleActions}>
        {onTargetLanguageChange ? (
          <select
            className="translation-lang-select"
            value={targetLanguage}
            onChange={(event) => onTargetLanguageChange(event.target.value)}
            disabled={translateDisabled}
            aria-label={text.reader.translationLanguage}
          >
            {translationLanguageOptions.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        ) : null}
        <button
          className={`tool-button${bilingualOpen ? " active" : ""}`}
          type="button"
          title={bilingualOpen ? text.reader.showOriginal : text.reader.translateArticle}
          disabled={translateDisabled}
          onClick={onTranslate}
        >
          <Languages size={17} />
        </button>
        {bilingualOpen && onRetryTranslation ? (
          <button
            className="tool-button"
            type="button"
            title={text.reader.retryTranslation}
            disabled={translateDisabled}
            onClick={onRetryTranslation}
          >
            <RotateCw size={17} />
          </button>
        ) : null}
        <button
          className={`tool-button${activePanel === "tag" ? " active" : ""}`}
          type="button"
          title={text.reader.tag}
          data-reader-panel-trigger
          onClick={() => onTogglePanel?.("tag")}
        >
          <Tags size={17} />
        </button>
        <button
          className={`tool-button${activePanel === "note" ? " active" : ""}`}
          type="button"
          title={text.reader.note}
          data-reader-panel-trigger
          onClick={() => onTogglePanel?.("note")}
        >
          <NotebookPen size={17} />
        </button>
        <div style={{ position: "relative" }}>
          <button
            className={`tool-button${showThemePanel ? " active" : ""}`}
            type="button"
            title={text.reader.theme}
            onClick={onToggleThemePanel}
          >
            <Palette size={17} />
          </button>
          {showThemePanel && (
            <ThemePanel
              ref={themePanelRef}
              appLanguage={appLanguage}
              themeBg={themeBg}
              onThemeBgChange={onThemeBgChange}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
            />
          )}
        </div>
        <div className="share-tool" ref={sharePanelRef}>
          <button
            className={`tool-button${showSharePanel ? " active" : ""}`}
            type="button"
            title={text.reader.share}
            disabled={!article}
            onClick={() => setShowSharePanel((current) => !current)}
          >
            <Share2 size={17} />
          </button>
          {showSharePanel && article ? (
            <div className="share-popover" role="menu" aria-label={text.reader.shareArticle}>
              <div className="share-popover-header">
                <strong>{text.reader.shareArticle}</strong>
                <span>{shareStatus ?? text.reader.copyDetailsOrOpen}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyShare(article.url, text.reader.linkCopied)}
              >
                {shareStatus === text.reader.linkCopied ? <Check size={15} /> : <Share2 size={15} />}
                <span>{text.reader.copyLink}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  void handleCopyShare(
                    shareMarkdown || `[${article.title}](${article.url})`,
                    text.reader.markdownCopied,
                  )
                }
              >
                <FileText size={15} />
                <span>{text.reader.copyMarkdown}</span>
              </button>
              <a href={article.url} target="_blank" rel="noreferrer" role="menuitem">
                <ExternalLink size={15} />
                <span>{text.reader.openOriginal}</span>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
              >
                <Share2 size={15} />
                <span>{text.reader.shareToX}</span>
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <div className="tool-group search-group open" aria-label={text.reader.search}>
        <div className="reader-search-bar" role="search" aria-disabled={!onSearchQueryChange}>
          <Search size={16} />
          <input
            value={searchQuery}
            disabled={!onSearchQueryChange}
            onChange={(event) => onSearchQueryChange?.(event.target.value)}
            onCompositionStart={() => onSearchCompositionChange?.(true)}
            onCompositionEnd={(event) => {
              onSearchCompositionChange?.(false);
              onSearchQueryChange?.(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearchStep?.(event.shiftKey ? -1 : 1);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onSearchStep?.(1);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onSearchStep?.(-1);
                return;
              }
              if (event.key === "Escape" && searchQuery) {
                event.preventDefault();
                onSearchQueryChange?.("");
              }
            }}
            placeholder={text.reader.searchArticles}
            aria-label={text.reader.searchArticlesAria}
          />
          <button
            className="tool-button reader-search-clear"
            type="button"
            title={text.reader.closeFind}
            disabled={!onSearchQueryChange || !searchQuery}
            onClick={() => onSearchQueryChange?.("")}
          >
            <X size={14} />
          </button>
          <span className="reader-search-count">{searchCountLabel}</span>
          <button
            className="tool-button"
            type="button"
            title={text.reader.previousMatch}
            disabled={!onSearchStep || searchMatchCount === 0}
            onClick={() => onSearchStep?.(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="tool-button"
            type="button"
            title={text.reader.nextMatch}
            disabled={!onSearchStep || searchMatchCount === 0}
            onClick={() => onSearchStep?.(1)}
          >
            <ChevronDown size={15} />
          </button>
        </div>
        <button
          className="tool-button ai-toolbar-button"
          type="button"
          title={text.common.settings}
          aria-label={text.common.settings}
          onClick={onOpenAiSettings}
        >
          <Settings size={17} />
        </button>
      </div>
    </div>
  );
}
