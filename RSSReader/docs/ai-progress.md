# AI 模块进度记录

> 维护人：AI 组（2 人）  
> 说明：每次合并 PR 或完成子任务后，在文末追加一条记录。

## 当前总览

| 模块 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 数据库 migration 0002～0004 | 已完成骨架 | AI 组 | 随应用启动执行 |
| Provider / Model / Secrets | 部分可运行 | 待认领 | Provider CRUD + Test；Key 已改 keyring 存储 |
| Prompt 模板引擎 | 已对齐 Mercury | AI 组 | 四份 YAML 正文 + 条件段 + default_parameters |
| Summary Agent | 第一期可联调 | AI 组 | 非流式 Generate + 缓存 + Try again；17 种目标语言；SSE 待 AI-07 |
| Translation Agent | 第一期可联调 | AI 组 | 按段翻译 + 双语排版；17 种目标语言；手动 Try again（跳过缓存）；段级自动重试/SSE 待后续 |
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
| `RSSReader/backend/src/ai/secrets.rs` | API Key 本地存储（keyring） |
| `RSSReader/frontend/src/constants/targetLanguages.ts` | 摘要/翻译/AI 设置共用的 17 种目标语言 |

## 目标语言与重试

> 最后更新：2026-06-12

### 目标语言（17 种）

共享常量：`frontend/src/constants/targetLanguages.ts`（阅读器 `options.ts` re-export 为 `translationLanguageOptions`）。

| 界面位置 | 作用 |
|----------|------|
| 阅读器工具栏语言下拉 | 全文翻译 **目标语言** |
| `SummaryPanel` 语言下拉 | 摘要 **输出语言** |
| AI 设置 → Summary / Translation | Agent **默认目标语言**（`defaultTargetLanguage`） |

下拉 **label** 使用各语言本族语名称（如 `简体中文`、`English`、`日本語`）；传给后端的 **value** 仍为语言代码（如 `zh-Hans`、`en`）。后端 `language_display_name()` 将其转为 Prompt 用的英文全称（如 `Simplified Chinese`）。

当前未做：阅读器/摘要面板启动时自动读取 AI 设置中的 `defaultTargetLanguage`（打开时默认仍为 `zh-Hans`）。

### 手动重试（Try again）

| 功能 | 入口 | 行为 |
|------|------|------|
| 摘要 | `SummaryPanel` 按钮：有缓存或报错时文案为 **Try again** | 再次调用 `startArticleSummary`，后端 `upsert` 覆盖旧摘要 |
| 全文翻译 | 双语视图打开后，工具栏翻译按钮旁的 **↻** | `forceRefresh` 跳过本地缓存（含 `completed` / `partial`），后端删除旧 run 后整篇重译 |

未实现：LLM 请求失败自动重试、仅重试 `failed` 段、划词翻译独立重试按钮。

## API Key 存储说明

> 最后更新：2026-06-12

### 设计原则

- API Key **不写入 SQLite**，数据库仅存 Provider 元数据（名称、Base URL、启用状态等）。
- Key **仅存于本机**，不上传服务器、不入 Git。
- 应用 **只写不读**：保存后前端清空输入框，列表/查询接口不回传 `apiKey`。
- 删除 Provider 时，同步删除系统凭据及可能残留的明文文件（见 `AiProviderService::delete_provider`）。

### 实现方式

| 项目 | 说明 |
|------|------|
| 模块 | `backend/src/ai/secrets.rs`（`SecretStore`） |
| 依赖 | `keyring` v3，需启用平台特性：`windows-native` / `apple-native` / `linux-native-sync-persistent` |
| 服务名 | `com.rssreader.vortex`（与 Tauri `identifier` 一致） |
| 账户名 | Provider ID（UUID） |

### 各平台存储位置

| 平台 | 存储介质 | 用户查看方式 |
|------|----------|--------------|
| Windows | 凭据管理器（DPAPI 保护） | `控制面板 → 凭据管理器 → Windows 凭据`，或 `cmdkey /list`（仅显示目标名，不显示密码） |
| macOS | Keychain（钥匙串） | 「钥匙串访问」中搜索 `vortex` / `rssreader` |
| Linux | Secret Service | 取决于桌面环境（如 GNOME Keyring） |

凭据目标名示例（Windows）：

```text
LegacyGeneric:target={provider_id}.com.rssreader.vortex
```

### 应用数据目录

| 运行方式 | 数据目录 |
|----------|----------|
| Tauri 桌面版 | `%APPDATA%/com.rssreader.vortex/`（Windows）或 `~/Library/Application Support/com.rssreader.vortex/`（macOS） |
| 开发模式后端（未设环境变量） | `%APPDATA%/RSSReader/` 或 `~/.rssreader/` |

数据库文件：`{数据目录}/vortex.sqlite3`
迁移标记：`{数据目录}/secrets/.keyring-migrated`（内容 `migrated-to-keyring-native-v1`）

### 遗留明文迁移

首次读写 `SecretStore` 时自动执行：

1. 扫描 `{数据目录}/secrets/*.key` 明文文件；
2. Tauri 环境下额外扫描旧开发目录（`%APPDATA%/RSSReader/secrets` 或 `~/.rssreader/secrets`）；
3. 写入 keyring 后删除明文，并写入迁移标记。

若 keyring 中已有同 Provider 条目，则跳过并仅删除明文文件。

### 安全性说明

- **不是**应用层 AES 加密，而是 **OS 凭据/钥匙串托管**（Windows DPAPI、macOS Keychain 等）。
- 比早期明文 `.key` 文件更安全，但同一系统用户仍可通过系统工具查看 Key。
- 开发模式 `dev_server` 的 `/api/ai/*` 仍无本地鉴权，详见 `ai-issues.md` 已知风险。

### 运维提示

- 更换电脑或重装系统后，需在应用内 **重新输入并保存** API Key。
- 修复 keyring 平台特性后，用户若遇 `API key not configured for provider`，应重新填写 Key 并保存（不可留空）。
- 历史孤儿凭据（已删 Provider 但凭据未清）可在系统凭据管理器/钥匙串中手动删除。

## Issue 对照（建议）

| ID | 内容 | 状态 |
|----|------|------|
| AI-01 | migration + database | done (skeleton) |
| AI-02 | secrets + openai client | done (keyring + legacy migration) |
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

### 2026-06-12 — API Key 改 keyring 存储

**完成内容**：

1. `backend/src/ai/secrets.rs`：明文 `.key` 文件改为 `keyring` 写入 OS 凭据管理器（`com.rssreader.vortex`）。
2. `Cargo.toml` 启用 `windows-native` / `apple-native` / `linux-native-sync-persistent`（避免回退到内存 mock store）。
3. 首次读写自动迁移遗留 `secrets/*.key`，删除明文并写入 `.keyring-migrated` 标记（`migrated-to-keyring-native-v1`）。
4. 文档同步：`ai-issues.md`、`db/README.md`、`mercury-ai-spec-index.md`；本文档新增「API Key 存储说明」专节。

**验证**：保存 Provider 后无 `*.key` 明文；凭据管理器有条目；`cargo test secrets::tests::keyring_roundtrip_persists_provider_key` 通过；Provider Test / 翻译正常。

---

### 2026-06-12 — 摘要/设置 17 种目标语言对齐

**完成内容**：

1. 新增 `frontend/src/constants/targetLanguages.ts`，统一 17 种目标语言（与阅读器翻译一致）。
2. `SummaryPanel`、`AiSettingsPage` 的 `LanguageSelect` 从 2 种扩展为 17 种。
3. `reader/options.ts` 改为 re-export 共享常量，避免重复维护。

**验证**：摘要面板与 AI 设置的语言下拉与阅读器选项一致；选择非中英语言可正常生成摘要（依赖模型能力）。

---

### 2026-06-12 — 目标语言下拉显示本族语名称

**完成内容**：

1. `targetLanguages.ts` 的 `label` 改为本族语（如 `简体中文`、`English`、`日本語`），不再使用 `Simplified Chinese` 等英文描述名。
2. 后端仍接收 `zh-Hans`、`en` 等代码，Prompt 逻辑不变。

**验证**：阅读器、摘要、AI 设置三处下拉显示一致的本族语名称。

---

### 2026-06-12 — 摘要与翻译「Try again」

**完成内容**：

1. **摘要**：`SummaryPanel` 在已有内容或报错时，主按钮文案变为 **Try again**，强制重新生成并覆盖缓存。
2. **翻译**：`ReaderView.runArticleTranslation(forceRefresh)`；双语视图下工具栏新增 **↻** 按钮，跳过 `completed` / `partial` 缓存并整篇重译。
3. 本文档新增「目标语言与重试」专节；更新总览表备注。

**验证**：摘要生成后点 Try again 得到新结果；翻译缓存命中后点 ↻ 可重新请求；`partial` 状态亦可整篇重做。

---

<!-- 在此下方追加新的进度条目 -->
