@echo off
setlocal
set "PORTABLE_NODE=%TEMP%\codex-node-v22.23.2\node-v22.23.2-win-x64"

if exist "%PORTABLE_NODE%\npm.cmd" (
  set "PATH=%PORTABLE_NODE%;%PATH%"
  call "%PORTABLE_NODE%\npm.cmd" run dev -- --host 127.0.0.1
  exit /b %ERRORLEVEL%
)

where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
call npm.cmd run dev -- --host 127.0.0.1
exit /b %ERRORLEVEL%

:missing_node
echo Node.js was not found. Install Node.js 22 or restore the portable runtime.
exit /b 1
