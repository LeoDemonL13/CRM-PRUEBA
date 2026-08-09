# Configurar Sky Voz avanzada

Sky V21 tiene dos motores de voz:

1. Reconocimiento integrado del navegador.
2. Sky Voz avanzada, que graba únicamente la consulta mientras mantienes Sky escuchando y la envía a una Supabase Edge Function para transcribirla.

Sky selecciona automáticamente el segundo motor cuando la función está desplegada y configurada. Así el CRM deja de depender del servicio de reconocimiento de voz del navegador que puede devolver el error `network`.

## 1. Requisito

Necesitas una clave de OpenAI API guardada como secreto del servidor. Nunca la escribas en los archivos HTML o JavaScript del CRM.

## 2. Desplegar la función

La función está incluida en:

`supabase/functions/sky-transcribir/index.ts`

Desde la carpeta del proyecto, con Supabase CLI autenticado y enlazado al proyecto:

```bash
supabase functions deploy sky-transcribir
```

## 3. Guardar la clave en Supabase

```bash
supabase secrets set OPENAI_API_KEY="TU_CLAVE"
```

Opcionalmente puedes definir el modelo de transcripción:

```bash
supabase secrets set SKY_TRANSCRIBE_MODEL="gpt-4o-mini-transcribe"
```

No es necesario cambiar el frontend después de hacer esto.

## 4. Probar

1. Inicia sesión en el CRM.
2. Abre Sky.
3. La línea de estado debe mostrar `Voz · avanzada` cuando el servicio esté disponible.
4. Pulsa el micrófono.
5. Habla normalmente.
6. Sky detectará una pausa, detendrá la grabación, transcribirá la frase y ejecutará la consulta.

El cuadro de texto se limpia al iniciar cada nueva consulta por micrófono.

## 5. Si no configuras la función

Sky seguirá intentando usar el reconocimiento integrado del navegador. Las consultas escritas siempre continúan funcionando.

## Seguridad

La Edge Function exige una sesión autenticada de Supabase. La clave de OpenAI permanece en los secretos de Supabase y nunca llega al navegador del usuario.
