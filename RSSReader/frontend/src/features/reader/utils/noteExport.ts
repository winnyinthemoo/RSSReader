import type { ArticleDetail, ArticleNoteExportRequest } from "../../../../../shared/feed";
import { formatFullDate } from "./date";

export function buildArticleNoteExport(
  article: ArticleDetail,
  noteContent: string,
): ArticleNoteExportRequest {
  const title = article.title.trim() || "Untitled article";
  const publishedAt = article.publishedAt ? formatFullDate(article.publishedAt) : "No date";
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
