@echo off
echo =====================================================
echo  Starting AImeet Services...
echo =====================================================

echo.
echo [1/3] Starting Python FastAPI (AI Engine) on Port 8000...
start "AImeet - Python AI" cmd /k "cd /d %~dp0 && python api_server.py"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Node.js Backend (Auth + Proxy) on Port 5000...
start "AImeet - Node Backend" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 2 /nobreak >nul

echo [3/3] Starting React Frontend on Port 5173...
start "AImeet - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================
echo  All services started! Open http://localhost:5173
echo =====================================================
pause
