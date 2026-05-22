@echo off
setlocal

call "%~dp0frontend-build.cmd"
if errorlevel 1 exit /b 1

call "%~dp0backend-check.cmd"
if errorlevel 1 exit /b 1
