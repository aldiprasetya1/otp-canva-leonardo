@echo off
title OTP LEONARDO + Cloudflare Tunnel
color 0B
echo ==========================================================
echo               🚀 MENJALANKAN OTP LEONARDO
echo            Online via Cloudflare Tunnel
echo ==========================================================
echo.
cd /d "%~dp0"

echo [1/2] Menjalankan Server Lokal (Port 8080)...
start "OTP-Node-Server" /min node server.js

echo [2/2] Menghubungkan Cloudflare Tunnel ke otpleo.rahmatpremium.cloud...
echo.
echo ==========================================================
echo   Website Aktif di : https://otpleo.rahmatpremium.cloud
echo   (Biarkan jendela ini tetap terbuka agar web tetap online)
echo ==========================================================
echo.

cloudflared.exe tunnel --protocol http2 run --token eyJhIjoiNzkwYTY1ZTg1MjMzYmFlYWQ3MGZjMTdjNjk1ZmJlODMiLCJ0IjoiZmI3YTcyZDUtMGExNS00YjhiLWFiZTctYWZlZjlhOTY3MGY3IiwicyI6Ik5ETmtNR1EwWm1VdE9ERTBZeTAwWXpRMkxUaG1ZVEF0TVRsa05USm1ZalZqT0RjeiJ9

pause
