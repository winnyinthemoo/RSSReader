import type {
  ArticleDetail,
  ArticleListFilter,
  ArticleListResult,
  ArticleMarkFavoriteRequest,
  ArticleMarkReadRequest,
  ArticleNote,
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
  TagDeleteRequest,
  TagListResult,
  TagMergeRequest,
  TagRenameRequest,
} from "../../../shared/feed";

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriUnlisten = () => void;
type TauriEvent<T> = {
  payload: T;
};
type TauriListen = <T>(
  event: string,
  handler: (event: TauriEvent<T>) => void,
) => Promise<TauriUnlisten>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
      tauri?: {
        invoke?: TauriInvoke;
      };
      event?: {
        listen?: TauriListen;
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

export async function renameTag(request: TagRenameRequest): Promise<TagListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TagListResult>("tag_rename", {
      tagId: request.tagId,
      name: request.name,
    });
  }

  return requestJson<TagListResult>("/api/tags/rename", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function mergeTags(request: TagMergeRequest): Promise<TagListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TagListResult>("tag_merge", {
      sourceTagId: request.sourceTagId,
      targetTagId: request.targetTagId,
    });
  }

  return requestJson<TagListResult>("/api/tags/merge", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function deleteTag(request: TagDeleteRequest): Promise<TagListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TagListResult>("tag_delete", {
      tagId: request.tagId,
    });
  }

  return requestJson<TagListResult>("/api/tags/delete", {
    method: "POST",
    body: JSON.stringify(request),
  });
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
  if (filter.tagIds && filter.tagIds.length > 0) {
    for (const tagId of filter.tagIds) {
      params.append("tagIds", tagId);
    }
  }
  if (filter.tagMatch) {
    params.set("tagMatch", filter.tagMatch);
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
