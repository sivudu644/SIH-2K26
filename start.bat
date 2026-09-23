@echo off
title "SIH - Intelligent Data Capture & Schedule-Linking Layer"
echo =========================================================
echo    Starting SIH - Schedule Linking Layer (FastAPI + Vite)
echo =========================================================

echo Starting Backend (FastAPI on port 8000)...
start "SIH Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend (Vite on port 5173)...
start "SIH Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting 3 seconds for services to initialize...
ping 127.0.0.1 -n 4 >nul

echo Opening application in browser...
start http://localhost:5173

echo =========================================================
echo Both services are running in separate windows.
echo Frontend: http://localhost:5173
echo Backend API / Docs: http://127.0.0.1:8000/docs
echo =========================================================

