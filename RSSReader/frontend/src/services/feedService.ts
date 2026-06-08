import type {
  ArticleDetail,
  ArticleListFilter,
  ArticleListResult,
  ArticleMarkFavoriteRequest,
  ArticleMarkReadRequest,
  ArticleNote,
  ArticleNoteExportRequest,
  ArticleNoteExportResult,
  ArticleNoteSaveRequest,
  ArticleTagDeleteRequest,
  ArticleTagsResult,
  ArticleTagsSaveRequest,
  FeedAddRequest,
  FeedDeleteRequest,
  FeedListResult,
  FeedRefreshRequest,
  FeedRefreshResult,
  FeedWithArticles,
  OpmlExportRequest,
  OpmlExportResult,
  OpmlImportItemResult,
  OpmlImportRequest,
  OpmlImportResult,
  TagListResult,
} from "../../../shared/feed";

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
      tauri?: {
        invoke?: TauriInvoke;
      };
    };
  }
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:5181";

function getInvoke(): TauriInvoke | undefined {
  return window.__TAURI__?.core?.invoke ?? window.__TAURI__?.tauri?.invoke;
}

export async function listFeeds(): Promise<FeedListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<FeedListResult>("feed_list");
  }

  return requestJson<FeedListResult>("/api/feeds");
}

export async function listTags(): Promise<TagListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TagListResult>("tag_list");
  }

  return requestJson<TagListResult>("/api/tags");
}

export async function addFeed(request: FeedAddRequest): Promise<FeedWithArticles> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<FeedWithArticles>("feed_add", { url: request.url, name: request.name });
  }

  return requestJson<FeedWithArticles>("/api/feeds", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function refreshFeed(request: FeedRefreshRequest): Promise<FeedRefreshResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<FeedRefreshResult>("feed_refresh", { feedId: request.feedId });
  }

  return requestJson<FeedRefreshResult>("/api/feeds/refresh", {
    method: "POST",
    body: JSON.stringify({ feedId: request.feedId }),
  });
}

export async function deleteFeed(request: FeedDeleteRequest): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("feed_delete", { feedId: request.feedId });
  }

  await requestJson<{ ok: boolean }>("/api/feeds/delete", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function listArticles(filter: ArticleListFilter = {}): Promise<ArticleListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleListResult>("article_list", { filter });
  }

  const params = new URLSearchParams();
  if (filter.feedId) {
    params.set("feedId", filter.feedId);
  }
  if (filter.unreadOnly) {
    params.set("unreadOnly", "true");
  }
  if (filter.favoritesOnly) {
    params.set("favoritesOnly", "true");
  }
  if (filter.tagId) {
    params.set("tagId", filter.tagId);
  }

  const query = params.toString();
  return requestJson<ArticleListResult>(`/api/articles${query ? `?${query}` : ""}`);
}

export async function getArticle(articleId: string): Promise<ArticleDetail> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleDetail>("article_get", { articleId });
  }

  return requestJson<ArticleDetail>(`/api/articles/${encodeURIComponent(articleId)}`);
}

export async function markArticleRead(request: ArticleMarkReadRequest): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("article_mark_read", {
      articleId: request.articleId,
      isRead: request.isRead,
    });
  }

  await requestJson<{ ok: boolean }>("/api/articles/mark-read", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function markArticleFavorite(request: ArticleMarkFavoriteRequest): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("article_mark_favorite", {
      articleId: request.articleId,
      isFavorite: request.isFavorite,
    });
  }

  await requestJson<{ ok: boolean }>("/api/articles/mark-favorite", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function listArticleTags(articleId: string): Promise<ArticleTagsResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleTagsResult>("article_list_tags", { articleId });
  }

  return requestJson<ArticleTagsResult>(`/api/articles/${encodeURIComponent(articleId)}/tags`);
}

export async function saveArticleTags(
  request: ArticleTagsSaveRequest,
): Promise<ArticleTagsResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleTagsResult>("article_save_tags", {
      articleId: request.articleId,
      tags: request.tags,
      source: request.source,
    });
  }

  return requestJson<ArticleTagsResult>("/api/articles/tags", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function deleteArticleTag(request: ArticleTagDeleteRequest): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("article_delete_tag", {
      articleId: request.articleId,
      tagId: request.tagId,
    });
  }

  await requestJson<{ ok: boolean }>("/api/articles/tags/delete", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getArticleNote(articleId: string): Promise<ArticleNote | null> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleNote | null>("article_get_note", { articleId });
  }

  return requestJson<ArticleNote | null>(`/api/articles/${encodeURIComponent(articleId)}/note`);
}

export async function saveArticleNote(
  request: ArticleNoteSaveRequest,
): Promise<ArticleNote> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleNote>("article_save_note", {
      articleId: request.articleId,
      content: request.content,
    });
  }

  return requestJson<ArticleNote>("/api/articles/note", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function exportArticleNote(
  request: ArticleNoteExportRequest,
): Promise<ArticleNoteExportResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleNoteExportResult>("article_note_export", { request });
  }

  downloadTextFile(request.content, request.defaultFileName, "text/markdown;charset=utf-8");
  return { saved: true };
}

export async function exportOpml(request: OpmlExportRequest): Promise<OpmlExportResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<OpmlExportResult>("opml_export", { request });
  }

  downloadTextFile(request.content, request.defaultFileName, "text/x-opml;charset=utf-8");
  return { saved: true };
}

export async function importOpml(request: OpmlImportRequest = {}): Promise<OpmlImportResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<OpmlImportResult>("opml_import", { request });
  }

  const content = request.content ?? (await pickTextFile(".opml,.xml,text/xml"));
  if (!content) {
    return emptyOpmlImportResult(false);
  }

  const outlines = parseOpmlOutlines(content);
  const items: OpmlImportItemResult[] = [];
  const seenUrls = new Set<string>();
  const knownUrls = new Set(
    (await listFeeds()).feeds
      .map((feed) => normalizeFeedUrl(feed.url))
      .filter((url): url is string => Boolean(url)),
  );

  for (const outline of outlines) {
    const url = normalizeFeedUrl(outline.url);
    if (!url) {
      items.push({
        url: outline.url,
        title: outline.title,
        status: "failed",
        message: "Feed URL must start with http:// or https://",
      });
      continue;
    }

    if (seenUrls.has(url)) {
      items.push({
        url,
        title: outline.title,
        status: "skipped",
        message: "Duplicate feed in OPML",
      });
      continue;
    }

    seenUrls.add(url);
    if (knownUrls.has(url)) {
      items.push({
        url,
        title: outline.title,
        status: "skipped",
        message: "Feed already subscribed",
      });
      continue;
    }

    try {
      await addFeed({ url, name: outline.title });
      knownUrls.add(url);
      items.push({ url, title: outline.title, status: "imported" });
    } catch (error) {
      items.push({
        url,
        title: outline.title,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summarizeOpmlImport(true, items);
}

function downloadTextFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function pickTextFile(accept: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(undefined);
        return;
      }

      try {
        resolve(await file.text());
      } catch (error) {
        reject(error);
      }
    });

    document.body.appendChild(input);
    input.click();
  });
}

function parseOpmlOutlines(content: string) {
  const document = new DOMParser().parseFromString(content, "text/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid OPML file.");
  }

  return Array.from(document.querySelectorAll("outline"))
    .map((outline) => ({
      url:
        outline.getAttribute("xmlUrl") ??
        outline.getAttribute("xmlurl") ??
        outline.getAttribute("url") ??
        "",
      title:
        outline.getAttribute("title") ??
        outline.getAttribute("text") ??
        outline.getAttribute("description") ??
        undefined,
    }))
    .filter((outline) => outline.url.trim().length > 0);
}

function normalizeFeedUrl(value: string) {
  const url = value.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return undefined;
  }

  return url.replace(/\/+$/, "");
}

function summarizeOpmlImport(
  selected: boolean,
  items: OpmlImportItemResult[],
): OpmlImportResult {
  return {
    selected,
    total: items.length,
    imported: items.filter((item) => item.status === "imported").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    failed: items.filter((item) => item.status === "failed").length,
    items,
  };
}

function emptyOpmlImportResult(selected: boolean): OpmlImportResult {
  return {
    selected,
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    items: [],
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${backendBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to backend at ${backendBaseUrl}. Run RSSReader/scripts/backend-dev.cmd first.`,
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
