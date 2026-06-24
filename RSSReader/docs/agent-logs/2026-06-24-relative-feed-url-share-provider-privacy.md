# Relative Feed URL, Share Menu, Provider Privacy Notice

- 日期：2026-06-24
- 负责人：Codex
- 使用工具：PowerShell、rg、Invoke-WebRequest、cargo fmt、cargo check、cargo test、npm run frontend:build
- 对应 Issue / PR：未指定
- 任务目标：排查 soulhacker RSS 原网页循环嵌入问题，移除分享到 X，补充服务商 API Key 本地加密保存提示。
- 关键 Prompt 摘要：用户反馈 `https://soulhacker.me/index.xml` 添加和正文显示正常，但点击原网页会在阅读器内显示整个 Vortex 页面；同时希望去掉分享菜单中的“分享到 X”，并在设置智能体服务商保存时提示 API Key 在本地加密保存、不会泄露。
- Agent 修改内容摘要：
  - RSS 解析：将 feed 的站点链接和 article 链接按 feed URL 解析成绝对 URL，覆盖 `/`、`/posts/...` 等相对路径；文章去重 ID 仍使用 RSS 原始 link，避免刷新后重复导入。
  - 旧数据兼容：读取已入库文章详情时，如果文章 URL 仍是相对路径，会根据所属 feed URL 临时解析成绝对 URL 返回给前端。
  - 分享菜单：移除“分享到 X”菜单项，保留复制链接、复制 Markdown、打开原文。
  - 设置页：服务商保存成功提示追加 API Key 仅本地加密保存、不会上传或泄露的说明。
- 人工检查结果：已确认 soulhacker feed 的 channel link 为 `/`、item link 为 `/posts/...`，这是循环嵌入 Vortex 的直接原因。
- 是否运行测试：已运行 `cargo check`（backend、src-tauri）、`cargo test`（backend，32+2 通过）、`npm run frontend:build`。
- 未解决问题：已入库的文章列表项仍可能显示旧的相对 URL，但文章详情和原网页打开路径已修正；刷新该 feed 后新入库数据会保存为绝对 URL。