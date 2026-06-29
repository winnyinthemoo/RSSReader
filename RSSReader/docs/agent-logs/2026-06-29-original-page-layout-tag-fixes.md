# 2026-06-29 原网页、布局与标签窗口修复

- 负责人：Codex
- 使用工具：PowerShell、rg、apply_patch、cargo fmt、npm run frontend:build、cargo check、cargo test、Invoke-WebRequest
- 对应 Issue / PR：未指定 Issue / PR；关联遗留原网页视图限制问题
- 任务目标：修复部分原网页视图嵌套应用页面、代理原网页不可用、文章列表头部溢出、三栏拖拽卡顿、标签窗口背景不一致等收尾问题。
- 关键 Prompt 摘要：用户指出 quanwenrss、antirez、daringfireball、ericmigi 等源在原网页/代理视图下表现异常，并要求完善中栏按钮溢出、拖拽流畅度和 tag 窗口背景。

## 修改内容

- 新增后端 `reader` 原网页代理模块，并通过 Tauri command `original_page_render` 暴露给桌面端。
- 前端代理原网页改为先获取 HTML，再用 sandboxed `srcDoc` 渲染，避免打包后访问不存在的 `/api/render` 导致嵌套应用页面。
- 开发服务器 `/api/render` 复用同一后端代理模块，减少桌面端和开发模式的逻辑分叉。
- 原网页 iframe 加载时增加当前应用页面误判检测，非法或空 URL 直接展示 fallback。
- 三栏宽度拖拽改为 `requestAnimationFrame` 合并更新，并在松手时写入 localStorage，降低拖拽过程重排和持久化开销。
- 中栏标题和已读/未读按钮增加收缩、换行和省略规则，避免长 feed 名称在窄栏下把按钮挤出边界。
- reader tag/note 侧浮窗背景改为不透明，与其他窗口视觉一致。

## 人工检查结果

- 已用 `Invoke-WebRequest` 探测用户列出的 4 个 feed URL，当前网络下 RSS 端点均返回 HTTP 200。
- 因此这些 RSS URL 本身当前可达；原网页异常更可能来自旧代理路径、具体文章页面限制、目标站 iframe/CSP 限制或临时网络状况。

## 验证

- `npm run frontend:build`：通过，保留既有 Vite chunk size warning。
- `cargo check`（backend）：通过。
- `cargo test`（backend）：通过，36 个测试通过。
- `cargo check`（src-tauri）：通过。

## 未解决问题

- 部分目标站仍可能主动禁止内嵌、依赖复杂脚本或对代理请求限流；此类场景会显示 fallback，并保留外部打开入口。
