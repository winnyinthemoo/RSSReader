# AGENTS.md

本文件用于指导 Coding Agent 在本项目中的工作方式。任何 AI Agent 在修改代码前，应先阅读本文件、INIT.md 和 PLAN.md。

## 1. 项目目标

本项目目标是实现一个本地优先、无需登录、跨平台运行的桌面 RSS Reader。项目参考 Mercury 的产品体验和功能设计，但使用 React + TypeScript + Tauri 2 + Rust + SQLite 重新实现。
Mercury 的开源仓库地址：https://github.com/neolee/mercury

当前产品名为 **Vortex**，仓库名为 **RSSReader**。

核心目标：

- 提供简洁优雅的 RSS 阅读体验。
- 支持本地保存订阅源、文章、阅读状态、标签、笔记、摘要和翻译结果。
- 不主动采集用户数据，不需要账号系统。
- 支持 Windows 和 macOS 内测包；Linux 作为后续扩展验证。
- 支持 OpenAI-compatible AI Provider，不绑定单一模型服务。
- 保留有价值的 Coding Agent 工作过程文档。
- 保留清晰的团队协作提交历史、Issue、PR 和 Release 记录。

## 2. 沟通语言

- 团队沟通、文档说明、Issue、PR 描述优先使用中文。
- 代码命名、函数名、类型名、文件名使用英文。
- 代码注释可以使用英文，复杂业务说明可以使用中文。
- Agent 输出说明时优先使用中文。

## 3. 技术栈

### 前端

- React 19
- TypeScript
- Vite 7
- CSS
- lucide-react
- react-markdown / remark-gfm / rehype-raw
- turndown

### 桌面与后端

- Tauri 2
- Rust
- SQLite
- rusqlite bundled
- reqwest
- feed-rs
- readability
- serde / serde_json / serde_yaml
- ammonia
- keyring

当前后端由两部分组成：

- `RSSReader/backend/`：Rust 业务 crate，负责 RSS、SQLite、Reader、AI、开发 HTTP server 等业务能力。
- `RSSReader/src-tauri/`：Tauri 2 应用壳，负责窗口、Tauri Commands、应用数据目录、桌面权限、OPML 文件选择和打包配置。

### AI 能力

- 仅支持 OpenAI-compatible Chat Completions API。
- 不绑定某一家模型服务。
- API Key 只能保存在本地系统凭据 / 钥匙串，禁止写入源码或提交到 GitHub。
- AI 请求必须由用户主动触发或明确配置，不自动批量上传用户文章内容。

## 4. 架构原则

### 4.1 前后端边界

项目应用代码位于 `RSSReader/` 目录下。当前核心目录定位如下：

- `RSSReader/frontend/`：前端，负责 UI、交互、状态展示和调用 Tauri Commands / dev server。
- `RSSReader/backend/`：Rust 业务后端，负责 RSS、数据库、Reader、AI 调用等业务逻辑。
- `RSSReader/src-tauri/`：Tauri 桌面应用壳，负责 Commands 暴露、窗口配置、应用数据目录、系统能力和打包。
- `RSSReader/db/`：数据库，负责 SQLite 表结构、迁移、初始化脚本和数据库说明。
- `RSSReader/shared/`：前后端共享，负责 Command 契约、共享类型和通用常量。
- `RSSReader/resources/`：资源模板，负责 Prompt 模板、文摘模板等可复用文本资源。
- `RSSReader/build/`：打包，负责 Windows / macOS / Linux 打包配置、产物说明和发布材料。
- `RSSReader/docs/`：项目文档、决策记录和 Agent 工作记录。
- `RSSReader/scripts/`：开发、检查、构建辅助脚本。
- `RSSReader/screenshots/`：截图、验收材料和演示素材。

前端不得直接访问 SQLite。
前端不得直接保存 API Key 到源码或数据库。
前端不得绕过 Tauri Commands 访问本地系统能力。

### 4.2 Command 接口优先

前后端通过 Tauri Commands 通信；普通浏览器开发模式可通过本地 dev server 调试。新增功能时，应优先设计 Command 名称、输入参数、返回类型和错误类型。

当前 Command 覆盖以下能力：

- Feed：列表、添加、订阅占位、刷新、后台刷新、重命名、删除。
- Article：列表、详情、已读、收藏、搜索、标签、笔记、笔记导出。
- OPML：导入、导出、保存对话框。
- Tags：列表、保存、删除、重命名、合并、多标签筛选。
- AI：Provider / Model / Agent 设置、Prompt、摘要、翻译、标签建议、用量统计、用量清理。

### 4.3 模块边界

- `RSSReader/frontend/src/features/feeds`：订阅源、标签、OPML、同步设置相关 UI。
- `RSSReader/frontend/src/features/articles`：文章列表、搜索和筛选相关 UI。
- `RSSReader/frontend/src/features/reader`：阅读器、Markdown、原网页、双栏、主题、链接、笔记相关 UI。
- `RSSReader/frontend/src/features/ai`：AI 摘要、翻译、Provider / Model / Agent 设置和用量 UI。
- `RSSReader/backend/src/feeds`：RSS 请求、解析、订阅源、文章、标签、笔记业务逻辑。
- `RSSReader/backend/src/database`：SQLite 连接、migration 和数据库初始化。
- `RSSReader/backend/src/ai`：AI Provider、Prompt、摘要、翻译、标签、用量和 keyring。
- `RSSReader/src-tauri/`：桌面壳、Commands、文件选择、保存对话框和平台打包。

不得在一个模块中实现另一个模块的大量业务逻辑。若出现大文件、重复逻辑或跨模块耦合，应优先拆分或记录 refactor 任务。

## 5. 编码约定

### 5.1 TypeScript

- 避免使用 `any`。
- 前后端共享类型放入 `RSSReader/shared/`；仅前端使用的公共类型放入 `RSSReader/frontend/src/types/` 或对应 feature 的 types 目录。
- UI 组件尽量小而清晰。
- 不在组件中写复杂业务逻辑。
- 组件只调用前端 service、hook 或 store，不直接拼接复杂后端参数。
- 大型功能组件应拆成状态协调层、展示组件、工具函数和样式文件。

### 5.2 Rust

- 使用 `Result<T, AppError>` 或模块内统一错误类型处理错误，并转换为前端可读信息。
- 数据结构需要通过 `serde` 支持序列化和反序列化。
- 数据库操作应集中在 repository 层。
- 数据库 migration、schema 和初始化说明应与 `RSSReader/db/` 保持一致。
- RSS 解析、HTML 清洗、AI 调用应分模块实现。
- 避免在 Tauri Command 中写过长逻辑，Command 只做参数接收、后台任务调度和调用 service。
- 长耗时网络、AI、正文补全任务不得阻塞全局锁或 UI 主流程。

### 5.3 SQLite

- 所有表结构变更必须通过 `RSSReader/db/migrations/` 中的 migration 记录。
- 不直接在多个位置散落 SQL。
- 重要字段需要有索引，例如 feed_id、article_url、published_at、标签筛选和文章列表排序相关字段。
- 文章 URL 应有去重策略。
- 删除 Feed 时应明确是否级联删除文章。
- AI Key 不写入 SQLite；只保存 Provider / Model 元数据和 AI 结果。

## 6. 安全与隐私约束

- 禁止添加用户注册、登录、远程同步功能，除非经过团队讨论并记录决策。
- 禁止主动上传用户订阅源、阅读记录、文章内容。
- 禁止将 API Key 写入源码、文档示例、测试数据或 SQLite。
- 处理 RSS HTML 内容时必须清洗，避免直接渲染不可信 HTML。
- AI 请求必须由用户主动触发或明确配置，不应自动批量发送用户文章内容。
- 原网页、外链和下载功能应优先通过 Tauri 明确授权路径或清晰 fallback 实现。

## 7. Agent 使用规则

每次使用 Coding Agent 完成实际任务时，需要在 `RSSReader/docs/agent-logs/` 中记录：

- 日期
- 负责人
- 使用工具
- 对应 Issue / PR
- 任务目标
- 关键 Prompt 摘要
- Agent 修改内容摘要
- 人工检查结果
- 是否运行测试
- 未解决问题

Agent 不应一次性完成过大任务。
每次只处理一个 Issue 或一个明确子任务。
如果任务边界不清楚，Agent 应先提出问题，而不是直接生成代码。
若任务来自 GitHub Issue / PR，应在日志中写明编号；若用户直接提出任务，也应说明“未指定 Issue / PR”。

## 8. 开发流程

标准流程：

```text
Issue -> Branch -> Agent/人工开发 -> 本地运行 -> Commit -> Push -> Pull Request -> Review -> Merge -> Release / 文档更新
```

当前项目已经进入最终验收阶段，常规工作流为：

```text
发现问题 -> 判断是否阻断验收 -> 小范围修复 -> 构建验证 -> 记录 Agent log -> 必要时发布新修订包 -> 更新 README / PLAN
```

每个 PR 应说明：

- 对应 Issue
- 做了什么
- 改了哪些目录
- 是否使用 Agent
- 如何验证
- 是否有截图
- 是否有风险或后续待办

## 9. 验证命令

前端修改后，应在 `RSSReader/` 应用目录或 `RSSReader/frontend/` 下至少运行：

```bash
npm run frontend:build
```

Rust 后端修改后，应在 `RSSReader/backend/` 下至少运行：

```bash
cargo check
cargo test
```

Tauri 桌面壳修改后，应在 `RSSReader/src-tauri/` 下至少运行：

```bash
cargo check
```

完整应用修改或发布前，应在 `RSSReader/` 下按平台运行：

```bash
npm run tauri:dev
npm run tauri:build:windows
npm run tauri:build:mac
```

打包命令需要对应平台环境。发布前必须人工安装测试包并做 smoke test。

## 10. 重构规则

当出现以下情况时，应创建 refactor Issue 或在 Agent log 中说明：

- 单个文件过长
- 同类逻辑复制多次
- 命名不一致
- 前端组件包含过多业务逻辑
- Rust Command 过长
- SQL 分散在多个模块
- 错误处理风格不一致
- Agent 引入临时绕过方案并被后续代码复制

2026-06 已完成一次主要结构重构：Reader、FeedSidebar、styles.css、feeds repository 等已拆分。后续重构应保持功能稳定，不应在验收前做大范围非必要改动。

## 11. 当前项目状态

- 项目已进入 `1.0.0` 正式首版发布阶段。
- Windows 正式首版为 `v1.0.0`。
- macOS 正式首版为 `v1.0.0`，Apple Silicon / arm64，ad-hoc 签名，未 notarize。
- RSS 阅读、OPML、搜索、标签、笔记、AI 摘要、AI 翻译、AI 标签建议、用量统计、keyring、Windows/macOS 打包均已完成主体实现。
- 当前重点是最终 smoke test、演示材料、README / PLAN / INIT / AGENTS 同步，以及少量遗留 Issue 的说明或关闭。

## 12. 已知问题

- Summary Prompt 输出质量仍可继续打磨，对应 GitHub Issue #1。
- 原始网页视图受目标网站 iframe / CSP / 网络限制影响，对应 GitHub Issue #4；应用应提供 fallback 或清晰说明。
- macOS 包当前为 ad-hoc 签名，未 notarize，适合课程、内测和受控分发；公开分发前仍需 Developer ID 签名与 notarization。
- Linux 与 Intel Mac 尚未作为正式验收平台。
- Vite 仍存在 chunk size warning，当前不阻塞功能验收。
- AI 功能依赖用户自行配置的 Provider、API Key、模型能力和网络环境。

## 13. Agent 修改本文件的规则

当项目发生以下变化时，应更新本文件：

- 技术栈变化
- 目录结构变化
- 新增重要模块
- 新增关键约束
- 发现重要工程经验
- 某类 Agent 错误反复出现
- GitHub 工作流调整
- Release / 验收阶段变化

更新时只记录关键决策和长期有效规则，不记录琐碎过程。
