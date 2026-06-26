# INIT.md

## 项目名称

Vortex（仓库名 RSSReader）

## 目标

实现一个本地优先、无需登录、跨平台运行的桌面 RSS Reader，复刻 Mercury 的核心阅读体验，并在 GitHub 中完整记录团队协作与 Coding Agent 使用过程。

截至 2026-06-26，项目开发主体已经基本完成，当前进入 `0.3.0` alpha 版本的最终验收和演示准备阶段。

## 项目背景

本项目建立团队协作仓库，持续记录成员信息、项目分工、项目计划、开发记录、文档资料与协作过程。

我们参考的产品是 Mercury。Mercury 是一个本地优先的 RSS Reader，具有订阅源管理、文章阅读、OPML、内容清洗、AI 摘要、翻译、标签等功能。我们的目标不是逐行复刻 Mercury 的源码，而是在理解其产品体验和架构思想的基础上，用 Web + Rust + Tauri 技术栈实现一个跨平台桌面版本。

## 核心约束

1. 产品体验：界面应简洁、清晰、易用，优先保证稳定的阅读流程。
2. 本地优先：无需注册登录，不主动采集用户数据。
3. 平台中立：目标支持 Windows / macOS，Linux 作为后续扩展验证。
4. 大模型中立：AI 功能支持 OpenAI-compatible API，不绑定单一模型服务。
5. Coding Agent 留痕：使用 AI 辅助开发时，需要记录关键 Prompt、产出、人工审核和验证结果。
6. 团队协同留痕：通过 Issue、Branch、Commit、Pull Request、Release 记录协作过程。
7. 小步开发：每个阶段都应保持项目可运行、可验证。

## 参考产品范围

### Mercury 中值得参考的核心功能

- Feed / OPML 解析
- Feed 同步与文章内容呈现
- Reader 阅读视图
- 内容清洗与阅读样式
- AI 摘要
- AI 翻译
- 标签系统
- 本地数据存储
- LLM Provider 配置
- 使用记录与调试信息

## 本项目功能范围

### P0：必须完成（已完成）

- 添加 RSS / Atom 订阅源
- 拉取并解析订阅源
- 展示订阅源列表
- 展示文章列表
- 展示文章阅读视图
- 保存订阅源、文章、已读状态到本地 SQLite
- 支持手动刷新订阅源
- 提供基础错误提示和加载状态
- 完成 GitHub 协作留痕和 Agent 使用留痕

### P1：建议完成（已完成主体）

- OPML 导入 / 导出
- 收藏文章
- 搜索文章
- 标签管理
- 阅读器内容清洗
- 基础设置页
- 用户使用文档

### P2：加分功能（已完成主体）

- AI 文章摘要
- AI 翻译
- AI 标签建议
- LLM Provider 设置
- LLM 调用记录或用量统计
- 导出单篇文章或文摘 / 笔记

## 暂不考虑的功能

- 用户账号系统
- 云同步
- 订阅推荐算法
- 多用户权限管理
- 服务端数据库
- 主动上传用户阅读数据
- 正式商业分发所需的 macOS notarization 和完整 Linux 支持

## 技术选型

- 前端：React 19 + TypeScript + Vite 7
- 前端 UI 与阅读渲染：CSS、lucide-react、react-markdown、remark-gfm、rehype-raw、turndown
- 桌面框架：Tauri 2
- 后端：Rust 业务 crate + Tauri Commands
- 本地数据库：SQLite
- RSS 解析：feed-rs
- HTTP 请求：reqwest
- SQLite 访问：rusqlite bundled
- 数据序列化：serde / serde_json / serde_yaml
- HTML 清洗：ammonia
- 正文抽取辅助：readability
- API Key 存储：keyring（系统凭据管理器 / macOS Keychain）
- AI Provider：OpenAI-compatible Chat Completions API

## 架构原则

1. 前后端职责清晰：前端负责 UI 和交互，后端负责 RSS、数据库、Reader、AI 调用等本地能力。
2. 通过 Tauri Commands 定义桌面端前后端通信接口；普通浏览器开发模式通过本地 REST dev server 辅助调试。
3. 数据模型优先稳定，避免 UI 直接操作数据库。
4. 每个功能模块尽量高内聚、低耦合。
5. 所有关键技术决策记录到 docs、agent logs 或专项说明文档中。
6. 每个阶段完成后更新 PLAN.md 和 AGENTS.md。

## 当前状态

- GitHub 仓库已建立，README、Agent logs、Issue、PR 和 Release 记录已经形成完整协作链路。
- 项目版本已推进到 `0.3.0`。
- Windows 最新测试包为 `v0.3.0-alpha.1`。
- macOS 最新测试包为 `v0.3.0-macos-alpha.1`，支持 Apple Silicon / arm64，使用 ad-hoc 签名。
- RSS 阅读、Reader、OPML、标签、笔记、AI 摘要、AI 翻译、AI 标签建议、用量统计、keyring、安装包构建等主体功能已经完成。
- 当前工作重点从功能开发转向最终验收、演示材料、少量遗留 Issue 说明和文档收尾。

## 已知风险

1. 原始网页视图受目标网站 iframe / CSP / 网络限制影响，部分网站无法内嵌显示。
2. Summary Prompt 输出质量仍可继续打磨。
3. macOS 包为 ad-hoc 签名且未 notarize，下载后可能需要按 README 说明解除 quarantine。
4. Linux 与 Intel Mac 尚未作为正式验收平台。
5. AI 功能依赖用户配置的 Provider、API Key、模型能力和网络环境。
6. Vite chunk size warning 尚未处理，但不阻塞当前验收。
7. 最终阶段如果继续大规模改动，可能重新引入性能或 UI 回归。

## 应对策略

1. 最终阶段不再扩大功能范围，只修阻断演示或破坏核心流程的问题。
2. 对 #1、#4 等遗留 Issue 做明确优先级判断；无法在验收前解决的，写入最终风险说明。
3. Windows 和 macOS 安装包都做 smoke test，记录测试环境、版本和结果。
4. 继续保持 Agent log，确保最终文档、修复和验收过程可追踪。
5. 保持 README、PLAN、AGENTS、INIT 与 Release 状态一致，减少汇报时的信息冲突。
