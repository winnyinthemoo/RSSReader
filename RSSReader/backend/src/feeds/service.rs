use super::{
    fetch_and_parse_feed, ArticleDetail, ArticleListFilter, ArticleListItem,
    ArticleMarkFavoriteRequest, ArticleMarkReadRequest, ArticleNote, ArticleNoteSaveRequest,
    ArticleTagDeleteRequest, ArticleTagsResult, ArticleTagsSaveRequest, FeedAddRequest,
    FeedDeleteRequest, FeedListResult, FeedRefreshRequest, FeedRefreshResult, FeedRenameRequest,
    FeedRepository, FeedStatus, FeedWithArticles, TagDeleteRequest, TagListResult,
    TagMergeRequest, TagRenameRequest,
};

pub struct FeedService {
    repository: FeedRepository,
}

impl FeedService {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            repository: FeedRepository::open_default()?,
        })
    }

    pub fn with_repository(repository: FeedRepository) -> Self {
        Self { repository }
    }

    pub fn list_feeds(&self) -> FeedListResult {
        FeedListResult {
            feeds: self.repository.list_feeds().unwrap_or_default(),
        }
    }

    pub fn add_feed(&mut self, request: FeedAddRequest) -> Result<FeedWithArticles, String> {
        let normalized_url = normalize_feed_url(&request.url)?;
        if let Some(mut existing) = self.repository.get_feed_by_url(&normalized_url)? {
            if let Some(name) = request
                .name
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
            {
                existing.custom_title = Some(name.to_string());
                existing.title = name.to_string();
                self.repository.save_feed(&existing)?;
            }

            return Ok(FeedWithArticles {
                feed: existing.clone(),
                articles: self.repository.list_articles(ArticleListFilter {
                    feed_id: Some(existing.id),
                    unread_only: false,
                    favorites_only: false,
                    tag_id: None,
                    ..Default::default()
                })?,
            });
        }

        let parsed = fetch_and_parse_feed(&normalized_url)?;
        let mut feed = parsed.feed;
        if let Some(name) = request
            .name
            .as_deref()
            .map(str::trim)
            .filter(|name| !name.is_empty())
        {
            feed.custom_title = Some(name.to_string());
            feed.title = name.to_string();
        }

        self.repository.save_feed(&feed)?;
        for article in &parsed.articles {
            self.repository.save_article(article)?;
        }

        let feed = self.repository.get_feed(&feed.id)?.unwrap_or(feed);
        let articles = self.repository.list_articles(ArticleListFilter {
            feed_id: Some(feed.id.clone()),
            unread_only: false,
            favorites_only: false,
            tag_id: None,
            ..Default::default()
        })?;

        Ok(FeedWithArticles { feed, articles })
    }

    pub fn refresh_feed(
        &mut self,
        request: FeedRefreshRequest,
    ) -> Result<FeedRefreshResult, String> {
        let mut feed = self
            .repository
            .get_feed(&request.feed_id)?
            .ok_or_else(|| "Feed not found".to_string())?;
        let parsed = match fetch_and_parse_feed(&feed.url) {
            Ok(parsed) => parsed,
            Err(error) => {
                feed.status = FeedStatus::Error;
                feed.error_message = Some(error.clone());
                feed.last_fetched_at = Some(now_marker());
                self.repository.save_feed(&feed)?;
                return Err(error);
            }
        };
        feed.source_title = parsed.feed.source_title.or(Some(parsed.feed.title));
        feed.title = feed
            .custom_title
            .clone()
            .or_else(|| feed.source_title.clone())
            .unwrap_or_else(|| feed.title.clone());
        feed.site_url = parsed.feed.site_url;
        feed.description = parsed.feed.description;
        feed.last_fetched_at = parsed.feed.last_fetched_at;
        feed.status = parsed.feed.status;
        feed.error_message = None;
        self.repository.save_feed(&feed)?;

        let new_articles = self
            .repository
            .save_articles_for_refresh(&feed.title, &parsed.articles)?;

        let (article_count, unread_count) = self.repository.feed_article_counts(&feed.id)?;
        feed.article_count = article_count;
        feed.unread_count = unread_count;
        self.repository.save_feed(&feed)?;

        Ok(FeedRefreshResult { feed, new_articles })
    }

    pub fn list_articles(&self, filter: ArticleListFilter) -> Vec<ArticleListItem> {
        self.repository.list_articles(filter).unwrap_or_default()
    }

    pub fn get_article(&self, article_id: &str) -> Option<ArticleDetail> {
        self.repository.get_article(article_id).ok().flatten()
    }

    pub fn update_article_content(&self, article_id: &str, html: &str) -> Result<(), String> {
        self.repository.update_article_content(article_id, html)
    }

    pub fn mark_article_read(&mut self, request: ArticleMarkReadRequest) -> Result<(), String> {
        self.repository
            .mark_article_read(&request.article_id, request.is_read)
    }

    pub fn mark_article_favorite(
        &mut self,
        request: ArticleMarkFavoriteRequest,
    ) -> Result<(), String> {
        self.repository
            .mark_article_favorite(&request.article_id, request.is_favorite)
    }

    pub fn list_tags(&self) -> TagListResult {
        TagListResult {
            tags: self.repository.list_tags().unwrap_or_default(),
        }
    }

    pub fn list_article_tags(&self, article_id: &str) -> ArticleTagsResult {
        ArticleTagsResult {
            tags: self
                .repository
                .list_article_tags(article_id)
                .unwrap_or_default(),
        }
    }

    pub fn save_article_tags(
        &mut self,
        request: ArticleTagsSaveRequest,
    ) -> Result<ArticleTagsResult, String> {
        for tag in &request.tags {
            let display = tag.trim();
            if display.is_empty() {
                continue;
            }
            let normalized = normalize_tag_name(display);
            if normalized.is_empty() {
                continue;
            }
            self.repository.save_article_tag(
                &request.article_id,
                display,
                &normalized,
                &request.source,
            )?;
        }

        Ok(self.list_article_tags(&request.article_id))
    }

    pub fn delete_article_tag(&mut self, request: ArticleTagDeleteRequest) -> Result<(), String> {
        self.repository
            .delete_article_tag(&request.article_id, &request.tag_id)
    }

    pub fn rename_tag(&mut self, request: TagRenameRequest) -> Result<TagListResult, String> {
        let display = request.name.trim();
        if display.is_empty() {
            return Err("Tag name cannot be empty".to_string());
        }
        let normalized = normalize_tag_name(display);
        if normalized.is_empty() {
            return Err("Tag name must contain letters or numbers".to_string());
        }

        self.repository
            .rename_tag(&request.tag_id, display, &normalized)?;
        Ok(self.list_tags())
    }

    pub fn merge_tags(&mut self, request: TagMergeRequest) -> Result<TagListResult, String> {
        self.repository
            .merge_tags(&request.source_tag_id, &request.target_tag_id)?;
        Ok(self.list_tags())
    }

    pub fn delete_tag(&mut self, request: TagDeleteRequest) -> Result<TagListResult, String> {
        self.repository.delete_tag(&request.tag_id)?;
        Ok(self.list_tags())
    }

    pub fn get_article_note(&self, article_id: &str) -> Option<ArticleNote> {
        self.repository.get_article_note(article_id).ok().flatten()
    }

    pub fn save_article_note(
        &mut self,
        request: ArticleNoteSaveRequest,
    ) -> Result<ArticleNote, String> {
        self.repository
            .save_article_note(&request.article_id, &request.content)
    }

    pub fn delete_feed(&mut self, request: FeedDeleteRequest) -> Result<(), String> {
        self.repository.delete_feed(&request.feed_id)
    }

    pub fn rename_feed(&mut self, request: FeedRenameRequest) -> Result<FeedListResult, String> {
        let title = request.title.trim();
        if title.is_empty() {
            return Err("Feed name cannot be empty".to_string());
        }

        self.repository.rename_feed(&request.feed_id, title)?;
        Ok(self.list_feeds())
    }
}

fn normalize_feed_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        Ok(trimmed.trim_end_matches('/').to_string())
    } else {
        Err("Feed URL must start with http:// or https://".to_string())
    }
}

fn normalize_tag_name(raw: &str) -> String {
    raw.split(|ch: char| !ch.is_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(str::to_lowercase)
        .collect::<Vec<_>>()
        .join(" ")
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feeds::parse_feed_bytes;
    use crate::feeds::FeedSummary;
    use crate::feeds::TagMatchMode;

    fn service_with_sample_feed() -> FeedService {
        let xml = br#"
            <rss version="2.0">
              <channel>
                <title>Repo Feed</title>
                <link>https://example.com</link>
                <item>
                  <title>Stored Article</title>
                  <guid>stored-article</guid>
                  <link>https://example.com/stored</link>
                  <description>Stored body</description>
                </item>
              </channel>
            </rss>
        "#;
        let parsed = parse_feed_bytes("https://example.com/rss.xml", xml).expect("feed parses");
        let repository = FeedRepository::open_in_memory().expect("repository opens");
        repository.save_feed(&parsed.feed).expect("feed saves");
        for article in &parsed.articles {
            repository.save_article(article).expect("article saves");
        }

        FeedService::with_repository(repository)
    }

    #[test]
    fn normalize_rejects_invalid_url() {
        let result = normalize_feed_url("example.org/rss.xml");

        assert!(result.is_err());
    }

    #[test]
    fn parsed_feed_can_be_saved_to_repository() {
        let service = service_with_sample_feed();
        let feeds = service.list_feeds().feeds;
        let articles = service.list_articles(ArticleListFilter {
            feed_id: Some(feeds[0].id.clone()),
            unread_only: false,
            favorites_only: false,
            tag_id: None,
            ..Default::default()
        });

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].article_count, 1);
        assert_eq!(feeds[0].unread_count, 1);
        assert_eq!(articles[0].title, "Stored Article");
    }

    #[test]
    fn mark_article_read_updates_unread_count() {
        let mut service = service_with_sample_feed();
        let article_id = service
            .list_articles(ArticleListFilter::default())
            .first()
            .expect("article exists")
            .id
            .clone();

        service
            .mark_article_read(ArticleMarkReadRequest {
                article_id,
                is_read: true,
            })
            .expect("article marked read");

        let feeds = service.list_feeds().feeds;
        assert_eq!(feeds[0].unread_count, 0);
    }

    #[test]
    fn rename_feed_uses_custom_title_in_feeds_and_articles() {
        let mut service = service_with_sample_feed();
        let feed_id = service.list_feeds().feeds[0].id.clone();

        let result = service
            .rename_feed(FeedRenameRequest {
                feed_id: feed_id.clone(),
                title: "Daily Briefing".to_string(),
            })
            .expect("feed renames");
        let feed = service
            .repository
            .get_feed(&feed_id)
            .expect("feed query succeeds")
            .expect("feed exists");
        let articles = service.list_articles(ArticleListFilter {
            feed_id: Some(feed_id),
            ..Default::default()
        });

        assert_eq!(result.feeds[0].title, "Daily Briefing");
        assert_eq!(feed.custom_title.as_deref(), Some("Daily Briefing"));
        assert_eq!(articles[0].feed_title, "Daily Briefing");
    }

    #[test]
    fn list_articles_filters_multiple_tags_by_match_mode() {
        let xml = br#"
            <rss version="2.0">
              <channel>
                <title>Tagged Feed</title>
                <link>https://example.com</link>
                <item>
                  <title>Rust Article</title>
                  <guid>rust-article</guid>
                  <link>https://example.com/rust</link>
                  <description>Rust body</description>
                </item>
                <item>
                  <title>AI Article</title>
                  <guid>ai-article</guid>
                  <link>https://example.com/ai</link>
                  <description>AI body</description>
                </item>
              </channel>
            </rss>
        "#;
        let parsed = parse_feed_bytes("https://example.com/rss.xml", xml).expect("feed parses");
        let repository = FeedRepository::open_in_memory().expect("repository opens");
        repository.save_feed(&parsed.feed).expect("feed saves");
        for article in &parsed.articles {
            repository.save_article(article).expect("article saves");
        }
        let mut service = FeedService::with_repository(repository);
        let articles = service.list_articles(ArticleListFilter::default());
        let rust_article = articles
            .iter()
            .find(|article| article.title == "Rust Article")
            .expect("rust article exists");
        let ai_article = articles
            .iter()
            .find(|article| article.title == "AI Article")
            .expect("ai article exists");

        service
            .save_article_tags(ArticleTagsSaveRequest {
                article_id: rust_article.id.clone(),
                tags: vec!["Rust".to_string(), "AI".to_string()],
                source: "manual".to_string(),
            })
            .expect("rust article tags save");
        service
            .save_article_tags(ArticleTagsSaveRequest {
                article_id: ai_article.id.clone(),
                tags: vec!["AI".to_string()],
                source: "manual".to_string(),
            })
            .expect("ai article tags save");

        let tags = service.list_tags().tags;
        let rust_tag_id = tags
            .iter()
            .find(|tag| tag.name == "Rust")
            .expect("rust tag exists")
            .id
            .clone();
        let ai_tag_id = tags
            .iter()
            .find(|tag| tag.name == "AI")
            .expect("ai tag exists")
            .id
            .clone();

        let any_articles = service.list_articles(ArticleListFilter {
            tag_ids: vec![rust_tag_id.clone(), ai_tag_id.clone()],
            tag_match: TagMatchMode::Any,
            ..Default::default()
        });
        let all_articles = service.list_articles(ArticleListFilter {
            tag_ids: vec![rust_tag_id, ai_tag_id],
            tag_match: TagMatchMode::All,
            ..Default::default()
        });

        assert_eq!(any_articles.len(), 2);
        assert_eq!(all_articles.len(), 1);
        assert_eq!(all_articles[0].title, "Rust Article");
    }

    #[test]
    fn list_articles_filters_by_search_query_fields() {
        let repository = FeedRepository::open_in_memory().expect("repository opens");
        let feed = FeedSummary {
            id: "feed-search".to_string(),
            title: "Search Feed".to_string(),
            source_title: Some("Search Feed".to_string()),
            custom_title: None,
            url: "https://example.com/search.xml".to_string(),
            site_url: Some("https://example.com".to_string()),
            description: None,
            unread_count: 0,
            article_count: 0,
            last_fetched_at: Some("1".to_string()),
            status: FeedStatus::Active,
            error_message: None,
        };
        repository.save_feed(&feed).expect("feed saves");
        repository
            .save_article(&ArticleDetail {
                id: "article-rust".to_string(),
                feed_id: feed.id.clone(),
                feed_title: feed.title.clone(),
                title: "Rust release notes".to_string(),
                url: "https://example.com/rust".to_string(),
                author: Some("Ferris Author".to_string()),
                published_at: Some("2026-06-09T00:00:00Z".to_string()),
                excerpt: "Compiler highlights".to_string(),
                is_read: false,
                is_favorite: false,
                sanitized_html: "<p>Borrow checker improvements</p>".to_string(),
            })
            .expect("rust article saves");
        repository
            .save_article(&ArticleDetail {
                id: "article-ai".to_string(),
                feed_id: feed.id.clone(),
                feed_title: feed.title.clone(),
                title: "AI market recap".to_string(),
                url: "https://example.com/ai".to_string(),
                author: Some("Market Desk".to_string()),
                published_at: Some("2026-06-08T00:00:00Z".to_string()),
                excerpt: "Daily summary".to_string(),
                is_read: false,
                is_favorite: false,
                sanitized_html: "<p>Semiconductor demand and cloud capex</p>".to_string(),
            })
            .expect("ai article saves");

        let service = FeedService::with_repository(repository);
        let title_matches = service.list_articles(ArticleListFilter {
            search_query: Some("rust".to_string()),
            ..Default::default()
        });
        let author_matches = service.list_articles(ArticleListFilter {
            search_query: Some("ferris".to_string()),
            ..Default::default()
        });
        let content_matches = service.list_articles(ArticleListFilter {
            search_query: Some("cloud capex".to_string()),
            ..Default::default()
        });

        assert_eq!(title_matches.len(), 1);
        assert_eq!(title_matches[0].id, "article-rust");
        assert_eq!(author_matches.len(), 1);
        assert_eq!(author_matches[0].id, "article-rust");
        assert_eq!(content_matches.len(), 1);
        assert_eq!(content_matches[0].id, "article-ai");
    }
}
