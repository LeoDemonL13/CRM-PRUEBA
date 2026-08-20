$ErrorActionPreference = 'Stop'
$projectRef = 'cuxnzqbszzrfnrinxbdp'
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host 'No se encontró Supabase CLI. Instálalo y vuelve a ejecutar este archivo.' -ForegroundColor Yellow
    Write-Host 'https://supabase.com/docs/guides/local-development/cli/getting-started'
    exit 1
}
Write-Host 'Si Supabase solicita inicio de sesión, completa el acceso en el navegador.' -ForegroundColor Cyan
supabase login
supabase functions deploy rh-enviar-nomina-whatsapp --project-ref $projectRef --no-verify-jwt --use-api
supabase functions deploy contactar-proveedor --project-ref $projectRef --no-verify-jwt --use-api
supabase functions deploy sky-transcribir --project-ref $projectRef --use-api
supabase functions deploy skill-enviar-minuta --project-ref $projectRef --use-api
supabase functions deploy enviar-solicitud-proveedor --project-ref $projectRef --use-api
Write-Host 'Funciones desplegadas. Regresa al CRM, actualiza la página y prueba Skill, reuniones, Chat, correo y WhatsApp.' -ForegroundColor Green
