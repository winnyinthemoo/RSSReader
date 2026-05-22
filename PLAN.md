# PLAN.md

## 项目总目标

实现一个本地优先、无需登录、跨平台运行的 RSS Reader，复刻 Mercury 的核心阅读体验，并完整记录团队协作和 Coding Agent 使用过程。

## 开发原则

1. 文档先行，再写代码。
2. 每个阶段都要有可验证成果。
3. 每个功能通过 Issue 拆分。
4. 每个 PR 尽量小而清晰。
5. main 分支应尽量保持可运行。
6. 功能开发之间穿插重构。
7. Agent 负责执行，人类负责判断、审核和验收。

## 当前项目目录定位

项目应用代码统一放在 `RSSReader/` 目录下：

- `RSSReader/frontend/`：前端，使用 React + TypeScript + Vite，负责页面、交互和状态展示。
- `RSSReader/backend/`：后端，使用 Tauri + Rust，负责本地能力、RSS 解析、文件、AI 调用和数据库访问封装。
- `RSSReader/db/`：数据库，保存 SQLite schema、migration、初始化脚本和数据库说明。
- `RSSReader/shared/`：前后端共享，保存 Command 契约、共享类型和通用常量。
- `RSSReader/resources/`：资源模板，保存 Prompt 模板、文摘模板和其他文本模板。
- `RSSReader/build/`：打包，保存跨平台打包配置、脚本、产物说明和发布材料。
- `RSSReader/docs/`：项目文档、决策记录、Agent 使用记录和过程资料。
- `RSSReader/scripts/`：开发、检查、辅助生成等脚本。
- `RSSReader/tests/`：跨模块测试、集成测试和人工验收材料。
- `RSSReader/samples/`：RSS、OPML、文章内容等样例数据。
- `RSSReader/screenshots/`：界面截图、验收截图和演示素材。

---

# Phase 0：产品拆解与项目初始化

## 目标

明确我们要复刻 Mercury 的哪些功能，建立初始文档、目录结构和 GitHub 协作规则。

## 任务

### Task 0.1：整理成员信息和 README

- 负责人：章涵
- 内容：
  - 在 README.md 中记录成员姓名、GitHub 账号、初步分工
  - 添加项目简介
  - 添加技术栈说明
- 验证：
  - GitHub 首页能正常显示成员信息表格

### Task 0.2：建立项目基础文档

- 负责人：章涵
- 内容：
  - 编写 INIT.md
  - 编写 AGENTS.md
  - 编写 PLAN.md
  - 根据当前目录定位同步 Agent 工作规则和阶段计划
- 验证：
  - 三个文件已提交到 main
  - 小组成员能根据文档理解项目目标和工作方式

### Task 0.3：Mercury 产品拆解

- 负责人：产品与文档组
- 内容：
  - 阅读 Mercury README、截图和功能描述
  - 整理 P0 / P1 / P2 功能范围
  - 输出 `RSSReader/docs/mercury-analysis.md`
- 验证：
  - 文档中说明参考功能、实现范围、不实现范围

### Task 0.4：GitHub 协作设置

- 负责人：章涵
- 内容：
  - 邀请全部组员
  - 建立 Issue 标签
  - 建立 Milestone
  - 建立 PR 模板
  - 说明 Branch / PR 工作流
- 验证：
  - 每位组员能接受邀请并看到仓库
  - 至少创建第一批 Issues

---

# Phase 1：项目脚手架与基础架构

## 目标

搭建 React + TypeScript + Vite + Tauri + Rust + SQLite 的可运行项目骨架。

## 任务

### Task 1.1：初始化前端项目

- 负责人：前端核心开发
- 内容：
  - 初始化 React + TypeScript + Vite
  - 建立 `RSSReader/frontend/src/` 目录结构
  - 实现基础 App 入口
- 影响目录：
  - `RSSReader/frontend/`
- 验证：
  - 在 `RSSReader/frontend/` 下运行 `npm run dev` 可启动
  - 在 `RSSReader/frontend/` 下运行 `npm run build` 可通过

### Task 1.2：初始化 Tauri 后端

- 负责人：后端核心开发
- 内容：
  - 初始化 Tauri
  - 建立 `RSSReader/backend/` 目录结构
  - 实现最小 Rust Command
- 影响目录：
  - `RSSReader/backend/`
  - `RSSReader/shared/`
- 验证：
  - npm run tauri dev 可启动
  - 前端能调用一个测试 Command

### Task 1.3：初始化 SQLite

- 负责人：后端核心开发 + 数据支持
- 内容：
  - 建立 SQLite 连接
  - 设计初始表结构
  - 建立 migration 目录和数据库说明
  - 实现数据库初始化逻辑
- 影响目录：
  - `RSSReader/backend/src/database/`
  - `RSSReader/db/`
- 验证：
  - 应用启动时能创建本地数据库
  - 在 `RSSReader/backend/` 下运行 `cargo test` 通过基础数据库测试

### Task 1.4：实现三栏静态界面

- 负责人：前端核心开发 + UI 设计
- 内容：
  - 左侧 Feed 列表
  - 中间文章列表
  - 右侧 Reader 视图
  - 基础空状态
- 影响目录：
  - `RSSReader/frontend/src/components/`
  - `RSSReader/frontend/src/features/`
- 验证：
  - 页面结构接近 Mercury 的核心阅读布局
  - 提供截图用于汇报

### Task 1.5：建立共享契约与资源模板目录

- 负责人：核心开发 + 文档支持
- 内容：
  - 在 `RSSReader/shared/` 中建立 Command 输入输出类型、共享常量和命名规则说明
  - 在 `RSSReader/resources/` 中建立 Prompt 模板、文章摘要模板和文摘导出模板说明
  - 明确前端、后端、资源模板之间的引用方式
- 影响目录：
  - `RSSReader/shared/`
  - `RSSReader/resources/`
- 验证：
  - 新增 Command 前能先在共享契约中说明输入输出
  - Prompt 和文摘模板不散落在业务代码中

---

# Phase 2：RSS Reader MVP

## 目标

完成从添加订阅源到阅读文章的核心闭环。

## 任务

### Task 2.1：Feed 添加与保存

- 负责人：核心开发
- 内容：
  - 前端提供添加 Feed 入口
  - 后端校验 URL
  - 保存 Feed 到 SQLite
- 影响目录：
  - `RSSReader/frontend/`
  - `RSSReader/backend/`
  - `RSSReader/db/`
  - `RSSReader/shared/`
- 验证：
  - 输入 Feed URL 后，订阅源出现在左侧列表

### Task 2.2：RSS 抓取与解析

- 负责人：核心开发
- 内容：
  - 使用 reqwest 请求 RSS URL
  - 使用 feed-rs 解析 RSS / Atom
  - 转换为统一 Article 数据结构
- 影响目录：
  - `RSSReader/backend/src/feeds/`
  - `RSSReader/shared/`
  - `RSSReader/samples/`
- 验证：
  - 至少支持 3 个真实 RSS 源
  - 解析失败时有明确错误提示

### Task 2.3：文章列表

- 负责人：前端核心开发
- 内容：
  - 显示文章标题、来源、发布时间、已读状态
  - 点击 Feed 后筛选文章
- 影响目录：
  - `RSSReader/frontend/src/features/articles/`
  - `RSSReader/frontend/src/features/feeds/`
  - `RSSReader/shared/`
- 验证：
  - 点击不同 Feed 可切换文章列表

### Task 2.4：阅读器视图

- 负责人：前端核心开发 + Reader 支持
- 内容：
  - 点击文章显示正文
  - 支持基础排版
  - 标记已读
- 影响目录：
  - `RSSReader/frontend/src/features/reader/`
  - `RSSReader/backend/src/articles/`
  - `RSSReader/backend/src/reader/`
  - `RSSReader/shared/`
- 验证：
  - 点击文章后右侧显示内容
  - 重启应用后已读状态保留

### Task 2.5：刷新订阅源

- 负责人：核心开发
- 内容：
  - 手动刷新单个 Feed
  - 更新新文章
  - 避免重复文章
- 影响目录：
  - `RSSReader/frontend/src/features/feeds/`
  - `RSSReader/backend/src/feeds/`
  - `RSSReader/backend/src/articles/`
  - `RSSReader/db/`
- 验证：
  - 重复刷新不会重复插入已有文章

---

# Phase 3：体验完善与扩展功能

## 目标

补齐常见 RSS Reader 功能，提升产品完整度。

## 任务

### Task 3.1：OPML 导入导出

- 内容：
  - 导入 OPML 文件
  - 导出当前订阅源为 OPML
- 影响目录：
  - `RSSReader/frontend/`
  - `RSSReader/backend/`
  - `RSSReader/shared/`
  - `RSSReader/samples/`
- 验证：
  - 可导入样例 OPML
  - 可导出并再次导入

### Task 3.2：收藏与已读管理

- 内容：
  - 收藏文章
  - 筛选未读 / 已收藏
- 影响目录：
  - `RSSReader/frontend/src/features/articles/`
  - `RSSReader/backend/src/articles/`
  - `RSSReader/db/`
- 验证：
  - 状态重启后保留

### Task 3.3：搜索

- 内容：
  - 按标题、来源、正文搜索文章
- 影响目录：
  - `RSSReader/frontend/`
  - `RSSReader/backend/src/articles/`
  - `RSSReader/db/`
- 验证：
  - 搜索结果正确，空结果有提示

### Task 3.4：标签

- 内容：
  - 手动添加标签
  - 按标签筛选
- 影响目录：
  - `RSSReader/frontend/src/features/tags/`
  - `RSSReader/backend/src/tags/`
  - `RSSReader/db/`
- 验证：
  - 标签与文章关系可保存

### Task 3.5：内容清洗

- 内容：
  - 使用 ammonia 清洗 HTML
  - 改善 Reader 显示效果
- 影响目录：
  - `RSSReader/backend/src/reader/`
  - `RSSReader/frontend/src/features/reader/`
- 验证：
  - 不可信 HTML 不会破坏页面结构

---

# Phase 4：AI 功能与项目收尾

## 目标

实现基础 AI 能力，并完成课程验收所需文档、测试、演示材料。

## 任务

### Task 4.1：AI Provider 设置

- 内容：
  - 支持 Base URL
  - 支持 API Key
  - 支持 Model
  - 设置保存在本地
- 影响目录：
  - `RSSReader/frontend/src/features/ai/`
  - `RSSReader/backend/src/ai/`
  - `RSSReader/shared/`
- 验证：
  - 不提交任何真实 API Key
  - 可配置 OpenAI-compatible Provider

### Task 4.2：文章摘要

- 内容：
  - 用户点击后生成文章摘要
  - 摘要保存到 SQLite
- 影响目录：
  - `RSSReader/frontend/src/features/ai/`
  - `RSSReader/backend/src/ai/`
  - `RSSReader/resources/`
  - `RSSReader/db/`
- 验证：
  - 摘要结果可显示、可再次查看

### Task 4.3：用户文档

- 内容：
  - 安装说明
  - 使用说明
  - 功能截图
  - 常见问题
- 影响目录：
  - `README.md`
  - `RSSReader/docs/`
  - `RSSReader/screenshots/`
- 验证：
  - 新成员按 README 可以启动项目

### Task 4.4：测试与验收

- 内容：
  - 整理测试用例
  - 记录测试结果
  - 修复关键 bug
- 影响目录：
  - `RSSReader/tests/`
  - `RSSReader/docs/`
- 验证：
  - 在 `RSSReader/frontend/` 下运行 `npm run build` 通过
  - 在 `RSSReader/backend/` 下运行 `cargo test` 通过
  - 核心功能人工验收通过

### Task 4.5：演示材料

- 内容：
  - 项目介绍
  - 技术架构图
  - 分工说明
  - Agent 使用记录
  - GitHub 协作记录
- 影响目录：
  - `RSSReader/docs/`
  - `RSSReader/screenshots/`
  - `RSSReader/build/`
- 验证：
  - 可用于课程汇报

---

# 阶段性重构安排

每完成一个主要 Phase 后，安排一次 Refactor Issue：

- Phase 1 后：整理目录和命名
- Phase 2 后：拆分过大的 Command / Service / Component
- Phase 3 后：统一错误处理和状态管理
- Phase 4 前：清理无用代码、模板资源和文档

---

# 验收标准

最终项目应满足：

1. 可以运行桌面应用。
2. 可以添加、刷新 RSS Feed。
3. 可以查看文章列表和正文。
4. 可以本地保存数据。
5. 不需要注册登录。
6. 不主动采集用户数据。
7. 有清晰 README、INIT、AGENTS、PLAN。
8. 有 Agent 使用记录。
9. 有团队协作记录。
10. 每位成员在 GitHub 中有可见贡献。
