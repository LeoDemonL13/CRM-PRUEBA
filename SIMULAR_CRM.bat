@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js en PATH.
  echo Instala Node.js o abre una terminal donde el comando node funcione.
  echo.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5500/login"
echo Iniciando Nexus Obsidian CRM en modo local...
echo.
node servidor-local-crm.js
endlocal
