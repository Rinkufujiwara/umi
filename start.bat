@echo off
rem Umi（3D）を開く。サーバーが動いていなければ起動してから、ブラウザで開く
cd /d "%~dp0"
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 8835)).Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Umi server" /min python -m http.server 8835 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
)
start "" http://127.0.0.1:8835/
