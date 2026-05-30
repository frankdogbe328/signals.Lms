@echo off
echo Starting Signals School LMS...

:: Start PostgreSQL server
"C:\Users\FRANK KOJO DOGBE\OneDrive\Desktop\pgsql\bin\pg_ctl.exe" -D "C:\Users\FRANK KOJO DOGBE\OneDrive\Desktop\pgsql\data" -l "C:\Users\FRANK KOJO DOGBE\OneDrive\Desktop\pgsql\data\logfile.log" start

:: Wait for PostgreSQL to be ready
timeout /t 3 /nobreak > nul

:: Start the app server in a new window
start "Signals App Server" cmd /k "cd /d "C:\Users\FRANK KOJO DOGBE\OneDrive\Desktop\SIGNALS SCHOOL ori\SIGNALS SCHOOL" && node dev-server.js"

:: Wait for app server to start
timeout /t 4 /nobreak > nul

:: Start Cloudflare tunnel in a new window (shows the public URL)
start "Cloudflare Tunnel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000"

echo.
echo Done! Check the Cloudflare Tunnel window for your public URL.
echo Local access: http://localhost:3000/admin/login.html
