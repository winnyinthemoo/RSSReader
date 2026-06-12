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
| 开发模式 HTTP API 无鉴权 | 浏览器开发时 `/api/ai/*` 可被本机其他进程调用 | dev_server 增加本地 token 或限制写 Key 接口 |
| 双库连接 | Feed 与 AI 各开 SQLite 连接 | 短期可接受；后期统一 `Database` 池 |

---

## 问题记录

### 2026-06-12 API Key 明文文件存储

- **现象**：API Key 以明文写入 `%APPDATA%/.../secrets/{provider_id}.key`，存在本地泄露风险。
- **影响**：备份、云同步或本机其他用户可能读取 Key。
- **原因**：初期使用文件占位，尚未接入系统凭据存储。
- **解决**：`backend/src/ai/secrets.rs` 改用 `keyring` 写入 OS 凭据管理器（服务名 `com.rssreader.vortex`）；首次读写时自动将遗留 `.key` 文件迁移并删除，写入 `secrets/.keyring-migrated` 标记。
- **验证**：保存 Provider 后 `secrets/` 下无 `*.key` 明文；Windows 凭据管理器可见 `com.rssreader.vortex` 条目；Provider Test 与 AI 调用正常。
- **关联**：`backend/Cargo.toml`、`backend/src/ai/secrets.rs`、`db/README.md`

### 2026-06-12 keyring 未启用 windows-native 导致 Key 丢失

- **现象**：保存 Provider 后 AI 翻译/摘要报 `API key not configured for provider`；Windows 凭据管理器无 `com.rssreader.vortex` 条目。
- **影响**：所有 AI 功能不可用；界面显示已保存 Provider，但 Key 实际未持久化。
- **原因**：`keyring = "3"` 未启用 `windows-native`，crate 回退到内存 mock store，进程重启后 Key 消失；旧版迁移标记阻止重新迁移。
- **解决**：`Cargo.toml` 为 keyring 启用 `windows-native` / `apple-native` / `linux-native-sync-persistent`；迁移标记升级为 `migrated-to-keyring-native-v1`；补充从 `%APPDATA%/RSSReader/secrets` 的遗留目录迁移。
- **验证**：`cargo test secrets::tests::keyring_roundtrip_persists_provider_key` 通过；用户重新输入 API Key 并保存后，翻译/摘要恢复正常。
- **关联**：`backend/Cargo.toml`、`backend/src/ai/secrets.rs`

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
