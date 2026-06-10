# macOS 打包说明

本文档记录当前项目的 macOS 桌面打包入口。实际 Tauri 桌面壳位于 `src-tauri/`，`build/` 目录只保存打包流程、发布说明和验收材料。

## 前置条件

- macOS，建议 Apple Silicon 机器优先构建 arm64 内测包
- Node.js 20 或更高版本，并包含 npm
- Rust stable toolchain
- Xcode Command Line Tools

检查命令：

```bash
node -v
npm -v
rustc -V
cargo -V
xcode-select -p
```

## 本机临时环境

如果使用项目内 `.tools/` 本地工具链，先在仓库根目录运行：

```bash
export CARGO_HOME="$PWD/.tools/cargo"
export RUSTUP_HOME="$PWD/.tools/rustup"
export PATH="$PWD/.tools/node/bin:$PWD/.tools/cargo/bin:$PATH"
```

## 首次准备

在 `RSSReader/` 应用目录下安装桌面打包依赖：

```bash
npm ci
```

前端依赖仍在 `frontend/` 下单独维护：

```bash
cd frontend
npm ci
```

## 本地验证

```bash
npm run frontend:build
cd backend
cargo check
cargo test
cd ../src-tauri
cargo check
```

完整桌面运行验证：

```bash
npm run tauri:dev
```

## 打 macOS 内测包

在 `RSSReader/` 应用目录下运行：

```bash
npm run tauri:build:mac
```

当前脚本会生成 ad-hoc 签名的 `.app` 和 `.dmg` 内测包：

```bash
tauri build --bundles app,dmg
```

产物位置通常为：

```text
src-tauri/target/release/bundle/macos/Vortex.app
src-tauri/target/release/bundle/dmg/Vortex_0.1.0_aarch64.dmg
```

## 数据目录

打包后的应用会把本地数据库和 AI 自定义资源写入系统应用数据目录，而不是安装目录。

macOS 默认路径类似：

```text
~/Library/Application Support/com.rssreader.vortex/
```

数据库文件：

```text
vortex.sqlite3
```

## 说明

- 当前阶段是内部测试包，使用 ad-hoc 签名，暂未做 Apple Developer ID 签名和 notarization。
- ad-hoc 签名可以避免 app bundle 签名结构异常，但不能消除 Gatekeeper 对互联网下载应用的安全提示。
- 其他 Mac 从 GitHub 下载后如果提示无法打开，可以先把 `Vortex.app` 拖到“应用程序”，再在终端运行：

```bash
xattr -dr com.apple.quarantine /Applications/Vortex.app
```

- `.dmg` 生成依赖 macOS `hdiutil` 创建和挂载临时磁盘镜像。如果在受限沙箱中失败，可以在本机终端或非沙箱权限下重新运行 `npm run tauri:build:mac`。
- 如需分发给更多测试者，后续应补充 Apple Developer ID 签名、notarization 和 stapling 流程。
