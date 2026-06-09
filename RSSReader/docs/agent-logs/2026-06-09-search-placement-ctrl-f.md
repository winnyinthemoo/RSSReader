# 2026-06-09 Agent 工作记录：调整全局搜索位置与 Ctrl+F 文章内搜索

- 日期：2026-06-09
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd
- 对应 Issue / PR：未关联
- 任务目标：按用户反馈将全局文章搜索放回右侧上方工具栏，移除中间文章列表内的搜索框，并通过 Ctrl+F 实现当前文章内搜索。
- 关键 Prompt 摘要：用户要求“中间列表的全局搜索放在右侧的上面部分，去掉原始中间列表的全局搜索，而是 ctrl+F 实现当前文章内搜索”。
- Agent 修改内容摘要：
  - 右侧 `ReaderToolbar` 的搜索框重新接入 `App` 的全局文章搜索状态，用于搜索标题、作者和正文，并驱动中间列表结果。
  - 中间 `ArticleList` 移除搜索输入框，只保留搜索结果标题、数量和空结果提示。
  - `ReaderView` 新增 `Ctrl+F` 当前文章查找条，输入后在当前 Markdown 正文内高亮并支持 Enter / Shift+Enter、上下按钮跳转，Escape 关闭。
  - 当前文章查找避免在已有输入框、textarea、select 或可编辑区域内拦截 Ctrl+F，减少和全局搜索输入的冲突。
  - 清理中间列表搜索框样式，并新增 Reader 查找条样式。
- 人工检查结果：已检查引用，确认 `articleSearchQuery` 只驱动全局文章列表查询，`readerSearchQuery` 只驱动当前文章 Markdown 高亮。
- 是否运行测试：已运行 `npm.cmd run build`，通过；Vite 仍提示既有 chunk 超过 500 kB。
- 未解决问题：未做真实浏览器快捷键交互验证；如需覆盖更多浏览器平台，后续可补 Playwright/E2E。
