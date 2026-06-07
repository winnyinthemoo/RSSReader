# Agent Log: AI Usage 图表可读性改进

- 日期：2026-06-05
- 负责人：Codex
- 使用工具：Codex CLI、sed、npm run build
- 对应 Issue / PR：未指定
- 任务目标：优化 model setting 中 AI usage 七日图表的直观性。
- 关键 Prompt 摘要：用户认为 AI usage 折线图不直观，选择“小型仪表盘”方向后要求实现计划。
- Agent 修改内容摘要：
  - Usage 图表新增 Tokens / Requests 分段切换。
  - 新增 Today 和 Daily avg 摘要。
  - 新增 Y 轴刻度标签、峰值点标记和点位明细。
  - 空数据时显示明确空状态，不再展示容易误解的平线。
  - Top usage rows 跟随当前指标显示 tokens 或 calls。
- 人工检查结果：尚未人工打开页面截图检查，已通过前端构建验证。
- 是否运行测试：
  - 已运行 `npm run build`，通过，存在 Vite chunk size warning。
- 未解决问题：
  - 当前仍使用手写 SVG，未引入图表库。
  - 未增加端到端可视化截图测试。
