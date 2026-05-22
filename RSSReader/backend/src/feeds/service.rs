use super::{
    fetch_and_parse_feed, ArticleDetail, ArticleListFilter, ArticleListItem,
    ArticleMarkReadRequest, FeedAddRequest, FeedListResult, FeedRefreshRequest,
    FeedRefreshResult, FeedRepository, FeedStatus, FeedWithArticles,
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
        if let Some(existing) = self.repository.get_feed_by_url(&normalized_url)? {
            return Ok(FeedWithArticles {
                feed: existing.clone(),
                articles: self.repository.list_articles(ArticleListFilter {
                    feed_id: Some(existing.id),
                    unread_only: false,
                })?,
            });
        }

        let parsed = fetch_and_parse_feed(&normalized_url)?;
        self.repository.save_feed(&parsed.feed)?;
        for article in &parsed.articles {
            self.repository.save_article(article)?;
        }

        let feed = self
            .repository
            .get_feed(&parsed.feed.id)?
            .unwrap_or(parsed.feed);
        let articles = self.repository.list_articles(ArticleListFilter {
            feed_id: Some(feed.id.clone()),
            unread_only: false,
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
        let mut new_articles = Vec::new();

        feed.title = parsed.feed.title;
        feed.site_url = parsed.feed.site_url;
        feed.description = parsed.feed.description;
        feed.last_fetched_at = parsed.feed.last_fetched_at;
        feed.status = parsed.feed.status;
        feed.error_message = None;
        self.repository.save_feed(&feed)?;

        for article in &parsed.articles {
            if !self.repository.has_article(&article.id)? {
                new_articles.push(article.list_item());
                self.repository.save_article(article)?;
            }
        }

        feed.article_count = self.repository.count_articles_for_feed(&feed.id)?;
        feed.unread_count = self.repository.count_unread_for_feed(&feed.id)?;
        self.repository.save_feed(&feed)?;

        Ok(FeedRefreshResult {
            feed,
            new_articles,
        })
    }

    pub fn list_articles(&self, filter: ArticleListFilter) -> Vec<ArticleListItem> {
        self.repository.list_articles(filter).unwrap_or_default()
    }

    pub fn get_article(&self, article_id: &str) -> Option<ArticleDetail> {
        self.repository.get_article(article_id).ok().flatten()
    }

    pub fn mark_article_read(&mut self, request: ArticleMarkReadRequest) -> Result<(), String> {
        self.repository
            .mark_article_read(&request.article_id, request.is_read)
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
}
