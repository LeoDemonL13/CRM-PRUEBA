@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js en PATH.
  pause
  exit /b 1
)
where npx >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro npx. Verifica tu instalacion de Node.js/npm.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$ok=(Test-NetConnection 127.0.0.1 -Port 5500 -WarningAction SilentlyContinue).TcpTestSucceeded; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo Iniciando servidor local en una ventana separada...
  start "Nexus Obsidian - Servidor local" cmd /k "cd /d "%~dp0" && node servidor-local-crm.js"
  timeout /t 3 /nobreak >nul
) else (
  echo El servidor local ya esta activo en el puerto 5500.
)
echo.
echo ================================================================
echo  ENLACE TEMPORAL PARA COMPARTIR NEXUS OBSIDIAN
echo ================================================================
echo.
echo En unos segundos aparecera una direccion HTTPS terminada en:
echo   .trycloudflare.com
echo.
echo Copia ESA direccion y compartela con la persona que hara la prueba.
echo Esta ventana debe permanecer abierta mientras usen el enlace.
echo Presiona Ctrl+C para cerrar el enlace publico.
echo.
npx --yes wrangler tunnel quick-start http://127.0.0.1:5500
endlocal
