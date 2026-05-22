import type {
  ArticleDetail,
  ArticleListFilter,
  ArticleListResult,
  ArticleMarkReadRequest,
  FeedAddRequest,
  FeedListResult,
  FeedRefreshRequest,
  FeedRefreshResult,
  FeedWithArticles,
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

export async function addFeed(request: FeedAddRequest): Promise<FeedWithArticles> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<FeedWithArticles>("feed_add", { url: request.url });
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
