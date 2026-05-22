@echo off
setlocal

where cargo >nul 2>nul
if errorlevel 1 (
  if not exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    echo cargo was not found. Please install Rust before running the backend dev server.
    exit /b 1
  )
)

start "RSSReader Backend" cmd /k ""%~dp0backend-dev.cmd""
start "RSSReader Frontend" cmd /k ""%~dp0frontend-dev.cmd""

echo Backend: http://127.0.0.1:5181
echo Frontend: http://127.0.0.1:5173
