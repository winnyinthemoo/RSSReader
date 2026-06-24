# 2026-06-23 Reader translation background retry layout

- 日期：2026-06-23
- 负责人：Codex
- 使用工具：Codex shell、PowerShell、cargo、npm
- 对应 Issue / PR：未关联
- 任务目标：修复阅读器翻译任务生命周期、失败段落重试、双语阅读布局、工具栏单行显示，以及摘要语言设置问题。
- 关键 Prompt 摘要：用户反馈翻译中无法中断、切换文章会中止或丢失显示、失败段落需要单独重试、翻译后阅读宽度变化、顶部工具栏换行、翻译语言下拉应移除、摘要未跟随语言设置。
- Agent 修改内容摘要：新增翻译段落重试契约与 Tauri/HTTP command；新增前端翻译任务控制器以保留后台翻译状态；阅读器接入后台任务订阅和取消显示；双语视图为失败段落注入重试按钮；移除阅读器工具栏翻译语言下拉并保持单行；约束阅读器列最小半屏宽度；摘要面板文案跟随应用语言并读取摘要智能体默认设置。
- 人工检查结果：未进行人工产品验收；已通过本地构建和 Rust 检查。
- 是否运行测试：已运行 `npm run frontend:build`、`cargo check`（backend）、`cargo test`（backend）、`cargo check`（src-tauri），并启动 `npm run frontend:dev`。
- 未解决问题：Tauri 后端长耗时翻译任务无法被前端强制杀掉；当前“停止翻译”会立即停止 UI 订阅/显示，已开始的 Rust 任务可能继续写入本地缓存，后续可考虑后端可取消任务注册表。