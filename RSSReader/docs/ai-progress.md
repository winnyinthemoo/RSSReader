# AI 模块进度记录

> 维护人：AI 组（2 人）  
> 说明：每次合并 PR 或完成子任务后，在文末追加一条记录。

## 当前总览

| 模块 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 数据库 migration 0002～0004 | 已完成骨架 | AI 组 | 随应用启动执行 |
| Provider / Model / Secrets | 部分可运行 | 待认领 | 创建 Provider + Test 可联调 |
| Prompt 模板引擎 | 已对齐 Mercury | AI 组 | 四份 YAML 正文 + 条件段 + default_parameters |
| Summary Agent | 第一期可联调 | AI 组 | 非流式 Generate + 缓存；SSE 待 AI-07 |
| Translation Agent | 第一期可联调 | AI 组 | 按段顺序翻译 + 段下译文（全文排版）；重试/SSE 待后续 |
| Tagging Agent | 部分可运行 | 待认领 | Mercury prompt + suggest/assign；面板联调 AI-12 |
| Usage 统计 | 骨架完成 | 待认领 | 写入路径待实现 |
| 前端 AI 设置页 | 骨架完成 | 待认领 | 右下角 AI 按钮 |
| dev_server `/api/ai/*` | 部分路由 | 待认领 | 见 `backend/src/ai/http.rs` |

## 目录与入口

| 路径 | 作用 |
|------|------|
| `RSSReader/resources/Agent/Prompts/` | 内置 Prompt YAML |
| `RSSReader/db/migrations/0002~0004_*.sql` | AI 相关表 |
| `RSSReader/backend/src/ai/` | Rust AI 模块 |
| `RSSReader/shared/ai.ts` | 前后端契约 |
| `RSSReader/frontend/src/features/ai/` | React UI |
| `RSSReader/frontend/src/services/aiService.ts` | API 调用 |
| `RSSReader/docs/ai-issues.md` | 问题与解决记录 |

## Issue 对照（建议）

| ID | 内容 | 状态 |
|----|------|------|
| AI-01 | migration + database | done (skeleton) |
| AI-02 | secrets + openai client | in progress |
| AI-03 | prompt 引擎 + YAML | done (Mercury-aligned) |
| AI-04 | Provider CRUD + test API | in progress |
| AI-05 | shared/ai.ts + aiService | done (skeleton) |
| AI-06 | AiSettingsPage | in progress |
| AI-07 | Summary 后端 + SSE | todo |
| AI-08 | SummaryPanel 联调 | done (phase 1, non-streaming) |
| AI-09 | Translation 后端 | done (phase 1, non-streaming) |
| AI-10 | Translation UI | done (phase 1, bilingual) |
| AI-11 | Tagging 后端 | todo |
| AI-12 | TaggingPanel | todo |
| AI-13 | Usage 写入 + 报表 | todo |
| AI-14 | UsageReportPage | todo (shell) |
| AI-15 | E2E + 文档 | todo |

---

## 变更日志

### 2026-05-22 — AI 模块初始骨架

**操作人**：AI 组（Cursor Agent 协助搭建）

**完成内容**：

1. 新增数据库迁移 `0002`～`0004`（Provider/Model、Tags、Summary/Translation/Usage）。
2. 新增 `backend/src/ai/` 完整模块骨架（provider、prompt、client、summary、translation、tagging、usage、runtime）。
3. 新增 `resources/Agent/Prompts/*.default.yaml`（参考 Mercury 结构）。
4. 新增 `shared/ai.ts` 与 `frontend` AI 组件、`aiService.ts`。
5. `dev_server` 接入 `/api/ai/*` 部分路由。
6. 应用壳增加右下角 **AI** 设置入口；Reader 底部增加 `SummaryPanel` 占位。

**当前可验证**：

```bash
# 后端
cd RSSReader/scripts && backend-dev.cmd
cd RSSReader/backend && cargo check

# 前端
cd RSSReader/scripts && frontend-dev.cmd
```

- `GET http://127.0.0.1:5181/api/ai/providers` → `{ "providers": [] }`
- 前端打开 AI 设置 → 可添加 Provider（需填写 API Key）

**下一步（建议顺序）**：

1. AI-04：补全 Provider 更新/删除、Model CRUD 的 HTTP 路由。
2. AI-07/08：摘要流式 SSE + SummaryPanel 联调。
3. AI-09/10：翻译段切分与双语 UI。
4. AI-11/12：标签建议 JSON 解析与写入。
5. AI-13：每次 LLM 请求写入 `llm_usage_events`。

---

### 2026-05-22 — Mercury AI 资源迁入

**完成内容**：

1. 四份内置 Prompt 替换为 Mercury 生产正文（`summary` v2、`translation` v5、`hy-mt` v4、`tagging` v2）。
2. `template_store` 支持 Mercury 字段别名、`default_parameters`、`version: vN` 解析。
3. 新增 `prompt/parameters.rs`、`messages.rs`；翻译 reveal 按 `hy_mt_optimized` 路由。
4. `Segmenter` 实现 p/ul/ol 分段；`chat_completion` 实现。
5. Summary / Tagging 接入 Prompt + LLM（非流式摘要、标签 JSON 建议、assign 写库）。
6. 新增 `docs/mercury-ai-spec-index.md`。

**验证**：`cargo test`（含 prompt/segmentation 单测）；配置 Provider + Model 后测试摘要/打标签 API。

---

### 2026-05-22 — 摘要第一期 MVP（AI-08）

**完成内容**：

1. 摘要相关 API 契约统一 `camelCase`（`StartSummaryRequest`、`ArticleSummaryRecord` 等）。
2. `SummaryPanel` 接线：`getArticleSummary` 缓存加载 + `startArticleSummary` 生成。
3. `AiSettingsPage` 增加 Model 创建与 Summary agent 的 Primary Model 配置。
4. 长文截断至 12000 字符再送 LLM。

**验证**：右下角 AI → Provider/Model/Summary Settings → 选文章 → 底部 Summary → Generate。

---

### 2026-05-22 — 翻译第一期 MVP（AI-09/10）

**完成内容**：

1. `TranslationService` 按 `p/ul/ol` 分段顺序调用 LLM，写入 `article_translation_runs` / `article_translation_segments`。
2. HTTP：`GET /api/ai/translation`、`POST /api/ai/translation/start`（含 query 路由修复）。
3. 阅读器 **Translate** 按钮：双语对照视图；工具栏可切换目标语言。
4. AI 设置页：**Translation agent**（Model、语言、standard / hy_mt_optimized）。

**验证**：配置 Translation Model → 选文章 → 点工具栏翻译图标 → 等待完成后看中英对照。

---

### 2026-05-22 — 翻译展示方案 A（段下译文 + 纯文本）

**完成内容**：

1. 后端：送 LLM 的 `sourceText` 改为段内纯文本；译文入库前 `sanitize_translation_output`（去 HTML/URL）。
2. Prompt（standard / hy-mt）：要求只输出纯文本。
3. 前端：双语模式渲染完整 `sanitizedHtml`，在每个 `p/ul/ol` 下方注入 `.translation-block`（保留图片与原文排版）。

**验证**：重新点翻译（旧缓存可能仍含 HTML）→ 图文顺序与原文一致，段下为译文且无 `<p>`/长链接。

---

<!-- 在此下方追加新的进度条目 -->
