# 2026-06-09 Agent 工作记录：拆分文章列表搜索与阅读器内搜索

- 日期：2026-06-09
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd、Browser 插件尝试
- 对应 Issue / PR：未关联
- 任务目标：修复搜索状态边界混乱的问题，避免右侧 Reader 工具栏搜索触发中间文章列表请求和外层阅读区域刷新。
- 关键 Prompt 摘要：用户反馈搜索部分存在问题；结合前序反馈，点击或搜索时不应让左侧、右侧摘要和顶部区域跟随不必要刷新，只应更新实际显示区域。
- Agent 修改内容摘要：
  - 将 `ReaderView` 的搜索状态改为组件本地状态，右侧工具栏搜索只在当前文章 Markdown 内容内匹配、高亮和上下跳转。
  - 将 `MarkdownArticle` 的搜索高亮接回 Reader 正文，并让 Compare 视图中的可读 Markdown 半边共享同一套高亮状态。
  - Reader 工具栏搜索文案改为当前文章内搜索，避免误导为全局文章搜索。
  - 保留全局文章搜索能力，但把输入框移到中间 `ArticleList` 头部，由 `App` 的 `articleSearchQuery` 驱动列表查询和结果提示。
  - `App` 不再把 Reader 工具栏搜索词传入全局文章列表查询，避免右侧搜索导致列表和文章选择级联刷新。
- 人工检查结果：已检查搜索状态流向，确认 Reader 搜索只在 `ReaderView` 内部维护；全局文章搜索只由中间文章列表输入框触发。Browser 插件在当前 Windows sandbox 初始化阶段连续失败，未完成交互式浏览器验证。
- 是否运行测试：已运行 `npm.cmd run build`，通过；Vite 仍提示既有 chunk 超过 500 kB。
- 未解决问题：未完成真实浏览器输入验证；全局搜索仍使用既有后端 LIKE 查询能力，后续大数据量可考虑 FTS。
