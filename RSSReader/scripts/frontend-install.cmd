@echo off
setlocal

cd /d "%~dp0..\frontend" || exit /b 1
call npm.cmd install
