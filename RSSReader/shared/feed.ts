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
  name?: string;
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

export interface ArticleMarkFavoriteRequest {
  articleId: string;
  isFavorite: boolean;
}

export interface ArticleListFilter {
  feedId?: string;
  unreadOnly?: boolean;
  favoritesOnly?: boolean;
  tagId?: string;
  tagIds?: string[];
  tagMatch?: TagMatchMode;
}

export type TagMatchMode = "any" | "all";

export interface TagSummary {
  id: string;
  name: string;
  articleCount: number;
}

export interface ArticleTag {
  id: string;
  name: string;
  source: string;
}

export interface ArticleTagsResult {
  tags: ArticleTag[];
}

export interface ArticleTagsSaveRequest {
  articleId: string;
  tags: string[];
  source: "manual" | "ai";
}

export interface ArticleTagDeleteRequest {
  articleId: string;
  tagId: string;
}

export interface TagRenameRequest {
  tagId: string;
  name: string;
}

export interface TagMergeRequest {
  sourceTagId: string;
  targetTagId: string;
}

export interface TagDeleteRequest {
  tagId: string;
}

export interface ArticleNote {
  articleId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleNoteSaveRequest {
  articleId: string;
  content: string;
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

export interface TagListResult {
  tags: TagSummary[];
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
