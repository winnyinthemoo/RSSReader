# Shared Contracts

`shared/` 保存前后端共享的 Command 契约、数据类型和通用常量。

当前 Feed MVP 使用 `feed.ts` 定义以下 Command 的输入输出：

- `feed_list() -> FeedListResult`
- `feed_add(url) -> FeedWithArticles`
- `feed_refresh(feed_id) -> FeedRefreshResult`
- `article_list(filter) -> ArticleListResult`
- `article_get(article_id) -> ArticleDetail`
- `article_mark_read(article_id, is_read) -> void`

前端只能通过这些契约调用后端能力，不直接访问数据库。

## AI 模块

`ai.ts` 定义 AI 相关 Command / REST 契约：

- Provider / Model 配置与 Test
- Agent 设置（Summary / Translation / Tagging）
- 摘要、翻译、标签建议、用量报表

详见 `docs/ai-progress.md`。
