# 2026-06-07 Tauri AI 流式与卡顿排查

## 基本信息

- 日期：2026-06-07
- 负责人：Hazel / Codex
- 使用工具：Codex、rg、npm、cargo、apply_patch、Browser
- 对应 Issue / PR：未指定

## 任务目标

排查 Tauri 打包版翻译/摘要响应慢、长文章 AI 任务看起来卡住、快速点击或切换文章后界面无响应的问题，并做小范围修复。

## 关键 Prompt 摘要

用户反馈：HTTP dev server 已有翻译流式处理，但安装包里的 `ai_start_translation` 只等最终结果；长文章翻译/摘要时 UI 像卡住，快速点击或切换也容易无响应，需要判断是否 API 慢并修改。

## Agent 修改内容摘要

- 为 Tauri 桌面路径补上翻译流式事件：`ai_start_translation` 支持 `eventId`，后台翻译时逐段 emit `TranslationStreamChunk`，前端通过 `window.__TAURI__.event.listen` 增量更新。
- 保留旧的一次性 `invoke` 兼容路径；HTTP dev server 仍使用原有 NDJSON 流式接口。
- 移除 AI command 的全局 `Mutex<AiService>` 长任务锁，避免一篇长翻译阻塞摘要、标签、设置读取等其他 AI command。
- 为 feed / AI SQLite 连接增加 5 秒 `busy_timeout`，降低并发写入时直接 `database is locked` 的概率。
- 修复切换文章后 `translationLoading` 未重置的问题，避免旧翻译请求仍在后台运行时新文章界面一直处于 busy 状态。
- 为划词翻译和摘要面板增加 request token，避免旧请求结果回写到当前文章。
- 将阅读器 HTML 转 Markdown 从同步 `useMemo` 改为短延迟 effect，并丢弃过期转换，减轻快速切换长文章时的主线程阻塞；移除调试 `console.log`。

## 人工检查结果

- 已确认打包版卡顿不只来自 API：存在 Tauri 翻译非流式、AI 全局锁、切换文章 busy 状态未重置、Markdown 同步转换等本地问题。
- AI 请求本身仍依赖用户配置的模型、网络和 provider 响应速度；本次没有真实调用外部 AI API。
- 已用 Browser 打开构建后的本地静态预览，页面可加载且无控制台错误。

## 验证

- `npm run frontend:build`：通过；保留既有 Vite chunk size 警告。
- `cargo check`（`src-tauri/`）：通过；保留既有 dead_code warnings。
- `cargo test`（`backend/`）：通过，23 passed。
- `git diff --check`：通过；仅有 Windows 换行提示。

## 未解决问题

- 摘要仍是一次性 LLM 返回，不是真正 token 级或段落级流式；本次先解决不被翻译长任务阻塞和旧请求回写。
- 翻译后端仍按段串行调用模型，尚未启用现有 `translation.concurrency` 配置；如需进一步提速，需要单独设计并发队列、取消机制和 API 速率限制。
- 本次未重新打 Windows 安装包，需要后续用安装包验证 Tauri 事件流在真实打包环境中的表现。
