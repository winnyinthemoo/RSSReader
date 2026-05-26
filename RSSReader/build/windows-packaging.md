# Windows 打包说明

本文档记录当前项目的 Windows 桌面打包入口。实际 Tauri 桌面壳位于 `src-tauri/`，`build/` 目录只保存打包流程、发布说明和验收材料。

## 前置条件

- Windows 10 / 11
- Node.js 20 或更高版本
- Rust stable toolchain
- Microsoft Visual Studio Build Tools 或 Visual Studio，安装 MSVC C++ 构建工具
- WebView2 Runtime

## 首次准备

在 `RSSReader/` 应用目录下安装桌面打包依赖：

```bash
npm install
```

前端依赖仍在 `frontend/` 下单独维护：

```bash
cd frontend
npm install
```

## 本地验证

```bash
npm run frontend:build
cd backend
cargo check
cargo test
```

## 打 Windows 安装包

在 `RSSReader/` 应用目录下运行：

```bash
npm run tauri:build:windows
```

当前配置默认生成 NSIS 安装包。产物位置通常为：

```text
src-tauri/target/release/bundle/nsis/
```

同时也会生成可执行文件：

```text
src-tauri/target/release/rssreader-desktop.exe
```

## 数据目录

打包后的应用会把本地数据库和 AI 自定义资源写入系统应用数据目录，而不是安装目录。

Windows 默认路径类似：

```text
%APPDATA%/com.rssreader.vortex/
```

数据库文件：

```text
vortex.sqlite3
```

## 说明

- 当前阶段是内部测试包，暂未做代码签名。
- 未签名安装包在部分 Windows 环境中可能出现安全提示，这是正常现象。
- macOS 和 Linux 包建议交给 GitHub Actions 在对应系统 runner 上构建。
