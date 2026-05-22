# 2026-05-22 Agent 工作记录：前端接真实后端与布局调整

- 日期：2026-05-22
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm
- 对应 Issue / PR：暂无
- 任务目标：让前端接入真正的后端，并调整三栏布局比例。
- 关键 Prompt 摘要：用户要求前端接入真正后端，同时保持三栏设计但缩窄左侧两栏，为右侧阅读栏保留约 3/4 宽度。
- Agent 修改内容摘要：
  - 后端新增 `rssreader-backend-dev` HTTP 开发服务，提供 `/api/feeds`、`/api/feeds/refresh`、`/api/articles`、`/api/articles/:id`。
  - 后端 Feed / Article 模型补充 `serde` 序列化和 camelCase 字段映射。
  - 前端 Feed service 改为 Tauri Command 优先，普通浏览器开发环境请求 `http://127.0.0.1:5181`。
  - 前端不再在 service 中使用 mock 数据作为普通浏览器回退。
  - 调整三栏 CSS：左侧订阅栏和文章栏缩窄，右侧阅读栏占主要空间。
  - 新增 `backend-dev`、`dev-all` 脚本说明。
- 人工检查结果：待人工检查。
- 是否运行测试：已运行 `npm.cmd run build`，前端构建通过。未运行后端 `cargo test`，当前环境未安装 Cargo。
- 未解决问题：后端 HTTP dev server 仍是开发期适配层，后续 Tauri 初始化后需要把 Command 宏和真实数据库接入。
