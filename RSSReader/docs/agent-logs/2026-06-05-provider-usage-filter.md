# 2026-06-05 Provider Usage Filter

- 日期：2026-06-05
- 负责人：Codex
- 使用工具：终端、apply_patch
- 对应 Issue / PR：未指定

## 任务目标

修复 Model Settings 中 Providers 页面右侧 usage 小卡片没有按当前 provider 区分的问题。

## 关键 Prompt 摘要

用户反馈 Providers 页面右侧上方小卡片对所有 providers 都显示总量，而不是当前 provider 的用量。

## Agent 修改内容摘要

- `AiSettingsPage` 在 Providers tab 加载 usage report 时传入 `selectedProviderId`。
- `ProvidersTab` 的 `UsageSummary` 接收当前 provider 的 `rowKey`，确保 Requests、Tokens、Today、Daily avg 和折线图按 provider 过滤。

## 人工检查结果

- 已确认后端 usage report 已支持 `dimension=provider&key=<providerId>`，本次只需修正前端传参。

## 是否运行测试

- `RSSReader/frontend`: `npm run build` 通过。

## 未解决问题

- 未启动完整应用做点击验收。
