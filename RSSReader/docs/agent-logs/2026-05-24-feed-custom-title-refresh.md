# Agent 工作记录：刷新订阅源不覆盖自定义名称

- 日期：2026-05-24
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、cargo
- 对应 Issue / PR：Issue（Refresh selected 覆盖 RSS 源自定义名称）
- 任务目标：修复点击 Refresh selected 后，用户设置的 RSS 源显示名称被 RSS 元数据标题覆盖的问题。
- 关键 Prompt 摘要：用户反馈原源名为“ai科技”，刷新后被改成 RSS 原始标题 “bloomberg ai”，期望刷新不改变自定义名称。
- Agent 修改内容摘要：
  - 在 feeds 表新增 `source_title` 和 `custom_title` 字段。
  - 查询 feed 时仍返回 `title`，但值改为 `custom_title ?? source_title ?? title`。
  - 刷新 feed 时只更新 `source_title`、站点信息、描述、状态和文章，不覆盖 `custom_title`。
  - 同 URL 重复添加时，如果用户输入名称，会更新该源的 `custom_title`，用于恢复已被覆盖的显示名。
  - 为 migration 增加 `schema_migrations` 记录表，支持非幂等 `ALTER TABLE` 迁移只执行一次。
  - 修复后端 dev server 对 POST 请求 body 只读一次导致 `Add Feed` 偶发 `Missing url` 的问题。
  - 增加 repository 单元测试覆盖自定义名称在源标题更新后仍保留。
- 人工检查结果：代码检查通过，测试覆盖通过；已用本地 API 验证设置自定义名称后刷新，返回标题仍保留自定义名称。
- 是否运行测试：已运行 `cargo check`、`cargo test -- --test-threads=1`、`cargo build --bin rssreader-backend-dev`，通过。
- 未解决问题：后端仍有既有 dead_code warning，未在本次任务处理。
