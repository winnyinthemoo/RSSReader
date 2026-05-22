# 2026-05-22 Agent 工作记录：目录定位同步

- 日期：2026-05-22
- 负责人：Codex
- 使用工具：PowerShell、apply_patch
- 对应 Issue / PR：暂无
- 任务目标：根据当前项目框架，更新 AGENTS.md 和 PLAN.md 中的目录定位。
- 关键 Prompt 摘要：用户说明 frontend 为前端、backend 为后端、db 为数据库、share/shared 为前后端共享、resources 为 Prompt 模板与文摘模板、build 为打包，并要求同步 Agent 和 PLAN 文件定位。
- Agent 修改内容摘要：
  - 更新 AGENTS.md，明确 `RSSReader/frontend/`、`RSSReader/backend/`、`RSSReader/db/`、`RSSReader/shared/`、`RSSReader/resources/`、`RSSReader/build/`、`RSSReader/docs/` 的职责。
  - 更新 AGENTS.md 中 Agent 留痕目录为 `RSSReader/docs/agent-logs/`。
  - 更新 PLAN.md，新增当前项目目录定位，并把阶段任务影响目录从旧的 `src/`、`src-tauri/` 调整为当前目录结构。
- 人工检查结果：待人工检查。
- 是否运行测试：未运行。此次仅修改文档，不涉及前端、后端或数据库代码。
- 未解决问题：当前实际目录为 `RSSReader/shared/`，用户描述中为 share；本次按仓库现有目录 `shared` 记录。
