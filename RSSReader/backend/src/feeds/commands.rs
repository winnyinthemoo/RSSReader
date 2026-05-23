use std::sync::{Mutex, OnceLock};

use super::{
    ArticleDetail, ArticleListFilter, ArticleListResult, ArticleMarkFavoriteRequest,
    ArticleMarkReadRequest, ArticleNote, ArticleNoteSaveRequest, ArticleTagDeleteRequest,
    ArticleTagsResult, ArticleTagsSaveRequest, FeedAddRequest, FeedDeleteRequest, FeedListResult,
    FeedRefreshRequest, FeedRefreshResult, FeedService, FeedWithArticles, TagListResult,
};

static FEED_SERVICE: OnceLock<Mutex<FeedService>> = OnceLock::new();

pub fn feed_list() -> FeedListResult {
    with_service(|service| service.list_feeds())
}

pub fn feed_add(url: String, name: Option<String>) -> Result<FeedWithArticles, String> {
    with_service(|service| service.add_feed(FeedAddRequest { url, name }))
}

pub fn feed_refresh(feed_id: String) -> Result<FeedRefreshResult, String> {
    with_service(|service| service.refresh_feed(FeedRefreshRequest { feed_id }))
}

pub fn feed_delete(feed_id: String) -> Result<(), String> {
    with_service(|service| service.delete_feed(FeedDeleteRequest { feed_id }))
}

pub fn article_list(filter: ArticleListFilter) -> ArticleListResult {
    with_service(|service| ArticleListResult {
        articles: service.list_articles(filter),
    })
}

pub fn article_get(article_id: String) -> Result<ArticleDetail, String> {
    with_service(|service| {
        service
            .get_article(&article_id)
            .ok_or_else(|| "Article not found".to_string())
    })
}

pub fn article_mark_read(article_id: String, is_read: bool) -> Result<(), String> {
    with_service(|service| {
        service.mark_article_read(ArticleMarkReadRequest {
            article_id,
            is_read,
        })
    })
}

pub fn article_mark_favorite(article_id: String, is_favorite: bool) -> Result<(), String> {
    with_service(|service| {
        service.mark_article_favorite(ArticleMarkFavoriteRequest {
            article_id,
            is_favorite,
        })
    })
}

pub fn tag_list() -> TagListResult {
    with_service(|service| service.list_tags())
}

pub fn article_list_tags(article_id: String) -> ArticleTagsResult {
    with_service(|service| service.list_article_tags(&article_id))
}

pub fn article_save_tags(
    article_id: String,
    tags: Vec<String>,
    source: String,
) -> Result<ArticleTagsResult, String> {
    with_service(|service| {
        service.save_article_tags(ArticleTagsSaveRequest {
            article_id,
            tags,
            source,
        })
    })
}

pub fn article_delete_tag(article_id: String, tag_id: String) -> Result<(), String> {
    with_service(|service| {
        service.delete_article_tag(ArticleTagDeleteRequest { article_id, tag_id })
    })
}

pub fn article_get_note(article_id: String) -> Option<ArticleNote> {
    with_service(|service| service.get_article_note(&article_id))
}

pub fn article_save_note(article_id: String, content: String) -> Result<ArticleNote, String> {
    with_service(|service| {
        service.save_article_note(ArticleNoteSaveRequest {
            article_id,
            content,
        })
    })
}

fn with_service<T>(handler: impl FnOnce(&mut FeedService) -> T) -> T {
    let service = FEED_SERVICE.get_or_init(|| {
        Mutex::new(FeedService::new().expect("feed service should initialize"))
    });
    let mut guard = service.lock().expect("feed service lock should not be poisoned");
    handler(&mut guard)
}
