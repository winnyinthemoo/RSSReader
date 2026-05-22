# Scripts

`scripts/` 保存项目常用运行命令。Windows 优先使用 `.cmd`，macOS / Linux 可使用 `.sh`。

## Frontend

```bash
scripts/frontend-install.cmd
scripts/frontend-dev.cmd
scripts/frontend-build.cmd
scripts/frontend-preview.cmd
```

对应 macOS / Linux：

```bash
sh scripts/frontend-install.sh
sh scripts/frontend-dev.sh
sh scripts/frontend-build.sh
sh scripts/frontend-preview.sh
```

## Backend

```bash
scripts/backend-dev.cmd
scripts/backend-check.cmd
scripts/backend-test.cmd
```

对应 macOS / Linux：

```bash
sh scripts/backend-dev.sh
sh scripts/backend-check.sh
sh scripts/backend-test.sh
```

后端开发服务默认监听：

```text
http://127.0.0.1:5181
```

前端在普通浏览器开发环境会请求这个地址；在 Tauri 环境中会优先调用 Tauri Commands。

## Dev All

Windows 可用：

```bash
scripts/dev-all.cmd
```

macOS / Linux 可用：

```bash
sh scripts/dev-all.sh
```

## Full Check

```bash
scripts/check-all.cmd
```

对应 macOS / Linux：

```bash
sh scripts/check-all.sh
```

当前后端脚本需要本机已安装 Rust / Cargo。Windows 下脚本会自动尝试使用 `%USERPROFILE%\.cargo\bin\cargo.exe`。

`backend-check` 只做类型检查和测试代码检查，适合当前初始化阶段的日常验证。`backend-test` 会链接并运行测试，在 Windows MSVC toolchain 下需要 Visual Studio Build Tools 的 C++ 工具链和 Windows SDK。

如果出现 `link.exe not found`，请确认已安装 Visual Studio Build Tools 的 C++ 工具链。Windows 脚本会通过 `setup-msvc-env.cmd` 自动加入常见的 MSVC `link.exe` 路径。

如果后续出现 `kernel32.lib`、`ucrt.lib` 等库缺失，则需要在 Visual Studio Installer 中补装 Windows SDK。
