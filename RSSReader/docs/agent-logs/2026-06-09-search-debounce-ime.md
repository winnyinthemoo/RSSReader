# 2026-06-09 Agent 工作记录：全局搜索防抖与组合输入保护

- 日期：2026-06-09
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm.cmd
- 对应 Issue / PR：未关联
- 任务目标：解释并修复全局搜索“还没输入完全就开始搜索”的交互问题。
- 关键 Prompt 摘要：用户反馈搜索框在输入未完成时就开始搜索，希望避免输入过程中频繁触发搜索。
- Agent 修改内容摘要：
  - 将全局文章搜索拆成 `articleSearchInput` 和 `articleSearchQuery`：输入框即时显示输入值，列表查询只使用已提交查询词。
  - 为全局搜索增加 450ms 防抖，用户停止输入后再触发 `listArticles`。
  - 增加 IME composition 保护，拼音/中文等组合输入过程中不提交搜索，组合结束后再进入防抖提交。
  - 搜索框处于待提交状态时，右侧计数显示等待状态，避免把旧结果误认为当前输入的结果。
  - Enter / 上下键在输入词尚未提交时会先立即提交当前输入，再用于结果跳转。
- 人工检查结果：已检查 `App`、`ReaderView`、`ReaderToolbar` 搜索状态流向，确认查询请求由防抖后的 `articleSearchQuery` 触发。
- 是否运行测试：已运行 `npm.cmd run build`，通过；Vite 仍提示既有 chunk 超过 500 kB。
- 未解决问题：未做真实浏览器 IME 输入验证；后续可补交互测试覆盖中文输入法场景。
