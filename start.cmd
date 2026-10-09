@echo off
cd /d "%~dp0"
if exist "dist\WallWave-Windows-x64.exe" (
 start "WallWave" "dist\WallWave-Windows-x64.exe"
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
if not exist node_modules\sharp (
 where npm >nul 2>nul
 if errorlevel 1 (
  call pnpm install
 ) else (
  call npm install
 )
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
call npm start
pause
