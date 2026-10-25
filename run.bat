@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8123/"
python -m http.server 8123 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Could not start the server. Is Python installed and on PATH?
  pause
)
