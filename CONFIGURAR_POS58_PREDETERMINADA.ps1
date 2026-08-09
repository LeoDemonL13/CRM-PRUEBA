param(
    [string]$PrinterName = "POS-58 11.3.0.0"
)
$printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $PrinterName }
if (-not $printer) {
    Write-Host "No se encontro la impresora: $PrinterName" -ForegroundColor Red
    Write-Host "Impresoras instaladas:" -ForegroundColor Yellow
    Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name
    exit 1
}
$network = New-Object -ComObject WScript.Network
$network.SetDefaultPrinter($PrinterName)
Write-Host "Impresora predeterminada configurada: $PrinterName" -ForegroundColor Green
