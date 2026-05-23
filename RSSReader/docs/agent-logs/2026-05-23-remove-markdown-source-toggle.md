# 2026-05-23 Agent 工作记录：移除 Markdown 源码折叠区

- 日期：2026-05-23
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd、Browser 插件
- 对应 Issue / PR：暂无
- 任务目标：移除 Reader Markdown 展示下方的 `View Markdown source` 区域。
- 关键 Prompt 摘要：用户询问为什么 Markdown 下方有 `View Markdown source`，要求去掉这部分。
- Agent 修改内容摘要：
  - 删除 `ReaderView` 中 `markdownSource` 生成逻辑。
  - 删除 `MarkdownArticle` 中源码折叠展示。
  - 删除不再使用的 `.md-source` / `.md-source-toggle` 样式。
- 人工检查结果：待人工检查。
- 是否运行测试：
  - 已运行 `npm.cmd run build`，前端构建通过。
  - 已用 Browser 检查页面中不再存在 `View Markdown source`、`.md-source-toggle` 和 `.md-source`。
- 未解决问题：
  - 构建仍提示 chunk 体积超过 500 kB，属于后续打包优化事项。
