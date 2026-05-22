export type FeedStatus = "active" | "error";

export interface FeedSummary {
  id: string;
  title: string;
  url: string;
  siteUrl?: string;
  description?: string;
  unreadCount: number;
  articleCount: number;
  lastFetchedAt?: string;
  status: FeedStatus;
  errorMessage?: string;
}

export interface FeedAddRequest {
  url: string;
}

export interface FeedDeleteRequest {
  feedId: string;
}

export interface FeedRefreshRequest {
  feedId: string;
}

export interface ArticleMarkReadRequest {
  articleId: string;
  isRead: boolean;
}

export interface ArticleListFilter {
  feedId?: string;
  unreadOnly?: boolean;
}

export interface ArticleListItem {
  id: string;
  feedId: string;
  feedTitle: string;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  excerpt: string;
  isRead: boolean;
  isFavorite: boolean;
}

export interface ArticleDetail extends ArticleListItem {
  sanitizedHtml: string;
}

export interface FeedWithArticles {
  feed: FeedSummary;
  articles: ArticleListItem[];
}

export interface FeedListResult {
  feeds: FeedSummary[];
}

export interface ArticleListResult {
  articles: ArticleListItem[];
}

export interface FeedRefreshResult {
  feed: FeedSummary;
  newArticles: ArticleListItem[];
}

export interface AppErrorPayload {
  code: string;
  message: string;
}
