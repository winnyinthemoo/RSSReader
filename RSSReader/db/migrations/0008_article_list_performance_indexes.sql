CREATE INDEX IF NOT EXISTS idx_articles_feed_read_published
ON articles(feed_id, is_read, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_favorite_published
ON articles(is_favorite, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_read_published
ON articles(is_read, published_at DESC, created_at DESC);
