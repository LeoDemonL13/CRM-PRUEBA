# Activar envío de nómina por WhatsApp

El CRM V24 incluye la Edge Function `rh-enviar-nomina-whatsapp`. Las credenciales privadas **no deben ir en HTML ni JavaScript**.

## 1. Meta / WhatsApp Business Platform

Necesitas una cuenta de WhatsApp Business Platform y un número habilitado en Cloud API. Crea y aprueba una plantilla de mensaje de utilidad para el aviso de nómina. La función espera tres variables en el cuerpo, en este orden:

1. Nombre del colaborador.
2. Nombre del periodo.
3. Total neto.

Ejemplo de texto de la plantilla:

`Hola {{1}}. Tu comprobante correspondiente a {{2}} está disponible. Neto: {{3}}. El documento se adjunta a continuación.`

## 2. Desplegar la Edge Function

En Supabase abre **Edge Functions → Deploy a new function → Via Editor** y crea una función con el nombre exacto:

`rh-enviar-nomina-whatsapp`

Copia el contenido de:

`supabase/functions/rh-enviar-nomina-whatsapp/index.ts`

Después despliega la función.

## 3. Secretos de Supabase

Configura en **Edge Function Secrets**:

- `WHATSAPP_TOKEN`: token de acceso de Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del número de WhatsApp Business.
- `WHATSAPP_GRAPH_VERSION`: versión vigente de Graph API indicada en tu aplicación de Meta, por ejemplo `vXX.X`.
- `WHATSAPP_TEMPLATE_NAME`: nombre exacto de la plantilla aprobada.
- `WHATSAPP_TEMPLATE_LANGUAGE`: código configurado en la plantilla, normalmente `es_MX`.

Supabase ya proporciona las variables de su propio proyecto a las Edge Functions alojadas. Nunca copies `SUPABASE_SERVICE_ROLE_KEY` al frontend.

## 4. Preparar al colaborador

En **RH → Personal → Contacto** captura:

- Teléfono principal.
- WhatsApp para nómina.
- Activa **Usar este número para enviar comprobantes de nómina por WhatsApp**.

Usa un número en formato internacional con código de país.

## 5. Uso

1. Abre **RH → Nómina**.
2. Genera el periodo.
3. Revisa sueldo base, bonos y descuentos.
4. Guarda los ajustes.
5. Pulsa **Comprobante** para revisar el PDF.
6. Pulsa **WhatsApp** para enviar el mensaje y el PDF.

Primero prueba con un número interno antes de habilitar envíos masivos.
