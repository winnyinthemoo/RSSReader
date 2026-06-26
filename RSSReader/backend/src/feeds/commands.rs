use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
    thread,
};

use super::{
    enrich_rss_content, strip_html, ArticleDetail, ArticleListFilter, ArticleListResult,
    ArticleMarkFavoriteRequest, ArticleMarkReadRequest, ArticleNote, ArticleNoteSaveRequest,
    ArticleTagDeleteRequest, ArticleTagsResult, ArticleTagsSaveRequest, FeedAddRequest,
    FeedDeleteRequest, FeedListResult, FeedRefreshRequest, FeedRefreshResult, FeedRenameRequest,
    FeedRepository, FeedService, FeedWithArticles, TagDeleteRequest, TagListResult,
    TagMergeRequest, TagRenameRequest,
};

static FEED_SERVICE: OnceLock<Mutex<FeedService>> = OnceLock::new();
static ARTICLE_ENRICHMENT_JOBS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
const MAX_ARTICLE_ENRICHMENT_JOBS: usize = 2;

pub fn feed_list() -> FeedListResult {
    with_service(|service| service.list_feeds())
}

pub fn feed_add(url: String, name: Option<String>) -> Result<FeedWithArticles, String> {
    with_service(|service| service.add_feed(FeedAddRequest { url, name }))
}

pub fn feed_subscribe(url: String, name: Option<String>) -> Result<FeedWithArticles, String> {
    with_service(|service| service.subscribe_feed(FeedAddRequest { url, name }))
}

pub fn feed_refresh_isolated(feed_id: String) -> Result<FeedRefreshResult, String> {
    let mut service = FeedService::new()?;
    service.refresh_feed(FeedRefreshRequest { feed_id })
}

pub fn feed_refresh(feed_id: String) -> Result<FeedRefreshResult, String> {
    with_service(|service| service.refresh_feed(FeedRefreshRequest { feed_id }))
}

pub fn feed_delete(feed_id: String) -> Result<(), String> {
    with_service(|service| service.delete_feed(FeedDeleteRequest { feed_id }))
}

pub fn feed_rename(feed_id: String, title: String) -> Result<FeedListResult, String> {
    with_service(|service| service.rename_feed(FeedRenameRequest { feed_id, title }))
}

pub fn article_list(filter: ArticleListFilter) -> ArticleListResult {
    with_service(|service| ArticleListResult {
        articles: service.list_articles(filter),
    })
}

pub fn article_get(article_id: String) -> Result<ArticleDetail, String> {
    let article = with_service(|service| {
        service
            .get_article(&article_id)
            .ok_or_else(|| "Article not found".to_string())
    })?;
    maybe_queue_article_enrichment(&article);
    Ok(article)
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

pub fn tag_rename(tag_id: String, name: String) -> Result<TagListResult, String> {
    with_service(|service| service.rename_tag(TagRenameRequest { tag_id, name }))
}

pub fn tag_merge(source_tag_id: String, target_tag_id: String) -> Result<TagListResult, String> {
    with_service(|service| {
        service.merge_tags(TagMergeRequest {
            source_tag_id,
            target_tag_id,
        })
    })
}

pub fn tag_delete(tag_id: String) -> Result<TagListResult, String> {
    with_service(|service| service.delete_tag(TagDeleteRequest { tag_id }))
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
    let service = FEED_SERVICE
        .get_or_init(|| Mutex::new(FeedService::new().expect("feed service should initialize")));
    let mut guard = service
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    handler(&mut guard)
}

fn maybe_queue_article_enrichment(article: &ArticleDetail) {
    let current_plain_len = strip_html(&article.sanitized_html).chars().count();
    if current_plain_len >= 1800 || !is_http_url(&article.url) {
        return;
    }

    let article_id = article.id.clone();
    {
        let mut jobs = article_enrichment_jobs()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if jobs.len() >= MAX_ARTICLE_ENRICHMENT_JOBS {
            return;
        }
        if !jobs.insert(article_id.clone()) {
            return;
        }
    }

    let url = article.url.clone();
    let current_html = article.sanitized_html.clone();
    let spawn_result = thread::Builder::new()
        .name("rssreader-article-enrichment".to_string())
        .spawn(move || {
            let result = std::panic::catch_unwind(|| enrich_rss_content(&url, &current_html));
            if let Ok(enriched_html) = result {
                let enriched_plain_len = strip_html(&enriched_html).chars().count();
                if enriched_plain_len > current_plain_len
                    && enriched_html.trim() != current_html.trim()
                {
                    if let Ok(repository) = FeedRepository::open_default() {
                        let _ = repository.update_article_content(&article_id, &enriched_html);
                    }
                }
            }
            finish_article_enrichment_job(&article_id);
        });

    if spawn_result.is_err() {
        finish_article_enrichment_job(&article.id);
    }
}

fn article_enrichment_jobs() -> &'static Mutex<HashSet<String>> {
    ARTICLE_ENRICHMENT_JOBS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn finish_article_enrichment_job(article_id: &str) {
    let mut jobs = article_enrichment_jobs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    jobs.remove(article_id);
}

fn is_http_url(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://")
}
