$ErrorActionPreference = "Stop"
$projectRef = "cuxnzqbszzrfnrinxbdp"
$supabase = Get-Command supabase -ErrorAction SilentlyContinue
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $supabase -and -not $npx) {
    Write-Host "No se encontro Supabase CLI ni npx." -ForegroundColor Red
    exit 1
}
function Invoke-Supabase {
    param([string[]]$Arguments)
    if ($supabase) {
        & $supabase.Source @Arguments
    } else {
        & $npx.Source supabase @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase devolvio un error."
    }
}
Write-Host "Iniciando configuracion segura de Sky Voz e IA..." -ForegroundColor Cyan
Invoke-Supabase @("login")
$secureKey = Read-Host "Pega una NUEVA API Key de Groq" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if ([string]::IsNullOrWhiteSpace($key) -or -not $key.StartsWith("gsk_")) {
    Write-Host "La clave no parece ser una API Key valida de Groq." -ForegroundColor Red
    exit 1
}
Invoke-Supabase @("secrets", "set", "GROQ_API_KEY=$key", "--project-ref", $projectRef)
Invoke-Supabase @("secrets", "set", "SKY_GROQ_INTENT_MODEL=openai/gpt-oss-20b", "SKY_GROQ_CHAT_FAST_MODEL=openai/gpt-oss-20b","SKY_GROQ_CHAT_MODEL=openai/gpt-oss-120b", "--project-ref", $projectRef)
$key = $null
[GC]::Collect()
Invoke-Supabase @("functions", "deploy", "sky-transcribir", "--project-ref", $projectRef, "--use-api")
Write-Host "Sky Voz e inteligencia Groq quedaron desplegadas para el proyecto." -ForegroundColor Green
