# 2026-06-07 PR21 标签与 AI 功能排查

## 基本信息

- 日期：2026-06-07
- 负责人：Hazel / Codex
- 使用工具：Codex、rg、npm、cargo、apply_patch
- 对应 Issue / PR：PR #21 后续排查

## 任务目标

排查 PR #21 中 Tags v1 多选过滤、Any / All 匹配、后端查询联动、tag 合并、AI tag 闭环、usage 写入、双语 HTML 生成、翻译 fallback 和标题翻译的实现状态，并修复排查中发现的低风险问题。

## 关键 Prompt 摘要

用户反馈最新版本中标签多选筛选和 tag 合并体验疑似不可用，并希望确认 PR #21 声称的 AI tag、usage、双语翻译等能力是否真的实现。

## Agent 修改内容摘要

- 确认多标签 Any / All 的共享类型、前端服务参数、dev server 参数解析、Tauri command 和后端 SQL 查询链路已存在。
- 确认后端已有多标签 Any / All 查询测试覆盖。
- 将 tag merge 从原生 `window.prompt` 改为应用内弹窗，通过下拉框选择目标标签。
- 修复 tag merge 后当前 tag 筛选状态不同步的问题：如果当前筛选包含源标签或目标标签，合并后会协调 selection，触发文章列表重新查询。
- 确认 AI tag 建议、应用写入、usage 记录、后端双语 HTML、标题翻译在代码中已有实现路径。
- 记录 Tauri 打包路径下翻译并未真正流式更新：当前 `ai_start_translation` 只返回最终结果，长文章翻译会缺少中间进度。

## 人工检查结果

- 尚未启动完整 Tauri 应用点击验收。
- tag merge 弹窗和状态刷新已通过 TypeScript/Vite 构建验证。
- 标签 Any / All 后端语义已通过专项测试和全量后端测试验证。

## 验证

- `npm run frontend:build`：通过，有既有 Vite chunk size 警告。
- `backend/cargo test list_articles_filters_multiple_tags_by_match_mode --lib`：通过。
- `backend/cargo test`：通过，23 passed，有既有 dead_code warnings。

## 未解决问题

- Tauri 打包版翻译/摘要仍缺少真正的流式事件推送，长任务会表现为等待时间较长；建议单独建 Issue 处理。
- 本次未重构 AI task queue、超时、取消和并发控制。
- 本次未重新打 Windows 安装包。
