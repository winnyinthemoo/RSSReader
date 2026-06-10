# 2026-06-10 v0.2.0 Windows 安装包构建

## 基本信息

- 日期：2026-06-10
- 负责人：Hazel / Codex
- 使用工具：Codex、rg、npm、Tauri CLI、makensis、apply_patch
- 对应 Issue / PR：未指定

## 任务目标

将当前版本号调整为 `0.2.0`，并生成 Windows NSIS 安装包，提交由用户后续手动完成。

## 关键 Prompt 摘要

用户说明本次有较大更新，希望打包为 `v0.2.0`，要求 Agent 帮忙改版本号并打包，用户自行提交。

## Agent 修改内容摘要

- 将根包、前端包、后端 Cargo 包、Tauri Cargo 包与 Tauri 配置中的版本号从 `0.1.0` 更新为 `0.2.0`。
- 同步更新 `package-lock.json`、`frontend/package-lock.json`、`backend/Cargo.lock`、`src-tauri/Cargo.lock` 中本项目包的版本记录。
- 保留工作区已有的 `frontend/package-lock.json` optional package 字段变化与 `src-tauri/Cargo.toml` 依赖变化。

## 构建产物

- `src-tauri/target/release/bundle/nsis/Vortex_0.2.0_x64-setup.exe`
- 大小：5,110,850 bytes
- 生成时间：2026-06-10 15:44:23

## 人工检查结果

- 已确认安装包文件名包含 `0.2.0`。
- 尚未自动运行安装器或安装后的应用。

## 验证

- `npm run tauri:build:windows`：通过。
- 构建过程中前端 `npm run frontend:build`：通过；保留既有 Vite chunk size 警告。
- Rust release 编译：通过。

## 未解决问题

- 首次在沙箱内构建时，Vite/esbuild 解析 `frontend/vite.config.ts` 被目录访问限制拦截；随后经授权在沙箱外重新执行同一构建命令并成功。
- 发版前仍建议人工安装并做基础 smoke test。
