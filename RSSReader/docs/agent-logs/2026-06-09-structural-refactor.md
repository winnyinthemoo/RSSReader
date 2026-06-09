# 2026-06-09 Agent Log - Structural Refactor

## 日期

2026-06-09

## 负责人

Codex

## 使用工具

- PowerShell
- apply_patch
- npm.cmd / Vite / TypeScript
- cargo check
- cargo test

## 对应 Issue / PR

未指定 Issue / PR。本次处理用户明确提出的阶段性重构任务。

## 任务目标

根据项目中大文件和性能问题进行结构重构：

- 拆分 ReaderView 中的 toolbar、markdown renderer、translation、note/tag panel、compare/original view 等逻辑。
- 拆分 FeedSidebar 中的 Feed 列表、Tag 工作区、同步面板、统计面板和弹窗。
- 将 App 中的选择、OPML、同步设置和错误处理工具抽离。
- 拆分全局 styles.css 的功能样式边界。
- 拆分后端 feeds repository，并优化 refresh_feed 的文章写入路径。
- 清理未接入 AI runtime/router/task_queue 和 dead_code warning。

## 关键 Prompt 摘要

用户指出当前项目存在多个维护问题：ReaderView、styles.css、FeedSidebar、App、feeds repository 过大，refresh_feed 存在逐篇查询/写入放大，AI 模块存在 dead_code warning。要求针对这些问题进行解决和重构。

## Agent 修改内容摘要

- Reader:
  - 新增 `features/reader/components/ReaderToolbar.tsx`、`MarkdownArticle.tsx`、`ReaderSidePanel.tsx`、`CompareView.tsx`、`OriginalPageView.tsx`、`ReaderHeader.tsx`、`ThemePanel.tsx`。
  - 新增 reader 类型、选项和工具函数文件。
  - `ReaderView.tsx` 缩减为状态协调层。
- Feeds:
  - 新增 `FeedList`、`TagWorkspace`、`SyncPanel`、`FeedStatsPanel`、`AddFeedDialog`、`MergeTagDialog`、`DeleteFeedDialog`。
  - 新增 feeds 共享类型、筛选、选择、OPML、同步文本和同步设置 hook。
  - `FeedSidebar.tsx` 缩减为侧栏容器。
- App:
  - 使用 `useFeedSyncSettings` 和 feeds utils，减少入口文件内的工具函数。
  - ArticleList 改用共享 SidebarSelection 类型。
- CSS:
  - `styles.css` 改为 import 入口。
  - 新增 `stylesheets/base.css`、`ai.css`、`reader.css`、`theme-refresh.css`、`ai-refresh.css`、`sidebar-refinements.css`。
- Backend:
  - 将 feeds repository 拆为 `repository/feeds.rs`、`articles.rs`、`tags.rs`、`notes.rs`。
  - 新增 `save_articles_for_refresh` 和 `feed_article_counts`，`refresh_feed` 改为批量查询已有文章、事务内 upsert。
  - 删除未接入的 AI runtime 模块，清理未使用的 AI helper/API 字段，`cargo check` 不再输出 dead_code warning。

## 人工检查结果

- 已检查前端 TypeScript 构建和 Vite CSS 解析。
- 已检查后端编译与单元测试。
- 未进行人工 UI 截图验收。

## 是否运行测试

是。

- `RSSReader/frontend`: `npm.cmd run build` 通过。Vite 仍提示主 JS chunk 超过 500KB。
- `RSSReader/backend`: `cargo check` 通过且无 warning。
- `RSSReader/backend`: `cargo test` 通过，25 个 lib 测试、2 个 dev_server 测试全部通过。

## 未解决问题

- `frontend/src/features/ai/components/AiSettingsPage.tsx` 仍较大，适合后续单独拆分。
- Vite 构建存在 chunk size warning，后续可对 AI 设置页或 markdown/translation 相关依赖做动态加载。
- 本次 CSS 是按现有区块机械拆分，后续可继续按 feature ownership 精细清理重复样式。
