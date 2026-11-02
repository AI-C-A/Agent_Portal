@echo off
cd /d "%~dp0"
where node 1>NUL 2>NUL
if errorlevel 1 (
  echo [Agent Portal] Node.js 18+ is required. https://nodejs.org
  pause
  exit /b 1
)
node server.mjs --open
pause
