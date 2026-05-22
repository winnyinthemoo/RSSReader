# AI 模块问题与解决记录

> 维护人：AI 组  
> 格式：遇到问题随时追加；解决后填写 **解决** 与 **验证**。

## 使用说明

```markdown
### [日期] 问题标题

- **现象**：
- **影响**：
- **原因**：（调查后填写，未知可留空）
- **解决**：（修复后填写）
- **验证**：（如何确认已修复）
- **关联**：Issue / PR / 文件路径
```

---

## 已知风险（尚未发生）

| 风险 | 说明 | 预案 |
|------|------|------|
| HTTP 本地 LLM | Windows 上 `http://localhost` 一般可用 | 文档写明 Base URL 格式 |
| 正文质量 | 仅用 `sanitized_html`，摘要效果可能一般 | 后续增强 reader 清洗或抓取全文 |
| API Key 存储 | 当前为文件占位，非系统钥匙串 | 上线前换 `keyring` |
| 双库连接 | Feed 与 AI 各开 SQLite 连接 | 短期可接受；后期统一 `Database` 池 |

---

## 问题记录

### 2026-05-22 Provider Test 报 base_url is required

- **现象**：保存 Provider 后点 Test，提示 `base_url is required`；填了 Base URL 仍无正常结果。
- **原因**：前端 JSON 使用 `providerId`（camelCase），Rust `ProviderTestRequest` 未加 `serde(rename_all = "camelCase")`，`provider_id` 解析为空，回退到“裸测”分支并要求 `baseUrl`/`apiKey`。
- **解决**：为 `ProviderTestRequest` 等请求体补 `camelCase`；设置页改为选择 Provider 再 Test；补 `DELETE /api/ai/providers/:id`。
- **验证**：选已保存 Provider → Test → 显示 `Connection succeeded` 或具体 HTTP 错误。
- **关联**：`backend/src/ai/model.rs`、`frontend/.../AiSettingsPage.tsx`

### 2026-05-22 Delete Provider 提示无法连接后端

- **现象**：点 Delete Provider 显示 `Cannot connect to backend at http://127.0.0.1:5181`（后端实际在跑）。
- **原因**：`dev_server` 的 CORS 仅允许 `GET, POST, OPTIONS`，浏览器对 `DELETE` 预检失败，`fetch` 抛网络错误。
- **解决**：`Access-Control-Allow-Methods` 增加 `PUT, DELETE`。
- **验证**：重启 `backend-dev.cmd` 后删除 Provider 成功。
- **关联**：`backend/src/bin/dev_server.rs`

### 2026-05-22 GET 摘要缓存 501（带 query 未匹配路由）

- **现象**：`GET /api/ai/summary?articleId=...` 返回 `AI route not implemented`；Generate（POST）正常。
- **原因**：`http.rs` 用精确路径 `"/api/ai/summary"` 匹配，实际请求含 `?` 查询串。
- **解决**：路由前统一 `path_without_query()` 剥离查询参数。
- **验证**：选文章后 Summary 区不再报错，有缓存时自动显示已生成摘要。
- **关联**：`backend/src/ai/http.rs`

### 示例（请删除或覆盖）

- **现象**：`POST /api/ai/summary/stream` 返回 400 `Not implemented`
- **影响**：摘要无法生成
- **原因**：骨架阶段尚未实现 AI-07
- **解决**：实现 `SummaryService::start_summary` 与 SSE 路由
- **验证**：选择文章 → Generate → 可见流式文字
- **关联**：`backend/src/ai/summary/service.rs`

---

### 2026-05-22 翻译完成但段下无译文

- **现象**：状态栏显示 `Target: zh-Hans · Status: completed`，正文各段下方无译文。
- **影响**：双语阅读不可用。
- **原因**：`useEffect` 注入译文后 `setInjectResult` 触发重渲染，`dangerouslySetInnerHTML` 清空 DOM，且 effect 依赖未变不再执行。
- **解决**：改为与后端相同的 HTML 分段算法，在字符串中于每个 `p/ul/ol` 后拼接 `.translation-block`（`buildBilingualArticleHtml`）。
- **验证**：刷新 → 打开已翻译文章 → 每段原文下方可见绿色左边框译文。
- **关联**：`frontend/src/features/ai/utils/buildBilingualArticleHtml.ts`

<!-- 在此下方追加真实问题条目 -->
