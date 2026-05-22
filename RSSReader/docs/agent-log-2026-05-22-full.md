# Agent Log — 2026-05-22 完整记录

- **负责人**: Claude Code

---

## 一、Feed 删除功能

为每个 feed 添加悬停显示的删除按钮，点击后删除 feed 及其所有文章。

**涉及文件**：

| 层级 | 文件 | 改动 |
|------|------|------|
| 共享类型 | `shared/feed.ts` | 新增 `FeedDeleteRequest { feedId: string }` 接口 |
| 后端模型 | `backend/src/feeds/model.rs` | 新增 `FeedDeleteRequest` 结构体 |
| 后端仓库 | `backend/src/feeds/repository.rs` | 新增 `delete_feed()` — DELETE articles + feeds |
| 后端服务 | `backend/src/feeds/service.rs` | 新增 `delete_feed()` 业务逻辑 |
| 后端命令 | `backend/src/feeds/commands.rs` | 新增 `feed_delete()` 处理函数 |
| 后端路由 | `backend/src/bin/dev_server.rs` | 新增 `POST /api/feeds/delete` 路由 |
| 后端导出 | `backend/src/feeds/mod.rs`、`backend/src/lib.rs` | 导出 `feed_delete` / `FeedDeleteRequest` |
| 前端服务 | `frontend/src/services/feedService.ts` | 新增 `deleteFeed()` API 调用 |
| 前端组件 | `frontend/src/features/feeds/components/FeedSidebar.tsx` | 每行 feed 添加 `.feed-delete-button`，悬停显示 |
| 前端状态 | `frontend/src/App.tsx` | 新增 `handleDeleteFeed` / `isDeleting` 状态管理 |
| 前端样式 | `frontend/src/styles.css` | 新增 `.feed-item-row` / `.feed-delete-button` 样式 |

---

## 二、HTML 转 Markdown 并渲染

使用 Turndown 将文章清洗后的 HTML 转为 Markdown，再通过 react-markdown + remark-gfm + rehype-raw 渲染到阅读区。

**关键实现**：
- `normalizeMarkdown()` 管线：先将 `**` 转 `<strong>` → turndown 转换 → 反脱字符 → 保留加粗语法
- 两个 useMemo 流：`markdown`（加粗显示为 `<strong>`）和 `markdownSource`（显示为 `**` 源码）
- 修复了 Markdown 源码显示 `**` 而非 `<strong>` 的问题

**涉及文件**：
- `frontend/src/features/reader/components/ReaderView.tsx`
- `frontend/src/styles.css`（Markdown 渲染样式：代码块、引用、表格、图片等）
- `frontend/package.json`（补装 turndown、react-markdown、remark-gfm、rehype-raw）

---

## 三、三个阅读模式

ReaderView 支持三种视图切换：

### 1. Markdown 模式（默认）
将文章 HTML 转为 Markdown 渲染，支持主题颜色和字体大小调整。

### 2. Web 模式（原页面）
通过 iframe 直接加载原文链接。部分网站（如 Bloomberg）会阻止 iframe 嵌入。

### 3. Compare 模式（分栏对比）
左右分栏：左侧 Markdown 转换结果，右侧原页面 iframe。中间可拖拽分割条调整比例（20%–80%）。

**涉及文件**：
- `frontend/src/features/reader/components/ReaderView.tsx`

### ⚠️ 已知问题：Web 模式下页面加载失败
Web 模式和 Compare 模式依赖 iframe 加载原文。由于浏览器的同源策略和目标网站的 X-Frame-Options 限制，部分网站无法在 iframe 中显示。

- 实现了一个 10 秒超时检测：iframe 的 `onLoad` 10 秒内未触发则显示 fallback 提示
- fallback 页面会显示具体原因（如 "Bloomberg blocks embedding"），并提供"在新标签页打开"链接

---

## 四、主题颜色设置

Markdown 阅读区背景色 + 字体大小调整。

- **4 种背景色**：White（白底黑字）、Sepia（羊皮纸）、Dark（黑底绿字）、Green（绿底黑字）
- **4 级字号**：S / M / L / XL（0.9rem → 1.35rem）
- 通过 CSS `data-theme` / `data-font-size` 属性驱动样式切换
- Dark 模式下子元素全套配色覆盖（标题、链接、代码块等）
- 点击面板外部自动关闭

**涉及文件**：
- `frontend/src/features/reader/components/ReaderView.tsx`（ThemePanel 组件）
- `frontend/src/styles.css`（`.theme-panel*`、背景色变体、Dark 模式覆盖）

---

## 五、按钮 UI 调整

| 位置 | 改动 |
|------|------|
| AI 设置面板 Close 按钮 | 从 header 移到底部 sticky footer，右下角固定；hover 样式适配文字按钮 |
| Summary 面板 Generate 按钮 | 移到工具栏最右端（`margin-left: auto`） |
| Summary 工具栏标签间距 | Language / Detail 标签改用 `inline-flex`，文字与选项框间距 6px |
| Summary 内容渲染 | 改为 Markdown 渲染，修复列表圆点与文字不对齐问题 |

**涉及文件**：
- `frontend/src/features/ai/components/AiSettingsPage.tsx`
- `frontend/src/features/ai/components/SummaryPanel.tsx`
- `frontend/src/styles.css`
