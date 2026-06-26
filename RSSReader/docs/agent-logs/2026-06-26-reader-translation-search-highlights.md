# 2026-06-26 Reader Translation Search Highlights

- 日期：2026-06-26
- 负责人：Codex
- 使用工具：PowerShell、rg、apply_patch、npm run frontend:build
- 对应 Issue / PR：未指定
- 任务目标：修复翻译后文章中使用 `Ctrl+F` 搜索时，搜索框显示命中数量但页面不高亮、不滚动到对应字符的问题。
- 关键 Prompt 摘要：用户反馈翻译视图中搜索框会显示如 `1/3`，但页面没有跳到对应字符。
- Agent 修改内容摘要：
  - 确认当前 Reader 搜索高亮只传给 `MarkdownArticle`，翻译/双语视图 `BilingualTranslationView` 使用 `dangerouslySetInnerHTML` 渲染，没有接入搜索高亮。
  - 为 `BilingualTranslationView` 增加可见 DOM 内文本搜索、高亮和 active 命中滚动能力。
  - Reader 搜索计数改为跟随当前可见视图：普通阅读视图使用 Markdown 命中数，翻译视图使用实际高亮到 DOM 的命中数。
- 人工检查结果：
  - 普通 Markdown 阅读路径保持原逻辑。
  - 翻译视图搜索会跳过按钮、输入框、脚本和样式节点，避免命中“重试此段”等控件文本。
- 是否运行测试：
  - 已运行 `npm run frontend:build`，通过；保留既有 Vite chunk size warning。
- 未解决问题：
  - 搜索不会跨多个 DOM 文本节点匹配同一个短语，后续如有需要可单独增强。
