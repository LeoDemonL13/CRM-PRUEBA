# Envío de correos desde Compras

El CRM V20 ya prepara las solicitudes de cotización, plantillas y destinatarios. Para que el botón **Enviar directamente desde el CRM** mande el correo sin abrir Outlook/Gmail, debe desplegarse una vez la Edge Function incluida en:

`supabase/functions/enviar-solicitud-proveedor/index.ts`

## Variables privadas necesarias

Configura como secretos de la función:

- `RESEND_API_KEY`: clave del servicio de envío.
- `CO_FROM_EMAIL`: correo remitente autorizado/verificado.
- `CO_FROM_NAME`: nombre visible del remitente (opcional).

Las variables estándar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las proporciona el entorno de Supabase Edge Functions.

## Despliegue

Desde Supabase CLI, con el proyecto enlazado:

```powershell
supabase functions deploy enviar-solicitud-proveedor
supabase secrets set RESEND_API_KEY="TU_CLAVE"
supabase secrets set CO_FROM_EMAIL="compras@tu-dominio.com"
supabase secrets set CO_FROM_NAME="Skilled Proyectos Industriales"
```

El dominio/remitente debe estar verificado en el servicio de correo utilizado. Nunca pongas la clave privada dentro de HTML o JavaScript del CRM.

## Si todavía no se configura el servicio

La cotización y la solicitud al proveedor se guardan de todos modos. El módulo muestra un enlace de correo manual (`mailto:`) para continuar el envío desde el cliente de correo del usuario.
