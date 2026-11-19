@echo off
title Local RAG Backend (FastAPI)
echo Starting Local RAG FastAPI Backend...

REM Check if .venv_win exists, otherwise fallback to .venv or python
if exist ".venv_win\Scripts\python.exe" (
    set PYTHON_EXE=.venv_win\Scripts\python.exe
) else if exist ".venv\Scripts\python.exe" (
    set PYTHON_EXE=.venv\Scripts\python.exe
) else (
    set PYTHON_EXE=python
)

%PYTHON_EXE% -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
