# AGENTS.md

本文件用于指导 Coding Agent 在本项目中的工作方式。任何 AI Agent 在修改代码前，应先阅读本文件、INIT.md 和 PLAN.md。

## 1. 项目目标

本项目目标是实现一个本地优先、无需登录、跨平台运行的 RSS Reader。项目参考 Mercury 的产品体验和功能设计，但使用 React + TypeScript + Tauri + Rust + SQLite 重新实现。
Mercury的开源仓库地址：https://github.com/neolee/mercury

核心目标：

- 提供简洁优雅的 RSS 阅读体验
- 支持本地保存订阅源、文章、阅读状态
- 不主动采集用户数据
- 支持 Windows / macOS / Linux
- 保留有价值的 Coding Agent 工作过程文档
- 保留清晰的团队协作提交历史

## 2. 沟通语言

- 团队沟通、文档说明、Issue、PR 描述优先使用中文。
- 代码命名、函数名、类型名、文件名使用英文。
- 代码注释可以使用英文，复杂业务说明可以使用中文。
- Agent 输出说明时优先使用中文。

## 3. 技术栈

### 前端

- React
- TypeScript
- Vite
- CSS / Tailwind CSS，具体 UI 库后续确认

### 桌面与后端

- Tauri
- Rust
- SQLite
- rusqlite
- reqwest
- feed-rs
- serde
- ammonia

### AI 能力

- 仅支持 OpenAI-compatible API
- 不绑定某一家模型服务
- API Key 只能保存在本地，禁止写入源码或提交到 GitHub

## 4. 架构原则

### 4.1 前后端边界

项目应用代码位于 `RSSReader/` 目录下。当前核心目录定位如下：

- `RSSReader/frontend/`：前端，负责 UI、交互、状态展示和调用 Tauri Commands。
- `RSSReader/backend/`：后端，负责 Tauri / Rust 本地能力、RSS、文件、AI 调用等业务逻辑。
- `RSSReader/db/`：数据库，负责 SQLite 表结构、迁移、初始化脚本和数据库说明。
- `RSSReader/shared/`：前后端共享，负责 Command 契约、共享类型和通用常量。
- `RSSReader/resources/`：资源模板，负责 Prompt 模板、文摘模板等可复用文本资源。
- `RSSReader/build/`：打包，负责 Windows / macOS / Linux 打包配置、产物说明和发布材料。
- `RSSReader/docs/`：项目文档、决策记录和 Agent 工作记录。

前端位于 `RSSReader/frontend/`，只负责：

- 页面布局
- 用户交互
- 状态展示
- 调用 Tauri Commands
- 显示后端返回的数据

后端位于 `RSSReader/backend/`，负责：

- RSS 请求
- RSS / Atom / JSON Feed 解析
- SQLite 读写
- OPML 文件导入导出
- HTML 清洗
- AI Provider 调用
- 本地文件和系统能力

数据库相关文件位于 `RSSReader/db/`。后端可以通过 repository / service 访问数据库，但前端不得直接访问数据库文件或 SQL。

前端不得直接访问 SQLite。  
前端不得直接保存 API Key 到源码。  
前端不得绕过 Tauri Commands 访问本地系统能力。

### 4.2 Command 接口优先

前后端通过 Tauri Commands 通信。新增功能时，应优先设计 Command 名称、输入参数、返回类型和错误类型。

示例：

```text
feed_add(url) -> FeedWithArticles
feed_refresh(feed_id) -> FeedRefreshResult
article_list(filter) -> ArticleListResult
article_get(article_id) -> ArticleDetail
article_mark_read(article_id, is_read) -> void
opml_import(path) -> ImportResult
opml_export(path) -> ExportResult
ai_summarize(article_id, provider_id) -> SummaryResult
```

### 4.3 模块边界

- `RSSReader/frontend/src/features/feeds`：订阅源相关 UI
- `RSSReader/frontend/src/features/articles`：文章列表相关 UI
- `RSSReader/frontend/src/features/reader`：阅读器相关 UI
- `RSSReader/frontend/src/features/tags`：标签相关 UI
- `RSSReader/frontend/src/features/ai`：AI 摘要、翻译、Provider 设置 UI
- `RSSReader/backend/src/feeds`：RSS 请求、解析、订阅源业务逻辑
- `RSSReader/backend/src/articles`：文章查询、状态更新
- `RSSReader/backend/src/database`：SQLite 连接、Repository 和数据库访问封装
- `RSSReader/backend/src/reader`：正文清洗与阅读内容处理
- `RSSReader/backend/src/ai`：AI Provider 调用
- `RSSReader/db/`：SQLite migration、schema、初始化数据和数据库说明
- `RSSReader/shared/`：前后端共享类型、Command 输入输出契约和通用常量
- `RSSReader/resources/`：Prompt 模板、文摘模板和其他文本模板资源
- `RSSReader/build/`：跨平台打包配置、脚本和产物说明
- `RSSReader/docs/`：项目文档和过程记录

不得在一个模块中实现另一个模块的大量业务逻辑。

## 5. 编码约定

### 5.1 TypeScript

- 避免使用 `any`。
- 前后端共享类型放入 `RSSReader/shared/`；仅前端使用的公共类型放入 `RSSReader/frontend/src/types/` 或对应 feature 的 types 目录。
- UI 组件尽量小而清晰。
- 不在组件中写复杂业务逻辑。
- 组件只调用前端 service 或 store，不直接拼接复杂后端参数。

### 5.2 Rust

- 使用 `Result<T, AppError>` 处理错误。
- 后端错误应转换为前端可读的错误信息。
- 数据结构需要通过 `serde` 支持序列化和反序列化。
- 数据库操作应集中在 repository 层。
- 数据库 migration、schema 和初始化说明应与 `RSSReader/db/` 保持一致。
- RSS 解析、HTML 清洗、AI 调用应分模块实现。
- 避免在 Tauri Command 中写过长逻辑，Command 只做参数接收和调用 service。

### 5.3 SQLite

- 所有表结构变更必须通过 `RSSReader/db/` 中的 migration 记录。
- 不直接在多个位置散落 SQL。
- 重要字段需要有索引，例如 feed_id、article_url、published_at。
- 文章 URL 应有去重策略。
- 删除 Feed 时应明确是否级联删除文章。

## 6. 安全与隐私约束

- 禁止添加用户注册、登录、远程同步功能，除非经过团队讨论并记录决策。
- 禁止主动上传用户订阅源、阅读记录、文章内容。
- 禁止将 API Key 写入源码、文档示例或测试数据。
- 处理 RSS HTML 内容时必须考虑清洗，避免直接渲染不可信 HTML。
- AI 请求必须由用户主动触发或明确配置，不应自动批量发送用户文章内容。

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

## 8. 开发流程

标准流程：

```text
Issue -> Branch -> Agent/人工开发 -> 本地运行 -> Commit -> Push -> Pull Request -> Review -> Merge -> 更新文档
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

前端修改后，应在 `RSSReader/frontend/` 下至少运行：

```bash
npm run dev
npm run build
```

Rust 后端修改后，应在 `RSSReader/backend/` 下至少运行：

```bash
cargo check
cargo test
```

完整应用修改后，应按最终 Tauri 配置在应用根目录或前端目录下运行：

```bash
npm run tauri dev
```

具体命令以后以 package.json 和 README.md 为准。

## 10. 重构规则

当出现以下情况时，应创建 refactor Issue：

- 单个文件过长
- 同类逻辑复制多次
- 命名不一致
- 前端组件包含过多业务逻辑
- Rust Command 过长
- SQL 分散在多个模块
- 错误处理风格不一致
- Agent 引入临时绕过方案并被后续代码复制

重构必须保持功能不变，并说明验证方式。

## 11. 当前项目状态

- 项目处于初始化阶段
- 技术路线已初步确定为 React + TypeScript + Vite + Tauri + Rust + SQLite
- 已完成成员信息收集
- 正在建立项目目录、文档和协作流程
- 尚未完成可运行原型

## 12. 已知问题

- 部分成员 GitHub 使用经验不足
- Rust / Tauri 对团队有学习成本
- RSS 源格式和跨站请求存在复杂性
- AI 生成代码需要人工审核
- 9 人同时参与核心开发可能导致冲突

## 13. Agent 修改本文件的规则

当项目发生以下变化时，应更新本文件：

- 技术栈变化
- 目录结构变化
- 新增重要模块
- 新增关键约束
- 发现重要工程经验
- 某类 Agent 错误反复出现
- GitHub 工作流调整

更新时只记录关键决策和长期有效规则，不记录琐碎过程。
