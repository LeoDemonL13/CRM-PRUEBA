# Cambios aplicados

## Ubicaciones V2

- Nueva nomenclatura final `RR-Z-PC`.
- Rack limitado a `01–20`.
- Zona numérica positiva.
- Piso por letra, con `A` como nivel superior.
- Consecutivo positivo por material dentro de cada rack, zona y piso.
- Generador de estructuras por intervalos de rack, zona y piso.
- Capacidad configurable de consecutivos para cada estructura base.
- Vista de posiciones libres y ocupadas.
- Bloqueo de códigos finales repetidos en la interfaz.
- Validación durante asignación individual e importación masiva.
- Actualización del escáner y manuales internos.
- Incorporación de la nueva imagen de referencia.

## Seguridad

- Protección de `crm_asignar_rol_por_correo` para que solo un administrador activo o `service_role` pueda asignar roles.
- Inclusión consistente de `rh` y `finanzas` en los roles válidos.
- Políticas RLS por perfiles para módulos que tenían reglas abiertas.
- Verificador SQL actualizado.

## Migración

- Instalación en dos etapas: compatibilidad temporal y validación estricta posterior.
- Vistas para encontrar estructuras y materiales pendientes.
- Plantilla SQL para reubicar materiales de forma masiva y validada.

## Validación técnica

- 74 archivos HTML auditados.
- JavaScript externo sin errores de sintaxis.
- JavaScript embebido sin errores de sintaxis.
- Sin referencias locales faltantes.
- Sin IDs HTML duplicados.
