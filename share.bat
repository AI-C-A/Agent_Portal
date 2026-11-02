@echo off
rem Share the portal on the internet: start the local server, then open it with Tailscale Funnel on port 8443.
rem The server only serves the portal files (index.html, styles.css, src, fonts). Stop sharing with share-stop.bat.
cd /d "%~dp0"
where node 1>NUL 2>NUL
if errorlevel 1 (
  echo [Agent Portal] Node.js 18+ is required. https://nodejs.org
  pause
  exit /b 1
)
set "TS=tailscale"
where tailscale 1>NUL 2>NUL
if errorlevel 1 set "TS=C:\Program Files\Tailscale\tailscale.exe"
start "AXIS Portal Server" cmd /k node server.mjs
timeout /t 2 /nobreak >NUL
"%TS%" funnel --bg --https=8443 5173
if errorlevel 1 (
  echo [Agent Portal] Tailscale Funnel failed. Check that Tailscale is running and signed in.
  pause
  exit /b 1
)
echo.
"%TS%" funnel status
echo.
echo [Agent Portal] Share the https://...ts.net:8443/ link above. Keep the server window open.
echo [Agent Portal] To stop sharing: share-stop.bat
pause
