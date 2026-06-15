import type { ArticleDetail, ArticleNoteExportRequest } from "../../../../../shared/feed";
import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { formatFullDate } from "./date";

export function buildArticleNoteExport(
  article: ArticleDetail,
  noteContent: string,
  appLanguage: AppLanguage,
): ArticleNoteExportRequest {
  const text = getAppText(appLanguage);
  const title = article.title.trim() || "Untitled article";
  const publishedAt = article.publishedAt
    ? formatFullDate(article.publishedAt, appLanguage)
    : text.common.noDate;
  const content = [
    `# ${title}`,
    "",
    `- Source: ${article.feedTitle}`,
    `- Published: ${publishedAt}`,
    `- URL: ${article.url}`,
    "",
    "## Note",
    "",
    noteContent.trim(),
    "",
  ].join("\n");

  return {
    content,
    defaultFileName: `${slugifyFileName(title)}-note.md`,
  };
}

function slugifyFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (normalized || "article").slice(0, 80);
}
