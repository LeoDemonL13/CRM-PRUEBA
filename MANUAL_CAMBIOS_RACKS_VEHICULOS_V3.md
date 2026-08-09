# CRM Skilled — Cambios de racks, vehículos y herramientas V3

## Cambios incluidos

### Almacenes y ubicaciones
- El generador de racks ya no guarda una ubicación por petición de forma secuencial.
- Las ubicaciones nuevas se insertan por bloques de hasta 250 registros.
- Las ubicaciones ya existentes que no cambiaron se omiten.
- Solo las ubicaciones existentes que sí cambiaron se actualizan, con varias operaciones en paralelo.
- El botón muestra avance real durante la generación.
- Se añadió un administrador visual de racks con botón **Eliminar** por rack.
- Al eliminar un rack, los materiales que estaban dentro quedan con `ubicacion = NULL` para que puedan reubicarse y después se eliminan las zonas/pisos del rack.

### Vehículos
- El botón de edición ahora aparece como **Editar información**.
- Al abrir un vehículo existente, el formulario cambia a modo de edición y el botón final dice **Guardar cambios**.
- Se conserva el estado activo/inactivo al editar; ya no se reactiva involuntariamente una unidad inactiva.
- La vista de asientos usa una silueta aproximada según el tipo de vehículo.
- Hay siluetas para automóvil, pickup/camioneta, van, camión, motocicleta, montacargas, Genny/generador y maquinaria móvil.
- La misma silueta se utiliza al asignar pasajeros durante una salida.

### Estado actual de herramientas
- Las cinco tarjetas numéricas son más compactas.
- En pantallas amplias se muestran las cinco en una misma fila.
- Se conservan adaptaciones para tablet y móvil.

## Error SQL 42703 de PLANTILLA_REUBICACION

`42703` significa `undefined_column` en PostgreSQL.

La plantilla anterior podía fallar si la base todavía no tenía la columna `capacidad_consecutivos`, porque la consultaba directamente. La plantilla V3 ya no depende de esa columna para validar la capacidad: utiliza `ubicaciones_almacen.columnas`, que es compatible con la estructura previa y con la nueva.

Usa el archivo:

`SQL_ACTUALIZADO/PLANTILLA_REUBICACION.sql`

No uses la copia anterior de la plantilla.

## Cómo aplicar esta versión

### Opción recomendada
Reemplaza tu carpeta del CRM por el contenido completo de `CRM_Prueba_Mejorado_V3.zip`, conservando primero una copia de seguridad de la versión que tienes publicada.

### Si solo quieres aplicar el parche
Reemplaza estos archivos:

- `AL.almacenes.html`
- `AL.almacenes.js`
- `AL.vehiculos.html`
- `AL.vehiculos.js`
- `AL.estado-herramientas.html`
- `skilled-supabase.js`
- `SQL_ACTUALIZADO/PLANTILLA_REUBICACION.sql`

Después haz una recarga forzada del navegador con `Ctrl + F5`.

## Prueba rápida del generador de racks

Antes de generar los 20 racks completos, prueba:

- Rack inicial: 1
- Rack final: 2
- Zona inicial: 1
- Zona final: 2
- Piso superior: A
- Piso inferior: C
- Consecutivos: 20

Eso genera 12 combinaciones. Si termina correctamente, puedes ejecutar el rango completo.

El rango 01–20, zonas 1–2 y pisos A–D son 160 combinaciones. En esta versión ya no deben convertirse en 160 peticiones secuenciales.

## Eliminación de racks

En la vista visual de Almacenes aparece **Racks configurados**. Cada rack tiene un botón **Eliminar**.

Al eliminar:
1. El CRM pide confirmación.
2. Los materiales ubicados en ese rack quedan sin ubicación específica.
3. Se eliminan las combinaciones de zona/piso pertenecientes al rack.
4. Los materiales pueden reasignarse posteriormente mediante arrastrar y soltar o mediante la reubicación masiva.

Si Supabase devuelve un error de permisos `42501`, revisa las políticas RLS del perfil de almacén y aplica el archivo `03_seguridad_rls.sql` incluido previamente en `SQL_ACTUALIZADO`.

## Edición de vehículos

En cada tarjeta de vehículo selecciona **Editar información**. Se abre el mismo formulario con todos los datos existentes. Cambia los campos requeridos y selecciona **Guardar cambios**.

No se requiere SQL nuevo para esta función.

## Silueta de asientos

La forma depende del valor escrito en **Tipo de vehículo**. Por ejemplo:

- Pickup / Camioneta → pickup
- Automóvil → automóvil
- Van → carrocería alta
- Camión → cabina/caja
- Motocicleta → forma estrecha
- Montacargas → montacargas
- Genny / Generador móvil → equipo móvil
- Maquinaria móvil → maquinaria

La silueta es una representación funcional aproximada, no una reproducción exacta del modelo o marca. La distribución real sigue controlándose con **Capacidad total de personas** y **Distribución de asientos por fila**.

## Si la plantilla de reubicación todavía muestra 42703

Ejecuta `SQL_ACTUALIZADO/DIAGNOSTICO_UBICACIONES_42703.sql` y revisa el resultado. Deben existir como mínimo:

- `existencias_almacen.material_codigo`
- `existencias_almacen.almacen_id`
- `existencias_almacen.ubicacion`
- `ubicaciones_almacen.almacen_id`
- `ubicaciones_almacen.codigo`
- `ubicaciones_almacen.columnas`

Si alguno no existe, no ejecutes la reubicación hasta corregir el esquema base.
