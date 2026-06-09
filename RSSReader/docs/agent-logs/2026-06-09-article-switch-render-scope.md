# 2026-06-09 Agent Log - Article Switch Render Scope

## 日期

2026-06-09

## 负责人

Codex

## 使用工具

- PowerShell
- apply_patch
- npm.cmd / Vite / TypeScript

## 对应 Issue / PR

未指定 Issue / PR。本次处理用户反馈的文章切换刷新范围问题。

## 任务目标

点击不同 article 时，不让左侧 Feed 区、右侧 Summary 和顶部工具区域跟随整块刷新；切换期间只让正文显示区域呈现加载状态。

## 关键 Prompt 摘要

用户反馈：点击不同 article 时不应让左边所有页面刷新；随后澄清右侧 Summary 和上方部分也不应随着切换一起刷新，应该只刷新显示部分。

## Agent 修改内容摘要

- `App.tsx`:
  - `handleSelectArticle` 不再先 `setSelectedArticle(undefined)`，避免 ReaderView 整体回到空态。
  - 点击文章标记已读时不再同步更新 `feeds` unreadCount，避免左侧 FeedSidebar 因文章点击重绘。
- `ReaderView.tsx`:
  - 在已有 article 保持挂载的情况下，通过正文区域显示 `Loading article...`。
- `SummaryPanel.tsx`:
  - articleId 变化时不再强制关闭 Summary 浮层，只清空内容并进入当前文章状态。

## 人工检查结果

- 已确认前端构建通过。
- dev server 当前可访问：`http://127.0.0.1:5173` 返回 200。

## 是否运行测试

是。

- `RSSReader/frontend`: `npm.cmd run build` 通过。

## 未解决问题

- Vite 仍提示主 JS chunk 超过 500KB，属于既有打包体积提示。
