# 2026-06-07 PR 20/21 整合记录

## 基本信息

- 日期：2026-06-07
- 负责人：Hazel / Codex
- 使用工具：Codex、Git、GitHub PR、npm、cargo
- 对应 PR：#20、#21

## 任务目标

在本地整合当前打开的 PR，优先合入可用的前端 UI 改动和 AI / 翻译 / 标签相关改动；对合并中发现的小问题在整合分支中统一修复，避免直接污染 `main`。

## 关键 Prompt 摘要

用户希望由 Agent 代为审查并整合当前仓库中的 PR。经检查，#20 可自动合并但存在未读数回退，#19 与 #21 高度重叠且 #21 更完整，因此本次选择整合 #20 和 #21，暂不合入 #19。

## Agent 修改内容摘要

- 新建本地整合分支 `integration/pr-20-21`。
- 合入 #20，并修复 `FeedSidebar` 中将 `unreadCount` 错改为 `articleCount` 的问题。
- 合入 #21，解决 feed 后端、dev server、reader 视图中的冲突。
- 对齐 Tauri command `ai_usage_report` 的参数签名，补充 `key: Option<String>` 转发。
- 保留 #21 的 AI usage、翻译、标签、多选筛选、macOS 图标配置等改动。

## 人工检查结果

- 已确认 `FeedSidebar` 的左侧总数与单个 Feed 右侧数字继续显示未读数。
- 已确认无残留 Git 冲突标记。
- #19 暂未整合，后续应确认是否已被 #21 覆盖。

## 验证

- `npm run frontend:build`：通过，有 Vite chunk size 警告。
- `backend/cargo check`：通过，有既有 dead_code warnings。
- `backend/cargo test`：通过，23 passed。
- `src-tauri/cargo check`：通过，有既有 dead_code warnings。
- `npm run tauri:build:windows`：通过，生成 `Vortex_0.1.0_x64-setup.exe`。

## 未解决问题

- 尚需最终决定是否关闭 #19。
- 若合并到 `main` 后用于分发，仍需人工安装验证最新 Windows 包。
