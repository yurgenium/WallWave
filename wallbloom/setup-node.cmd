@echo off
where node >nul 2>nul
if errorlevel 1 (
 if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;%PATH%"
 ) else (
  echo Install Node.js 22 or newer from https://nodejs.org/
  exit /b 1
 )
)
exit /b 0
