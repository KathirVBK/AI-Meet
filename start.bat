@echo off
echo =====================================================
echo  Starting AImeet Services...
echo =====================================================
echo.
echo [0/3] Cleaning up any existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul
echo [1/3] Starting Python FastAPI (AI Engine) on Port 8000...
start "AImeet - Python AI" cmd /k "cd /d %~dp0 && python api_server.py"
timeout /t 20 /nobreak >nul
echo [2/3] Starting Node.js Backend (Auth + Proxy) on Port 5000...
start "AImeet - Node Backend" cmd /k "cd /d %~dp0backend && node server.js"
timeout /t 2 /nobreak >nul
echo [3/3] Starting React Frontend on Port 3000...
start "AImeet - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo =====================================================
echo  All services started! Open http://localhost:3000
echo =====================================================
echo.
pause
