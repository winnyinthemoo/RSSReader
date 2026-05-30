# 内容提取与原始页面展示修复日志

**日期**: 2026-05-30
**分支**: `fix-content-extraction`
**涉及文件**: 8 files (275+ insertions, 88+ deletions)

---

## 问题概述

### 1. 添加 Feed 极慢
`entry_to_article` 逐篇发起 HTTP 请求到文章页面用 readability 提取全文。19 篇文章串行需要 20-60 秒，且全局 `Mutex` 锁阻塞其他 API。

### 2. 原始页面展示失败
网站设置 `X-Frame-Options: DENY`，浏览器直接拒绝 iframe 嵌入，显示空白页。

### 3. readability 提取结果质量差
- **JS SPA 页面** — readability 只提取到页面 `<title>` 文字
- **readability 退化** — 只提取到边栏占位图，正文全丢
- **分页文章** — 只提取到第 1 页内容

### 4. 标题重复
RSS 源的 `<title>` 嵌入 HTML 标签，`strip_html` 去标签后两段文本拼到一起。

### 5. 图片缺失
- **CSS 背景图** — readability 看不到 CSS `background-image`
- **懒加载图片** — `data-src` 替换后留下两个 `src` 属性

### 6. 其他
- `strip_html` 和 `plain_excerpt` 代码重复
- `strip_tag` 越界 panic
- Copy Markdown 复制的是 `<strong>` 而非 `**加粗**`

---

## 修改详情

### parser.rs — 核心内容提取引擎

| 改动 | 说明 |
|------|------|
| `strip_html` → `pub fn strip_html` | 调用 `plain_text` 消除重复 |
| 新增 `plain_text()` | 公共去标签函数 |
| `is_noise_image()` 扩展 | 路径过滤 (`.svg`, `/icp.`, `/gaba.`, `/denglu/`, `cprevious`, `cnext`, `/badge`); 中文 alt 过滤 |
| `narrow_to_content()` 扩展 | 补充 `article-content`, `content`, `main` |
| `strip_tag()` 边界保护 | `pos` 计算加 `.min(end)` 防止越界 panic |
| `try_fetch_full_content` | HTTP 超时 8 秒+浏览器 UA+100 字质量检查+figcaption 清理+public |
| 新增 `enrich_rss_content()` | 锁外按需调用，对比择优 |
| `entry_to_article()` 简化 | **去掉 readability 提取**，只存 RSS 原始内容 |
| `plain_excerpt()` 简化 | 调用 `plain_text` |
| 新增 `deduplicate_title()` | RSS 中嵌 HTML 的标题去重 |
| 新增 `extract_hero_banner_img()` | CSS `background-image` → `<img>` |
| 新增 `resolve_url()` | 相对 URL 解析 |
| 新增 `data-src` 修复 | 先删 base64 占位 `src`，再替换 `data-src` → `src` |

### dev_server.rs — HTTP 代理端点

| 改动 | 说明 |
|------|------|
| 新增 `GET /api/render` | 后端代理：fetch → 注入 `<base>` → 返回（跨域+ALLOWALL） |
| 新增 `fetch_raw_page()` | 浏览器完整请求头+`<base>` 注入+`data-src` 修复 |
| 新增 `write_proxied_html()` | HTML 响应写入（ALLOWALL + CORS） |
| 新增 `html_fallback_page()` | 代理失败时的友好错误页 |
| 新增 `parse_query_param()` | 查询参数提取 |

### commands.rs

| 改动 | 说明 |
|------|------|
| `article_get()` 锁外 enrichment | 锁内读 DB（微秒级），HTTP 请求在锁外执行 |

### mod.rs / repository.rs / service.rs

| 改动 | 说明 |
|------|------|
| 导出 `enrich_rss_content`, `strip_html`, `try_fetch_full_content` | |
| 新增 `update_article_content()` | 仅更新 `sanitized_html` 和 `updated_at` |

### ReaderView.tsx — 前端

| 改动 | 说明 |
|------|------|
| **iframe 直连为主** | 默认加载原始 URL，浏览器执行 JS |
| **12 秒超时回退** | 显示 "Retry with proxy" + "Open original page" |
| **手动切代理按钮** | iframe 右下角圆形刷新按钮，点击切换直连/`/api/render` |
| **Compare 模式** | 右侧 Original page 也有同样的浮动按钮 |
| **Copy Markdown** | 复制完整清洗后 Markdown（`**加粗**` 而非 `<strong>`） |
| **`getRenderUrl()`** | 拼接 `/api/render?url=`（自动识别 dev/prod） |

### styles.css

| 改动 | 说明 |
|------|------|
| `.reader-proxy-toggle` | 浮动圆形按钮样式（右下角，背景+阴影+悬停效果） |
| `.compare-pane` | 增加 `position: relative` 支持子元素绝对定位 |
| `.compare-pane-label` | 改为 flex 布局，左右标签高度一致 |

---

## 修复效果

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 添加 19 篇 feed | 20-60 秒 | ~50ms |
| 点文章时其他 API | 全部卡住 | 不卡 |
| `X-Frame-Options` 禁止的网站 | 白屏 | iframe 直连+手动切代理按钮 |
| acevs.com readability 退化 | 纯文本 0 字 | 803 字 |
| pgoj.top 容器漏匹配 | 纯文本 0 字 | 200 字 |
| zhounote.com SPA | ~18 字 | 119 字 |
| caixin.com 分页 | 232 字（2 段） | 1859 字（15 段） |
| 标题重复 | `"标题 " 标题"` | `"标题"` |
| 懒加载图片 | base64 占位图 | 真实图片 |
| Morgan Stanley hero 背景图 | 缺失 | `<img>` 标签 |
| strip_tag 越界 | 运行时 crash | 正常跳过 |
| Copy Markdown | `<strong>` | `**加粗**` |

---

## 仍存在的限制

- `quanwenrss.com` 只提供 RSS `<description>` 摘要，无 `content:encoded`
- JS 动态渲染页面无 headless 浏览器无法提取正文
- CSS `background-image` 提取依赖启发式搜索
- Markdown 视图（readability 路径）与原始页面视图（`/api/render`）是两套路径