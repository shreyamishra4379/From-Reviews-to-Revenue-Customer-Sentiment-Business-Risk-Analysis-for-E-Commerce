@echo off
rem One-click launcher: runs the whole project via run.py
cd /d "%~dp0"
python run.py %*
pause
