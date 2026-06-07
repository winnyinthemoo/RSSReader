# 2026-06-05 Tags v1 Filtering

- 日期：2026-06-05
- 负责人：Codex
- 使用工具：终端、apply_patch
- 对应 Issue / PR：未指定

## 任务目标

按已确认的 Tags v1 方案补齐标签导航体验：在 Tags 视图支持搜索、排序、多选标签和 Any / All 匹配，并把标签过滤作为文章列表查询维度传到后端。

## 关键 Prompt 摘要

用户要求“Implement the plan”，计划边界为：保留现有阅读列表和 Reader 行为，新增 Tags 独立导航入口能力；多选标签最多 5 个，支持 Any / All；搜索、排序、使用数量展示在 Tags 视图内完成。

## Agent 修改内容摘要

- 扩展共享 `ArticleListFilter`，新增 `tagIds` 与 `tagMatch`。
- 后端文章查询支持多标签 Any / All 过滤，并兼容原单标签 `tagId`。
- 浏览器 dev server 解析 `tagIds` 与 `tagMatch` 查询参数。
- 前端 Tags 侧栏支持搜索、按使用量/名称排序、多选、清空选择和 Any / All 切换。
- 文章列表标题支持多标签筛选状态展示。
- 新增全局标签 rename / merge / delete 基础操作，支持 Tauri command 和浏览器 dev server 路径。
- 新增后端测试覆盖多标签 Any / All 查询语义。
- 对齐 AI 推荐标签 prompt：现有模板已采用高精度 topic tagging 规则，补充运行时 `bodyKind`、`maxTagCount`、`maxNewTagCount` 参数，避免模板变量依赖默认解析。

## 人工检查结果

- 已检查旧的 `selection.tagId` 单标签选择引用，前端主导航已切换为 `tagIds + tagMatch`。
- 未实现独立的全局标签重命名、合并、删除和 alias 管理 UI；当前已有标签保存路径会做名称规范化与同名复用。

## 是否运行测试

- `RSSReader/frontend`: `npm run build` 通过。
- `RSSReader/backend`: `cargo check` 通过，存在既有未使用代码 warning。
- `RSSReader/backend`: `cargo test` 通过，23 个测试通过，存在同样 warning。
- `RSSReader/src-tauri`: `cargo check` 未通过，阻塞在系统依赖 `libdbus-sys`，当前环境缺少 `dbus-1.pc` / `libdbus-1-dev`。

## 未解决问题

- 标签 alias 的完整管理界面仍需单独任务补齐；当前只做名称规范化与基础 rename / merge / delete。
- 未启动完整 Tauri dev 进行人工点击验收。
