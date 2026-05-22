use std::sync::{Mutex, OnceLock};

use super::{
    ArticleDetail, ArticleListFilter, ArticleListResult, ArticleMarkReadRequest, FeedAddRequest,
    FeedListResult, FeedRefreshRequest, FeedRefreshResult, FeedService, FeedWithArticles,
};

static FEED_SERVICE: OnceLock<Mutex<FeedService>> = OnceLock::new();

pub fn feed_list() -> FeedListResult {
    with_service(|service| service.list_feeds())
}

pub fn feed_add(url: String) -> Result<FeedWithArticles, String> {
    with_service(|service| service.add_feed(FeedAddRequest { url }))
}

pub fn feed_refresh(feed_id: String) -> Result<FeedRefreshResult, String> {
    with_service(|service| service.refresh_feed(FeedRefreshRequest { feed_id }))
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

fn with_service<T>(handler: impl FnOnce(&mut FeedService) -> T) -> T {
    let service = FEED_SERVICE.get_or_init(|| {
        Mutex::new(FeedService::new().expect("feed service should initialize"))
    });
    let mut guard = service.lock().expect("feed service lock should not be poisoned");
    handler(&mut guard)
}
