@echo off
setlocal

where cargo >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "CARGO=%USERPROFILE%\.cargo\bin\cargo.exe"
  ) else (
    echo cargo was not found. Please install Rust before running the backend dev server.
    exit /b 1
  )
) else (
  set "CARGO=cargo"
)

cd /d "%~dp0..\backend" || exit /b 1
call "%~dp0setup-msvc-env.cmd"
"%CARGO%" run --bin rssreader-backend-dev
