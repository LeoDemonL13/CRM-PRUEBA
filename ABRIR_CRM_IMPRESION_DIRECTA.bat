@echo off
setlocal
set "CRM_URL=https://crm.skilledmx.cloud"
set "PROFILE=%LOCALAPPDATA%\SkilledCRM\ImpresionDirecta"
set "BRAVE64=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
set "BRAVE32=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
set "CHROME64=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME32=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "BROWSER="
if exist "%BRAVE64%" set "BROWSER=%BRAVE64%"
if not defined BROWSER if exist "%BRAVE32%" set "BROWSER=%BRAVE32%"
if not defined BROWSER if exist "%CHROME64%" set "BROWSER=%CHROME64%"
if not defined BROWSER if exist "%CHROME32%" set "BROWSER=%CHROME32%"
if not defined BROWSER (
    echo No se encontro Brave ni Google Chrome.
    pause
    exit /b 1
)
start "Skilled CRM" "%BROWSER%" --user-data-dir="%PROFILE%" --kiosk --kiosk-printing --no-first-run --no-default-browser-check --disable-session-crashed-bubble "%CRM_URL%"
endlocal
