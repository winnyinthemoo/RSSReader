#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FeedStatus {
    Active,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedSummary {
    pub id: String,
    pub title: String,
    pub source_title: Option<String>,
    pub custom_title: Option<String>,
    pub url: String,
    pub site_url: Option<String>,
    pub description: Option<String>,
    pub unread_count: usize,
    pub article_count: usize,
    pub last_fetched_at: Option<String>,
    pub status: FeedStatus,
    pub error_message: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedAddRequest {
    pub url: String,
    pub name: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedDeleteRequest {
    pub feed_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedRefreshRequest {
    pub feed_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleMarkReadRequest {
    pub article_id: String,
    pub is_read: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleMarkFavoriteRequest {
    pub article_id: String,
    pub is_favorite: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ArticleListFilter {
    pub feed_id: Option<String>,
    pub unread_only: bool,
    pub favorites_only: bool,
    pub tag_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TagSummary {
    pub id: String,
    pub name: String,
    pub article_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleTag {
    pub id: String,
    pub name: String,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleTagsResult {
    pub tags: Vec<ArticleTag>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleTagsSaveRequest {
    pub article_id: String,
    pub tags: Vec<String>,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleTagDeleteRequest {
    pub article_id: String,
    pub tag_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleNote {
    pub article_id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleNoteSaveRequest {
    pub article_id: String,
    pub content: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleListItem {
    pub id: String,
    pub feed_id: String,
    pub feed_title: String,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub excerpt: String,
    pub is_read: bool,
    pub is_favorite: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleDetail {
    pub id: String,
    pub feed_id: String,
    pub feed_title: String,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub excerpt: String,
    pub is_read: bool,
    pub is_favorite: bool,
    pub sanitized_html: String,
}

impl ArticleDetail {
    pub fn list_item(&self) -> ArticleListItem {
        ArticleListItem {
            id: self.id.clone(),
            feed_id: self.feed_id.clone(),
            feed_title: self.feed_title.clone(),
            title: self.title.clone(),
            url: self.url.clone(),
            author: self.author.clone(),
            published_at: self.published_at.clone(),
            excerpt: self.excerpt.clone(),
            is_read: self.is_read,
            is_favorite: self.is_favorite,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArticleListResult {
    pub articles: Vec<ArticleListItem>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedWithArticles {
    pub feed: FeedSummary,
    pub articles: Vec<ArticleListItem>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedListResult {
    pub feeds: Vec<FeedSummary>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TagListResult {
    pub tags: Vec<TagSummary>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedRefreshResult {
    pub feed: FeedSummary,
    pub new_articles: Vec<ArticleListItem>,
}
