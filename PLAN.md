# PLAN.md

## 项目总目标

实现一个本地优先、无需登录、跨平台运行的桌面 RSS Reader。项目以 Mercury 的核心阅读体验为参考，但使用 React + TypeScript + Tauri 2 + Rust + SQLite 重新实现，并完整保留团队协作、GitHub Issue / PR 和 Coding Agent 使用过程。

当前产品名为 **Vortex**，仓库名为 **RSSReader**。

## 当前状态

截至 2026-06-26，项目开发主体已经基本完成，当前进入最终验收、演示准备和小范围缺陷收敛阶段。

| 项目 | 当前状态 |
|------|----------|
| 应用版本 | `1.0.0` |
| Windows 正式包 | `v1.0.0`，发布到 GitHub Releases |
| macOS 正式包 | `v1.0.0`，Apple Silicon / arm64，ad-hoc 签名，未 notarize |
| GitHub Issue | 25 个 issue 中 23 个已关闭，仍打开 #1、#4 |
| GitHub PR | #17、#19、#20、#21、#24 均已关闭，其中 #20/#21 已整合，#24 为 AI 兼容性文档 |
| 当前重点 | 最终文档、演示材料、安装包 smoke test、少量遗留问题说明 |

仍打开的 Issue：

- #1：Summary 提示词完善。属于摘要输出质量和 Prompt 体验优化。
- #4：原始网页无法显示。主要受目标站点 iframe / CSP / 网络访问限制影响，应用已有原网页入口和 fallback，但需要在文档中明确限制。

## 已完成功能总览

### RSS 与文章

- RSS / Atom 订阅源添加、重命名、删除、刷新和自动同步控制。
- OPML 导入与导出；导入时先保存订阅源，再后台并发刷新文章。
- Feed 自定义名称与源站标题分离，刷新不会覆盖用户命名。
- 文章列表支持已读 / 未读、收藏、Feed 筛选、文章搜索、标签筛选。
- 数据保存在本地 SQLite，数据库 migration 已覆盖核心功能和性能索引。

### Reader 阅读体验

- 三栏桌面布局、可调整栏宽、可隐藏侧栏。
- Markdown 阅读视图、原始网页入口、双栏对比视图。
- 阅读主题、字号、正文宽度、浅色 / 深色显示。
- 当前文章查找、翻译视图查找高亮、文章列表搜索。
- 文章内链接可在阅读器内打开并返回；相对链接和相对图片已做补全。
- 标签、笔记、复制、分享和 Markdown 导出。
- 文章点击性能已优化：本地详情立即返回，短正文补全转为后台任务。

### 标签与笔记

- 手动添加标签、AI 标签建议、标签筛选。
- 左侧标签区保留单标签快速筛选，文章列表顶部支持多标签任一 / 全部匹配。
- 标签重命名、合并、删除和确认弹窗。
- 每篇文章可保存 Markdown 笔记，并支持分享、复制和导出。

### AI 能力

- OpenAI-compatible Provider / Model 配置与连接测试。
- API Key 已升级为操作系统凭据管理器 / macOS Keychain 保存，不写入源码或 SQLite。
- Summary、Translation、Tagging 三类 Agent 可独立绑定模型。
- 摘要支持目标语言和详细程度配置，并已接入流式生成展示。
- 翻译支持全文分段、双语对照、17 种目标语言、选中文本翻译、失败段落重试和后台任务显示控制。
- 标签建议支持模型返回标签并写入本地标签系统。
- AI 用量统计支持按 Provider、Model、Agent 查看和清理。
- 已整理 `docs/ai-compatibility.md`，记录兼容接口、已测 Provider / Model 和测试流程。

### 打包与发布

- Windows NSIS 安装包已多轮发布到 GitHub Releases。
- macOS Apple Silicon `.dmg` 内测包已支持 ad-hoc 签名；未 notarize，需按 README 说明解除 quarantine。
- README 已包含中文 / 英文介绍、安装、快速上手、AI 配置、隐私说明、源码构建和常见问题。

## 当前项目目录定位

项目应用代码统一放在 `RSSReader/` 目录下：

- `RSSReader/frontend/`：React + TypeScript + Vite 前端，负责 UI、交互、状态展示和 Tauri Commands / dev server 调用。
- `RSSReader/backend/`：Rust 业务 crate，负责 RSS、数据库、Reader 内容处理、AI Provider 调用和开发 HTTP server。
- `RSSReader/src-tauri/`：Tauri 2 桌面应用壳，负责窗口、Commands、应用数据目录、桌面权限、OPML 文件选择和打包配置。
- `RSSReader/db/`：SQLite schema、migration 和数据库说明。
- `RSSReader/shared/`：前后端共享 Command 契约和 TypeScript 类型。
- `RSSReader/resources/`：内置 Prompt 模板和可复用文本资源。
- `RSSReader/build/`：跨平台打包说明和发布材料。
- `RSSReader/docs/`：项目文档、AI 文档、Agent 工作记录和汇报材料。
- `RSSReader/scripts/`：开发、检查、构建辅助脚本。
- `RSSReader/tests/`：测试用例、测试数据和人工验收材料。
- `RSSReader/screenshots/`：界面截图、验收截图和演示素材。

## 阶段完成情况

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0 产品拆解与项目初始化 | 已完成 | 初始化文档、目录和协作方式已建立。 |
| Phase 1 项目脚手架与基础架构 | 已完成 | React / Tauri / Rust / SQLite 项目骨架和共享契约已落地。 |
| Phase 2 RSS Reader MVP | 已完成 | 添加 Feed、刷新、列表、阅读、状态保存已形成闭环。 |
| Phase 3 体验完善与扩展功能 | 已完成 | OPML、收藏、搜索、标签、笔记、内容清洗和 Reader 体验已实现。 |
| Phase 4 AI 功能与项目收尾 | 已完成主体 | Provider、Model、摘要、翻译、标签建议、用量统计、keyring 已实现。 |
| Phase 5 测试与打包验证 | 基本完成 | Windows/macOS 安装包已验证，主要缺陷已关闭，剩少量说明型问题。 |
| Phase 6 最终验收与展示 | 当前阶段 | 聚焦文档、演示、最终 smoke test 和遗留风险说明。 |

## Phase 6：最终验收与展示

### 目标

不再扩大功能范围，围绕 `1.0.0` 正式首版完成课程 / 项目验收所需的最终材料、测试记录和风险说明。

### Task 6.1：最终安装包 Smoke Test

- Windows：下载并安装 `v1.0.0`，验证启动、添加 Feed、OPML 导入、同步、阅读、搜索、收藏、标签、笔记、摘要、翻译、导出和设置页。
- macOS：下载并安装 `v1.0.0`，验证打开方式、quarantine 解除说明、基础阅读流程和 AI Keychain 权限提示。
- 输出：一份最终 smoke test 记录，包含测试人、系统版本、安装包版本、通过项和失败项。

### Task 6.2：关闭或说明遗留 Issue

- #1：若时间允许，继续微调 Summary Prompt；若不改代码，则在最终说明中标记为低优先级体验优化。
- #4：明确原始网页内嵌受目标站点限制，不作为应用核心缺陷；文档中说明 fallback 和外部打开策略。
- 若验收前出现新问题，只修阻断演示或破坏核心流程的问题。

### Task 6.3：最终文档整理

- 保持 README 与 Releases 当前版本一致。
- 更新 AGENTS / INIT / PLAN，使其反映“开发主体完成，进入验收收尾”的状态。
- 检查 `docs/agent-logs/` 是否覆盖关键 Agent 工作记录。
- 保留 AI 兼容性、macOS 打包、内容抽取修复、性能修复等说明文档。

### Task 6.4：演示材料准备

- 准备最终截图或录屏，覆盖：订阅源管理、阅读器、OPML、标签 / 笔记、AI 摘要、AI 翻译、设置页、用量统计。
- 准备架构说明：React 前端、Tauri 壳、Rust 后端、SQLite、OpenAI-compatible AI、系统 keyring。
- 准备协作说明：Issue、PR、Release、Agent log、测试反馈和小核心开发 + 全员测试流程。

### Task 6.5：发布与风险说明

- 明确当前发布包为 `1.0.0` 正式首版，同时保留 macOS 未 notarize 等平台分发限制说明。
- 说明 macOS 包为 ad-hoc 签名，未 notarize，仅用于课程 / 内测场景。
- 说明 Linux 与 Intel Mac 尚未作为正式验收平台。
- 说明 AI 能力依赖用户自行配置的 Provider、API Key、模型能力和网络环境。

## 验证命令

常规验证以 README 和脚本为准。最终阶段建议至少保留以下命令和人工验收：

```bash
npm run frontend:build
```

```bash
cd backend
cargo check
cargo test
```

```bash
cd src-tauri
cargo check
```

```bash
npm run tauri:build:windows
npm run tauri:build:mac
```

打包命令需要对应平台环境。Windows 需要 Visual Studio Build Tools / Windows SDK，macOS 需要 Xcode Command Line Tools。打包成功后必须人工安装并做 smoke test。

## 后续可选优化

以下内容不阻塞当前验收，可作为后续版本方向：

- Summary Prompt 质量继续打磨。
- 原始网页打开策略继续增强，例如外部浏览器打开、代理阅读或更清晰的站点限制提示。
- 文章搜索升级为 SQLite FTS，提升大数据量搜索性能。
- AI 设置页进一步拆分和动态加载，降低前端主 chunk 体积。
- 翻译后端加入真正可取消任务队列和并发速率控制。
- macOS Developer ID 签名、notarization 和 Intel Mac 包。
- Linux 打包和安装测试。
- 更多 Provider / Model 兼容性测试记录。

## 最终验收标准

1. Windows 安装包可以安装、启动，并完成核心阅读流程。
2. macOS Apple Silicon 内测包可以按 README 说明打开，并完成基础流程。
3. 可以添加、导入、刷新、重命名和删除 RSS / Atom 订阅源。
4. 可以查看文章列表、正文、原网页入口和双栏对比视图。
5. 可以本地保存订阅源、文章、阅读状态、收藏、标签、笔记、摘要和翻译结果。
6. 可以使用标签、搜索、收藏、已读 / 未读筛选管理阅读队列。
7. 可以配置 OpenAI-compatible Provider / Model，并使用摘要、翻译和标签建议。
8. API Key 不写入源码或 SQLite，保存到系统凭据 / 钥匙串。
9. 不需要注册登录，不主动采集或上传用户阅读数据。
10. README、INIT、AGENTS、PLAN、Agent logs、AI 文档和打包说明可支撑最终汇报。
11. 已知限制和遗留 issue 有清晰说明，不影响核心演示。
