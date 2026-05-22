# 2026-05-22 Agent 工作记录：运行脚本

- 日期：2026-05-22
- 负责人：Codex
- 使用工具：PowerShell、apply_patch、npm
- 对应 Issue / PR：暂无
- 任务目标：在 `RSSReader/scripts/` 下建立项目常用运行命令。
- 关键 Prompt 摘要：用户要求在 scripts 下建立运行命令。
- Agent 修改内容摘要：
  - 新增 Windows `.cmd` 脚本：前端安装、开发、构建、预览、后端测试、完整检查。
  - 新增 macOS / Linux `.sh` 脚本：前端安装、开发、构建、预览、后端测试、完整检查。
  - 补充后端开发服务与一键开发脚本：`backend-dev`、`dev-all`。
  - 新增 `RSSReader/scripts/README.md` 说明脚本用法。
- 人工检查结果：待人工检查。
- 是否运行测试：已运行 `RSSReader/scripts/frontend-build.cmd`，前端构建通过。
- 未解决问题：当前环境未安装 Cargo，因此未运行后端测试脚本。
