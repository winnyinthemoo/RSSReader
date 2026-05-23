# 2026-05-23 Agent 工作记录：Reader 原始网页与对比视图

- 日期：2026-05-23
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd
- 对应 Issue / PR：暂无
- 任务目标：调整 Reader 的原始网页和对比视图，使其不保留 Markdown 视图的标题与底部摘要区域，并改善原始网页 iframe 展示区域。
- 关键 Prompt 摘要：用户反馈 Markdown 展示正常，但原始网页无法展示；原始网页和对比视图不应保留 Markdown 标题和下面部分。
- Agent 修改内容摘要：
  - 将 Reader 标题区抽成 `ReaderHeader`，仅在 Markdown 与双语视图中渲染。
  - 将 `SummaryPanel` 限定为 Markdown 与双语视图展示，Web / Compare 不再显示底部摘要。
  - iframe 加载计时器改为随当前 Web / Compare 视图启动，切换视图时重置 iframe 状态。
  - 调整 Web / Compare 样式，使 iframe 区域占满工具栏下方阅读空间。
- 人工检查结果：待人工检查。
- 是否运行测试：
  - 已运行 `npm.cmd run build`，前端构建通过。
- 未解决问题：
  - 部分网站会通过 `X-Frame-Options` 或 `Content-Security-Policy` 禁止 iframe 嵌入，前端无法绕过；此时仍需要使用 fallback 中的新标签打开入口。
