# 2026-05-24 Agent 工作记录：原始网页访问 fallback

- 日期：2026-05-24
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd、cargo
- 对应 Issue / PR：原始网页访问不到
- 任务目标：保留真实原始网页入口，避免把清洗正文或本地缓存误认为原始网页。
- 关键 Prompt 摘要：用户反馈“原始网页访问不到”，并明确说明希望看到原始网页，不是下载或 RSS 原始 HTML。
- Agent 修改内容摘要：
  - Reader 原网页模式继续使用文章真实 URL。
  - 原网页 iframe 加载失败时，显示更明确的说明，并提供“打开原始网页”链接。
  - Compare 视图右侧仍指向真实原网页，标签改为 `Original page`。
  - 删除了临时尝试的 raw HTML 存储方案，未新增数据库字段。
- 人工检查结果：待人工检查。
- 是否运行测试：
  - 已运行 `npm.cmd run build`，前端构建通过。
  - 已运行 `cargo check`，通过，保留既有 unused warning。
  - 已运行 `cargo test`，15 个测试通过，保留既有 unused warning。
- 未解决问题：
  - 如果目标网站本身被网络环境屏蔽，或通过 CSP / X-Frame-Options 禁止嵌入，应用内无法绕过，只能引导用户在系统浏览器中打开真实链接。
