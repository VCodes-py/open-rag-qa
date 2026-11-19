@echo off
title Local RAG Launcher
echo ============================================================
echo         Starting Local RAG Application (100% Offline)
echo ============================================================
echo.
echo 1. Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "Local RAG - Backend" cmd /k "start_backend.bat"

echo 2. Launching React Vite Frontend on http://localhost:5173 ...
start "Local RAG - Frontend" cmd /k "start_frontend.bat"

echo.
echo Servers are launching in separate windows.
echo Open your browser to: http://localhost:5173
echo.
pause
