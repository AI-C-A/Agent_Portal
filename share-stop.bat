@echo off
rem Stop sharing the portal: turn off Tailscale Funnel on port 8443 only (other Funnel paths on 443 stay as they are).
set "TS=tailscale"
where tailscale 1>NUL 2>NUL
if errorlevel 1 set "TS=C:\Program Files\Tailscale\tailscale.exe"
"%TS%" funnel --https=8443 off
echo.
"%TS%" funnel status
echo.
echo [Agent Portal] Sharing on port 8443 is off. Close the "AXIS Portal Server" window to stop the server.
pause
