@echo off
cd /d "%~dp0\\backend"
start cmd /k "npm install && npm run start"
cd /d "%~dp0\\frontend"
start cmd /k "npm install && npm run dev"
exit /b 0

