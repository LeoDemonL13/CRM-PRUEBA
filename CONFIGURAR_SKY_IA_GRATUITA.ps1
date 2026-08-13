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
    if ($supabase) { & $supabase.Source @Arguments } else { & $npx.Source supabase @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "Supabase devolvio un error." }
}
function Read-Secret {
    param([string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
Write-Host "Configuracion de Sky IA V71" -ForegroundColor Cyan
Write-Host "Groq es el proveedor principal recomendado para datos internos del CRM." -ForegroundColor Gray
Write-Host "Gemini y OpenRouter se usan como respaldo para conversacion general, salvo que habilites expresamente el envio de contexto interno." -ForegroundColor Gray
Invoke-Supabase @("login")
$groq = Read-Secret "Groq API Key (Enter si no deseas cambiarla)"
$gemini = Read-Secret "Gemini API Key opcional (Enter para omitir)"
$openrouter = Read-Secret "OpenRouter API Key opcional (Enter para omitir)"
if (-not [string]::IsNullOrWhiteSpace($groq)) { Invoke-Supabase @("secrets","set","GROQ_API_KEY=$groq","--project-ref",$projectRef) }
if (-not [string]::IsNullOrWhiteSpace($gemini)) { Invoke-Supabase @("secrets","set","GEMINI_API_KEY=$gemini","--project-ref",$projectRef) }
if (-not [string]::IsNullOrWhiteSpace($openrouter)) { Invoke-Supabase @("secrets","set","OPENROUTER_API_KEY=$openrouter","--project-ref",$projectRef) }
Invoke-Supabase @("secrets","set","SKY_GROQ_INTENT_MODEL=llama-3.1-8b-instant","SKY_GROQ_CHAT_FAST_MODEL=openai/gpt-oss-20b","SKY_GROQ_CHAT_MODEL=openai/gpt-oss-120b","SKY_GEMINI_INTENT_MODEL=gemini-3.5-flash-lite","SKY_GEMINI_CHAT_FAST_MODEL=gemini-3.5-flash-lite","SKY_GEMINI_CHAT_MODEL=gemini-3.5-flash","SKY_OPENROUTER_MODEL=openrouter/free","SKY_AI_PROVIDER_ORDER=groq,gemini,openrouter","SKY_ALLOW_FREE_FALLBACK_WITH_INTERNAL_DATA=false","--project-ref",$projectRef)
$groq=$null;$gemini=$null;$openrouter=$null
[GC]::Collect()
Invoke-Supabase @("functions","deploy","sky-transcribir","--project-ref",$projectRef,"--use-api")
Write-Host "Sky IA V71 quedo desplegada." -ForegroundColor Green
Write-Host "Los datos internos del CRM permanecen restringidos a Groq por defecto." -ForegroundColor Yellow
