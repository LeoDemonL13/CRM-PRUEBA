# Manual de puesta en producción — Skilled CRM V107

## Objetivo
Pasar el CRM desde el entorno de prueba a una operación real, manteniendo el frontend separado del backend, con control de versiones, respaldos, permisos y un dominio estable.

## Arquitectura recomendada

- Frontend: Cloudflare Pages.
- Backend: Supabase administrado (Postgres, Auth, RLS, Storage, Realtime y Edge Functions).
- Código fuente: repositorio privado Git.
- Dominio de usuarios: un subdominio corporativo dedicado al CRM.
- API pública del navegador: únicamente la clave publishable/anon de Supabase.
- Secretos y service role: únicamente dentro de Edge Functions o backend seguro.

## Antes de tocar producción

1. Descargar un respaldo de la base actual.
2. Conservar una copia del ZIP que está funcionando.
3. Crear una versión etiquetada en Git.
4. Probar SQL_MAESTRO_CRM.sql primero en una base de ensayo o clon.
5. Confirmar login y permisos de todos los perfiles.
6. Confirmar operaciones críticas: entradas, salidas, compras, cotizaciones, nómina, recepción y checador.

## Importante sobre SQL_MAESTRO_CRM.sql

El SQL Maestro actual es acumulativo y está diseñado para actualizar la base existente del CRM. Al inicio comprueba que ya existan las tablas base principales. Por ello, para crear un proyecto Supabase totalmente vacío no debe asumirse todavía que basta con ejecutar este archivo: primero debe restaurarse/clonarse el esquema base actual o, en una etapa posterior, convertir el Maestro en un instalador bootstrap completo desde cero.

En la V107 se corrigió la referencia errónea a `public.crm_migraciones_aplicadas`. La tabla de control válida es `public.crm_migraciones`.

## Preparar Supabase

1. Elegir el proyecto que será producción.
2. Configurar Authentication y revisar Site URL/Redirect URLs.
3. Revisar RLS de todas las tablas.
4. Ejecutar SQL_MAESTRO_CRM.sql de la versión aprobada.
5. Desplegar las Edge Functions que use esa misma versión.
6. Configurar secretos de Edge Functions desde Supabase; nunca incrustarlos en JavaScript público.
7. Verificar Storage y políticas de buckets si se usan documentos o imágenes.
8. Configurar respaldos adecuados antes de comenzar operación real.

## Preparar el frontend

1. Guardar el CRM en un repositorio privado.
2. Separar al menos las ramas de desarrollo y producción.
3. Conectar producción a Cloudflare Pages mediante integración Git, o mantener Direct Upload si se decide deliberadamente ese flujo.
4. Publicar la misma versión completa del CRM; no mezclar archivos de versiones anteriores.
5. Comprobar el sitio temporal antes de enlazar el dominio final.

## Dominio

1. Elegir un subdominio dedicado, por ejemplo `crm.tudominio.com`.
2. Agregarlo en Cloudflare Pages > Custom domains.
3. Crear/validar el registro DNS indicado por Cloudflare.
4. Esperar a que el dominio quede activo con HTTPS.
5. Configurar ese dominio como Site URL de Supabase Auth y añadir las rutas de redirección necesarias.
6. Opcionalmente redirigir el dominio `pages.dev` al dominio corporativo.

No es obligatorio comprar un dominio personalizado para la API de Supabase. El frontend puede utilizar un dominio corporativo y continuar consumiendo el endpoint estándar `*.supabase.co`. El Custom Domain de Supabase es una opción adicional de marca para la API.

## Seguridad

- No publicar service role ni secret keys en HTML/JS.
- Usar publishable/anon key solamente con RLS correctamente configurado.
- Todas las operaciones privilegiadas deben validar el usuario autenticado dentro de la base o Edge Function.
- Mantener perfiles y permisos bajo prueba automatizada.
- Rotar inmediatamente cualquier secreto que aparezca en una captura, repositorio o archivo público.
- No usar una cuenta administrativa para la operación diaria.

## Respaldos y recuperación

- Producción debe tener una política de respaldo real.
- Guardar también respaldos fuera del proyecto principal.
- Recordar que el respaldo de Postgres no equivale a respaldar los archivos de Storage.
- Probar una restauración antes de confiar en el respaldo.
- Registrar la versión del frontend, SQL Maestro y Edge Functions asociada a cada respaldo importante.

## Flujo recomendado de actualización

1. Desarrollar Vxxx+1 en entorno de desarrollo.
2. Ejecutar pruebas de sintaxis y flujos críticos.
3. Probar SQL Maestro sobre staging/clon.
4. Respaldar producción.
5. Ejecutar el SQL Maestro aprobado.
6. Desplegar Edge Functions.
7. Publicar frontend.
8. Probar login, perfiles, compras, movimientos y módulos afectados.
9. Mantener disponible la versión anterior del frontend para rollback.

## Salida a operación

No recomiendo liberar todos los perfiles el mismo día. Primero usar un piloto pequeño con usuarios reales de Recepción, Compras, Almacén y Dirección. Registrar errores y tiempos de respuesta, corregirlos y después ampliar usuarios.

## Criterios mínimos antes de llamarlo producción

- Cero ciclos de login/redirección.
- Cero pantallas con carga infinita.
- RLS probado por perfil.
- SQL Maestro probado sobre clon antes de producción.
- Edge Functions versionadas y con secretos configurados.
- Compras e inventario con operaciones transaccionales comprobadas.
- Checador con cola offline e idempotencia.
- Backups y restauración probados.
- Logs y alertas revisables.
- Prueba de operación con usuarios reales.

## Checador recomendado

Para el alcance previsto con cámara, posible reconocimiento facial, interfaz local, huella/código y almacenamiento sin Internet, usar Raspberry Pi 5 como computadora principal. Un ESP32-S3 es una excelente opción si el equipo se limita a huella/código, lector, pantalla pequeña, Wi-Fi y sincronización sencilla. También puede usarse como controlador secundario del lector o relé mientras la Raspberry Pi maneja interfaz, cámara y lógica local.
