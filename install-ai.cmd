@echo off
cd /d "%~dp0"
call setup-node.cmd
if errorlevel 1 (
 pause
 exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
 call pnpm add --save-optional @huggingface/transformers@3.8.1
) else (
 call npm install --no-save @huggingface/transformers@3.8.1
)
pause
