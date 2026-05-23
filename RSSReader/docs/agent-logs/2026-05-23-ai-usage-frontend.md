# 2026-05-23 Agent 工作记录：AI 模型调用前端展示

- 日期：2026-05-23
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd、Browser 插件
- 对应 Issue / PR：暂无
- 任务目标：调整模型调用前端展示，左侧显示模型调用名称，右侧提供 Provider、Model、Agent 三个选择；模型相关接口出错时不影响前面已加载内容展示。
- 关键 Prompt 摘要：用户要求修改模型调用前端部分，样式为左边模型名称、右边三个选择，并保证模型出错不影响前面部分展示。
- Agent 修改内容摘要：
  - `AiSettingsPage` 初始化数据加载改为 `Promise.allSettled`，Provider、Model、Summary agent、Translation agent 分别处理，单项失败只显示局部错误提示。
  - `AiSettingsPage` 增加 Usage 入口，用于打开模型调用统计页面。
  - `UsageReportPage` 增加 Provider / Model / Agent 三段式选择，默认 Provider，切换失败时保留已有报表展示。
  - `styles.css` 增加模型调用标题与三段式选择控件样式，移动端自动换行。
- 人工检查结果：待人工检查。
- 是否运行测试：
  - 已运行 `npm.cmd run build`，前端构建通过。
  - 已用 Browser 打开本地构建页面并检查 AI 设置弹窗与 Usage 弹窗布局。
- 未解决问题：
  - Usage 后端写入路径仍是骨架，当前表格可能为空。
  - 直接运行 `npm run build` 会被本机 PowerShell 执行策略拦截，已使用 `npm.cmd run build` 验证。
