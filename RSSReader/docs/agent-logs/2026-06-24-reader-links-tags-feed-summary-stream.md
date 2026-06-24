# Reader Links, Tags, Feed Validation, Summary Streaming

- 日期：2026-06-24
- 负责人：Codex
- 使用工具：PowerShell、rg、cargo fmt、cargo check、cargo test、npm run frontend:build
- 对应 Issue / PR：未指定
- 任务目标：修复阅读器窄宽度页边距、文章内链接无响应、标签选择面板缺少已有标签、添加 RSS 弹窗校验和字段顺序，并实现摘要流式生成。
- 关键 Prompt 摘要：用户反馈阅读器变窄后正文边距过小；文章内容中的链接点击后应在阅读器内打开并提供返回；标签面板需展示已有标签；添加 RSS 源时无效地址需要提示且弹窗中链接在上、名称在下；询问翻译 prompt 策略是否实际生效；摘要生成需要边生成边展示。
- Agent 修改内容摘要：
  - Reader：正文区域委托拦截文章内链接，解析相对链接后复用阅读器内 source 视图和返回按钮；增加窄宽度阅读页边距约束。
  - Tags：阅读器标签面板新增已有标签展示，可点击填入待保存标签。
  - Feed：添加订阅弹窗改为 URL 在上、名称在下；URL 输入框获得焦点；空值、非 http/https 和后端添加失败都会在弹窗内提示且保留弹窗。
  - AI Summary：后端 OpenAI-compatible client 支持 SSE 流；summary service、dev HTTP 路由、Tauri command、前端 aiService 和 SummaryPanel 全链路支持流式摘要并持续渲染。
  - AI Prompt：核对翻译 prompt 策略代码路径，确认设置项会影响实际翻译 prompt 选择。
- 人工检查结果：已做代码检查；确认 backend、src-tauri 编译检查通过，前端构建通过。
- 是否运行测试：已运行 `cargo check`（backend、src-tauri）、`cargo test`（backend）、`npm run frontend:build`。
- 未解决问题：未做真实 AI Provider 联调；摘要流式效果需在配置可用模型后用真实文章人工确认。外部网页若禁止 iframe 嵌入，阅读器内打开仍会走既有 fallback 行为。