# RSSReader
A web implementation of an RSS reader with AI

## Team Members
| 序号 | 姓名   | GitHub 账号       | 分工 |
| ---- | ------ | ---------------- | ---- |
| 1    | 章涵   | winnyinthemoo    | 待定 |
| 2    | 沈丁   | SShending        | 待定 |
| 3    | 陈婧   | paradise-o       | 待定 |
| 4    | 王诗雨 | AkanthaWang      | 待定 |
| 5    | 王妍匀 | qiaomaEva        | 待定 |
| 6    | 常苗韦 | CMW-888          | 待定 |
| 7    | 张滨   | zb1nn            | 待定 |
| 8    | 韩威如 | RuGuoH           | 待定 |
| 9    | 施曼丽 | ManliSHI         | 待定 |

## 目录说明
| 目录             | 作用                      |
| -------------- | ----------------------- |
| `.github/`     | GitHub Issue、PR、工作流配置   |
| `docs/`        | 项目文档、Agent 留痕、会议记录、技术决策 |
| `samples/`     | RSS / OPML 测试样例         |
| `screenshots/` | 项目截图和演示素材               |
| `scripts/`     | 辅助脚本                    |
| `src/`         | React + TypeScript 前端代码 |
| `src-tauri/`   | Tauri + Rust 后端代码       |
| `tests/`       | 测试用例和测试数据               |

## 分工
| 角色               | 人数 | 主要职责                                |
| ---------------- | -: | ----------------------------------- |
| 项目统筹 / GitHub 管理 |  1 | 项目计划、Issue 拆分、PR 审核、汇报统筹            |
| 前端核心开发           |  2 | React 页面、三栏布局、文章列表、阅读器 UI           |
| Rust 后端核心开发      |  2 | Tauri Commands、RSS 抓取解析、SQLite、OPML |
| UI/UX 与产品体验      |  1 | Mercury 界面拆解、设计规范、交互验收              |
| 数据与测试            |  1 | 测试 RSS 源、OPML 样例、功能测试、bug 记录        |
| AI 功能与模型中立调研     |  1 | Provider 配置、AI 摘要/翻译方案、Prompt 模板    |
| 文档与演示            |  1 | Agent Logs、用户手册、会议记录、汇报材料           |

## 阶段计划
| 阶段      | 目标             | 主要产出                           |
| ------- | -------------- | ------------------------------ |
| Phase 0 | 产品拆解与项目初始化     | README、INIT、AGENTS、PLAN、目录结构   |
| Phase 1 | 项目脚手架与基础架构     | React + Tauri 可运行原型、SQLite 初始化 |
| Phase 2 | RSS Reader MVP | 添加 Feed、刷新、文章列表、阅读器、本地存储       |
| Phase 3 | 体验完善           | OPML、收藏、搜索、标签、内容清洗             |
| Phase 4 | AI 功能与项目收尾     | AI 摘要、测试文档、用户手册、演示材料           |

## 协作流程
Issue -> Branch -> 开发 -> Commit -> Push -> Pull Request -> Review -> Merge
