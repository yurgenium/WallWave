@echo off
cd /d "%~dp0"
if exist "..\WallWave.exe" (
 start "WallWave" "..\WallWave.exe"
 exit /b
)
if exist "dist\win-unpacked\WallWave.exe" (
 start "WallWave" "dist\win-unpacked\WallWave.exe"
 exit /b
)
call setup-node.cmd
if errorlevel 1 (
 pause
 exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
 echo Install pnpm first: https://pnpm.io/installation
 pause
 exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
 call pnpm install --frozen-lockfile
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
call pnpm start
pause
