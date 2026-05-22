# Database

`db/` 保存 SQLite schema、migration 和初始化说明。

当前 Feed MVP 的第一版 migration 位于 `migrations/0001_create_feeds_and_articles.sql`，包含：

- `feeds`：订阅源信息。
- `articles`：文章信息、阅读状态和清洗后的正文。

后端应通过 repository 层访问数据库，前端不得直接读取 SQLite 或拼接 SQL。
