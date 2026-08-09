# Manual de aplicación de mejoras — CRM Skilled

## 1. Alcance de esta entrega

Esta versión actualiza la lógica de ubicaciones, agrega parches de seguridad para Supabase y reemplaza el verificador SQL desactualizado.

La nomenclatura vigente queda así:

- **Rack:** `01` a `20`.
- **Zona:** número entero positivo que divide horizontalmente el rack.
- **Piso:** una letra en orden de arriba hacia abajo. `A` es el nivel superior; después siguen `B`, `C`, `D`…
- **Consecutivo:** número entero positivo que identifica a cada material dentro del mismo rack, zona y piso.
- **Código final:** `RR-Z-PC`.

Ejemplos:

- `01-1-A1`
- `01-2-A1`
- `10-2-C5`

La estructura base que se registra en el catálogo de ubicaciones no lleva consecutivo. Por ejemplo, para permitir `01-1-A1` a `01-1-A20`, se registra la estructura base `01-1-A` con capacidad de 20 consecutivos.

## 2. Archivos modificados

- `AL.almacenes.html`
- `AL.almacenes.js`
- `skilled-supabase.js`
- `AL.scanner-universal.js`
- `AL.importar-materiales.html`
- `manual-usuario.html`
- `AL.manual-usuario.html`
- `estructura-ubicaciones.png`

Los parches SQL están dentro de `SQL_ACTUALIZADO`.

## 3. Antes de instalar

1. Haz una copia del proyecto actual.
2. En Supabase abre **Database > Backups** y confirma que existe un respaldo reciente. Si tu plan no incluye respaldo automático, exporta al menos las tablas `ubicaciones_almacen`, `existencias_almacen` y `perfiles_usuario`.
3. No ejecutes `SQL_MAESTRO_CRM.sql` sobre la base productiva. Ese archivo no contiene el esquema base completo y puede entrar en conflicto con módulos posteriores.
4. Prueba primero en una copia o entorno de pruebas.

## 4. Publicar los cambios del código

Reemplaza el proyecto publicado por el contenido de esta carpeta, conservando la misma configuración de Supabase que ya utiliza el CRM.

Los cambios principales son:

- El módulo **Almacenes y ubicaciones** genera racks, zonas y pisos.
- Cada estructura base administra consecutivos libres y ocupados.
- No se permite asignar el mismo código final a dos materiales del mismo almacén.
- La importación masiva valida el nuevo formato y detecta ubicaciones repetidas.
- El escáner muestra la capacidad por consecutivos.
- Los manuales internos muestran la nomenclatura nueva.

## 5. Ejecutar los SQL

Ejecuta cada archivo completo en el **SQL Editor** de Supabase, en este orden:

1. `SQL_ACTUALIZADO/01_ubicaciones_v2.sql`
2. `SQL_ACTUALIZADO/02_seguridad_roles.sql`
3. `SQL_ACTUALIZADO/03_seguridad_rls.sql`
4. `SQL_ACTUALIZADO/04_verificar_crm.sql`

No ejecutes todavía `05_activar_validacion_ubicaciones.sql`.

### Qué hace cada archivo

**01_ubicaciones_v2.sql**

- Agrega rack, zona, piso y capacidad de consecutivos a `ubicaciones_almacen`.
- Normaliza las estructuras que ya tengan formato nuevo.
- Crea funciones y vistas para detectar datos pendientes de migración.
- Todavía permite conservar temporalmente códigos antiguos para poder reorganizar físicamente las gavetas.

**02_seguridad_roles.sql**

- Incluye los roles `rh` y `finanzas` en la restricción de perfiles.
- Impide que un usuario común se asigne privilegios mediante la función RPC.
- Limita la administración de perfiles a administradores activos.

**03_seguridad_rls.sql**

- Sustituye políticas abiertas en herramientas, vehículos, préstamos, ubicaciones pendientes y notificaciones.
- Autoriza lectura y escritura según el perfil de cada usuario.
- Debe probarse con una cuenta de cada rol antes de aplicarlo en producción.

**04_verificar_crm.sql**

- Comprueba tablas, funciones, roles y políticas.
- Cuenta ubicaciones antiguas, nuevas y vacías.
- Detecta códigos finales repetidos.
- Informa si sigue existiendo el bucket de PDF de órdenes de compra.

## 6. Crear la estructura física nueva

En el CRM entra a:

**Almacén > Almacenes y ubicaciones > Administrar ubicaciones**

Después:

1. Selecciona el almacén.
2. Presiona **Generar estructura**.
3. Indica el rack inicial y final. Solo se admiten racks del 1 al 20; el sistema los guarda con dos dígitos.
4. Indica las zonas horizontales.
5. Selecciona el piso superior e inferior. `A` debe corresponder al piso más alto.
6. Indica cuántos consecutivos admite cada combinación.
7. Revisa la vista previa y guarda.

Ejemplo para un rack con dos zonas, tres pisos y diez materiales por sección:

- Racks: `03` a `03`
- Zonas: `1` a `2`
- Pisos: `A` a `C`
- Consecutivos: `10`

El CRM creará las bases:

- `03-1-A`, `03-1-B`, `03-1-C`
- `03-2-A`, `03-2-B`, `03-2-C`

Y permitirá asignar posiciones como `03-1-A1`, `03-1-A2` o `03-2-C10`.

## 7. Reubicar las gavetas y materiales

La reubicación física no puede automatizarse de forma segura porque el sistema no conoce dónde quedará cada gaveta. Debes definir el nuevo código de cada material.

Hay dos métodos.

### Método recomendado: interfaz del CRM

1. Abre el almacén correspondiente.
2. Busca el material sin ubicación o con ubicación anterior.
3. Arrástralo al consecutivo libre correcto.
4. Confirma que el código mostrado coincide con la etiqueta física.
5. Repite hasta terminar cada rack.

Este método bloquea posiciones ocupadas y reduce errores de captura.

### Método masivo: importación de materiales

1. Abre **Importar materiales**.
2. Descarga o utiliza la plantilla del módulo.
3. Escribe en `Ubicación` el código final, por ejemplo `01-1-A1`.
4. Verifica que exista previamente la base `01-1-A` en el almacén seleccionado.
5. Importa el archivo y revisa el reporte de errores.

También se incluye `SQL_ACTUALIZADO/PLANTILLA_REUBICACION.sql` para una migración controlada desde el SQL Editor.

## 8. Consultar pendientes

Ejecuta estas consultas en Supabase:

```sql
select *
from public.vw_ubicaciones_estructura_pendientes_v2
order by almacen_id, codigo, nombre;
```

```sql
select *
from public.vw_materiales_ubicacion_pendiente_v2
order by almacen_id, ubicacion, material_codigo;
```

La primera lista estructuras base que aún no usan `RR-Z-P`. La segunda lista materiales sin ubicación o con formato anterior.

## 9. Activar la validación estricta

Cuando ya no existan códigos antiguos ni códigos finales repetidos:

1. Ejecuta otra vez `04_verificar_crm.sql`.
2. Confirma que `materiales_formato_anterior` sea `0`.
3. Confirma que la consulta de duplicados no devuelva filas.
4. Ejecuta `SQL_ACTUALIZADO/05_activar_validacion_ubicaciones.sql`.

Desde ese momento Supabase rechazará:

- racks fuera de `01` a `20`;
- zonas o consecutivos iguales a cero;
- ubicaciones sin estructura base;
- consecutivos mayores a la capacidad configurada;
- el mismo código final asignado a más de un material del mismo almacén.

## 10. Pruebas obligatorias

Realiza estas pruebas con datos de prueba:

1. Crear `01-1-A` con capacidad 5.
2. Asignar un material a `01-1-A1`.
3. Asignar otro material a `01-1-A2`.
4. Intentar asignar un tercero a `01-1-A1`; debe bloquearse.
5. Intentar usar `21-1-A1`; debe bloquearse.
6. Intentar usar `01-0-A1`; debe bloquearse.
7. Intentar usar `01-1-A6`; debe bloquearse porque la capacidad es 5.
8. Probar importación masiva con dos filas que repitan la misma ubicación; la segunda debe reportarse como error.
9. Probar las cuentas de administrador, jefe de almacén, almacén, compras, RH y finanzas después de aplicar RLS.

## 11. Mejoras que requieren intervención posterior

### SQL maestro completo

No se reemplazó `SQL_MAESTRO_CRM.sql` por un instalador total porque el paquete recibido no contiene el SQL original de varias tablas base. Crear un instalador desde suposiciones podría borrar datos o construir columnas incompatibles. El método seguro es exportar el esquema real de Supabase y consolidarlo después con estos módulos.

Para obtenerlo:

1. Abre Supabase.
2. Exporta únicamente el esquema, sin datos, mediante la herramienta de respaldo o `pg_dump --schema-only`.
3. Conserva también las funciones, disparadores, políticas RLS y objetos de `storage`.
4. Integra los SQL de esta carpeta después de las tablas base.
5. Prueba la instalación en un proyecto Supabase vacío.

### PDF de órdenes de compra bajo demanda

No se eliminó el almacenamiento de PDF en esta entrega porque el flujo actual guarda rutas y nombres que pueden utilizar Compras, Entradas y el historial. Para migrar correctamente se debe:

1. Identificar todas las lecturas de `pdf_url`, `pdf_path` y `pdf_nombre`.
2. Guardar solamente los datos estructurados de la orden.
3. Crear una función única que reconstruya el PDF al consultar o descargar.
4. Mantener compatibilidad temporal con órdenes antiguas.
5. Eliminar los archivos del bucket únicamente después de comprobar la regeneración.

### Notificaciones por usuario

Las políticas quedan restringidas por rol, pero el modelo actual de notificaciones sigue siendo compartido. Para que cada persona tenga su propio estado de leído se necesita una tabla relacionada por `usuario_id` o una tabla `notificaciones_lecturas`.

### Repositorio Git

Antes del siguiente bloque de cambios crea un punto de recuperación:

```bash
git add .
git commit -m "Base estable antes de continuar mejoras CRM"
git tag crm-ubicaciones-v2
```

## 12. Reversión de emergencia

Si la validación estricta causa un problema y todavía no puedes restaurar el respaldo, desactiva temporalmente el disparador:

```sql
drop trigger if exists trg_existencias_almacen_ubicacion_v2
on public.existencias_almacen;
```

Esto no revierte los datos ni las columnas. La recuperación correcta sigue siendo restaurar el respaldo creado antes de la instalación.
