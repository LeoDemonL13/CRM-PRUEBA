$ErrorActionPreference = "Stop"
$Origen = Split-Path -Parent $MyInvocation.MyCommand.Path
$Destino = Join-Path $Origen "CRM_WEB_PRODUCCION"

if (Test-Path $Destino) {
    Remove-Item $Destino -Recurse -Force
}
New-Item -ItemType Directory -Path $Destino | Out-Null

$Patrones = @("*.html", "*.js", "*.css", "*.png", "*.gif")
foreach ($Patron in $Patrones) {
    Get-ChildItem -Path $Origen -Filter $Patron -File | ForEach-Object {
        Copy-Item $_.FullName -Destination $Destino -Force
    }
}

foreach ($Especial in @("_headers", "_redirects")) {
    $Ruta = Join-Path $Origen $Especial
    if (Test-Path $Ruta) {
        Copy-Item $Ruta -Destination $Destino -Force
    }
}

Write-Host "Carpeta web preparada:" -ForegroundColor Green
Write-Host $Destino -ForegroundColor Cyan
Write-Host "No contiene SQL_MAESTRO_CRM.sql, documentos internos ni supabase/functions." -ForegroundColor Yellow
