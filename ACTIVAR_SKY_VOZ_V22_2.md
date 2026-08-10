# Activar Sky Voz avanzada V22.2

El mensaje "Sky Voz avanzada todavía no está configurada en el servidor" significa que el navegador sí puede abrir el micrófono, pero el CRM no tiene todavía un servicio de transcripción disponible cuando el reconocimiento integrado del navegador falla.

Sky V22.2 usa esta ruta:

Micrófono -> navegador -> si el navegador no transcribe -> Supabase Edge Function `sky-transcribir` -> servicio de transcripción -> texto -> Sky -> consulta del CRM.

La clave del servicio de transcripción se guarda únicamente en Supabase. No debe colocarse en HTML, JavaScript, GitHub ni Cloudflare Pages.

## Método recomendado: Supabase Dashboard

### 1. Abrir Edge Functions

1. Entra a tu proyecto de Supabase.
2. En el menú izquierdo abre **Edge Functions**.
3. Pulsa **Deploy a new function**.
4. Selecciona **Via Editor**.
5. Usa exactamente este nombre:

`sky-transcribir`

### 2. Copiar el código

En este paquete encontrarás:

`supabase/functions/sky-transcribir/index.ts`

Copia todo el contenido de ese archivo y reemplaza el contenido del editor de Supabase.

Pulsa **Deploy function**.

### 3. Configurar el secreto

En Supabase abre la administración de **Edge Function Secrets**.

Crea este secreto:

`OPENAI_API_KEY`

Como valor usa una clave válida de OpenAI API.

No escribas esa clave en el CRM ni en GitHub.

Opcionalmente puedes crear:

`SKY_TRANSCRIBE_MODEL`

Valor recomendado para V22.2:

`gpt-4o-mini-transcribe-2025-12-15`

Si no creas ese segundo secreto, la función ya usa ese modelo como valor predeterminado.

No necesitas volver a desplegar la función después de modificar los secretos.

### 4. Probar desde el CRM

1. Publica el frontend V22.2 en Cloudflare Pages.
2. Abre el CRM e inicia sesión.
3. Abre Sky.
4. Pulsa el micrófono.
5. Si el reconocimiento del navegador falla, Sky debe cambiar automáticamente a **Voz avanzada**.

Puedes verificar el estado desde la consola del navegador con:

`await window.SkilledDB.skyTranscriptionStatus()`

El resultado correcto debe incluir valores equivalentes a:

- `disponible: true`
- `configurado: true`
- `codigo: "ready"`
- `version: "22.2"`

## Método alternativo: Supabase CLI

Desde una carpeta que contenga `supabase/functions/sky-transcribir/index.ts`:

`npx supabase login`

`npx supabase functions deploy sky-transcribir --project-ref cuxnzqbszzrfnrinxbdp`

Después configura el secreto:

`npx supabase secrets set OPENAI_API_KEY="TU_CLAVE" --project-ref cuxnzqbszzrfnrinxbdp`

Y opcionalmente:

`npx supabase secrets set SKY_TRANSCRIBE_MODEL="gpt-4o-mini-transcribe-2025-12-15" --project-ref cuxnzqbszzrfnrinxbdp`

## Diagnóstico rápido

### "La función sky-transcribir todavía no está desplegada"

La Edge Function no existe todavía o se desplegó con otro nombre. Debe llamarse exactamente `sky-transcribir`.

### "Falta configurar OPENAI_API_KEY"

La función ya existe, pero falta el secreto del servidor.

### "La sesión no pudo autorizar el servicio"

Cierra sesión en el CRM, vuelve a iniciar y prueba otra vez. La función requiere una sesión válida de Supabase.

### Brave no transcribe

Brave puede fallar con el motor `SpeechRecognition` del navegador. Esto no impide usar Sky Voz avanzada. Una vez desplegada y configurada la Edge Function, Sky utiliza el audio grabado por el micrófono y lo transcribe desde el servidor.

## Seguridad

- La clave de OpenAI no se guarda en Cloudflare Pages.
- La clave no se entrega al navegador.
- La función exige una sesión autenticada de Supabase.
- El audio solo se envía cuando el usuario pulsa el micrófono y realiza una consulta.
- Sky continúa en modo de consulta; no ejecuta movimientos destructivos por voz.
