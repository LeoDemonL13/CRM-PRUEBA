# Manual de nube, usuarios, almacenamiento y publicación

Documento de administración para Skilled Proyectos Industriales. Revisado el 7 de agosto de 2026.

## 1. Arquitectura recomendada

Usa **una sola carpeta del CRM, una sola URL y una sola base de datos** para todos los usuarios. No crees una copia por perfil.

- **Frontend:** esta carpeta HTML/CSS/JS en Cloudflare Pages.
- **Backend:** un proyecto de Supabase con Postgres, Authentication, API y Storage.
- **Código:** repositorio privado en GitHub.
- **Acceso:** cada persona inicia sesión con su correo.
- **Permisos:** `perfiles_usuario`, `auth-guard.js`, menú filtrado y políticas RLS.

Flujo de seguridad:

1. Supabase Auth valida correo y contraseña.
2. `perfiles_usuario` entrega el rol y el estado activo.
3. `auth-guard.js` evita abrir páginas no autorizadas.
4. `skilled-sidebar.js` muestra únicamente los apartados permitidos.
5. Las políticas RLS y funciones SQL vuelven a validar cada escritura.

Ocultar botones no sustituye las políticas RLS.

## 2. Roles disponibles

| Rol | Uso |
|---|---|
| `administrador` | Configuración completa y futuras funciones de administración de usuarios. |
| `jefe_almacen` | Responsable operativo: inventario, compras, proyectos, herramientas, vehículos y reportes. |
| `almacen` | Operación diaria de almacén. |
| `compras` | Bajo mínimo, órdenes y recepción. |
| `proyectos` | Planeación, solicitudes, alcance y consulta relacionada. |
| `consulta` | Lectura controlada. |

La cuenta `admin.almacen@skilled.mx` debe tener el rol `jefe_almacen`. Ejecuta `SQL_MAESTRO_CRM.sql` después de crearla en Authentication.

## 3. Preparar Supabase

### Proyecto existente

1. Haz respaldo de base y Storage.
2. Abre SQL Editor.
3. Ejecuta `SQL_MAESTRO_CRM.sql`.
4. Ejecuta `SQL_MAESTRO_CRM.sql`.
5. Ejecuta `SQL_MAESTRO_CRM.sql`.

El instalador es acumulativo e intenta conservar la información existente. Pruébalo primero en un proyecto de prueba cuando sea posible.

### Proyecto nuevo

1. Crea el proyecto.
2. Ejecuta `SQL_MAESTRO_CRM.sql` completo.
3. Crea usuarios en Authentication.
4. Asigna roles.
5. Crea los buckets privados necesarios.
6. Prueba todas las políticas antes de importar datos reales.

## 4. Crear usuarios

1. Supabase → Authentication → Users.
2. Add user.
3. Introduce correo y contraseña temporal.
4. Activa confirmación automática si la política interna lo permite.
5. Ejecuta:

```sql
select public.crm_asignar_rol_por_correo(
  'persona@skilled.mx',
  'almacen',
  true
);
```

6. La persona inicia sesión y completa Mi perfil.
7. Prueba la cuenta en ventana privada.

Para desactivar:

```sql
update public.perfiles_usuario p
set activo=false, updated_at=now()
from auth.users u
where p.id=u.id and lower(u.email)=lower('persona@skilled.mx');
```

## 5. Almacenamiento: cuánto espacio se necesita

Hay dos consumos diferentes:

- **Base de datos:** materiales, movimientos, proyectos, cantidades y relaciones.
- **Storage:** imágenes, PDF, comprobantes, avatares y otros archivos.

Referencias vigentes consultadas en Supabase:

- Free: 1 GB de Storage; máximo global de archivo 50 MB; la base puede entrar en modo solo lectura al superar 500 MB de datos.
- Pro: 100 GB de Storage incluidos y 8 GB de disco por proyecto, con cobro por excedente.

Estas cuotas y precios pueden cambiar. Revisa la página oficial antes de contratar.

### Estimación práctica

Un PDF normal suele ocupar entre 100 KB y 2 MB. Una fotografía sin comprimir puede ocupar varios MB. Para reducir consumo:

- Comprime imágenes a WebP o JPEG antes de subirlas.
- Limita fotografías a aproximadamente 1600 px por lado.
- Guarda una sola copia por orden o movimiento.
- Elimina archivos huérfanos únicamente mediante un proceso auditado.
- No almacenes videos en el mismo proyecto si no son necesarios.

### Buckets sugeridos

- `documentos-compra`
- `comprobantes`
- `herramientas`
- `vehiculos`
- `avatares`

Usa buckets privados y políticas RLS. Nunca coloques `service_role` en HTML o JavaScript.


## 5.1 Dimensionamiento práctico del CRM a 3 años

Para el estado actual del CRM y un uso empresarial de decenas de usuarios, el volumen de datos relacionales no es el principal riesgo; el crecimiento real vendrá de fotografías, documentos, comprobantes, logs, WAL de PostgreSQL y respaldos. Como el CRM está orientado a regenerar recibos/PDF cuando sea posible, el consumo puede mantenerse moderado.

### Mínimo técnico para pruebas / contingencia

- CPU: 4 núcleos / 8 hilos modernos.
- RAM: 8 GB.
- Disco: SSD/NVMe de 256 GB.
- Red: Ethernet gigabit.

Puede arrancar Supabase self-hosted, pero deja poco margen para PostgreSQL, Auth, Storage, API, Docker, sistema operativo y copias locales. No se recomienda como servidor principal a tres años.

### Mínimo recomendado para producción durante 3 años

- CPU: 6 a 8 núcleos modernos.
- RAM: **16 GB**.
- Disco principal: **512 GB NVMe**.
- Respaldo: al menos **1 TB adicional**, separado del disco principal.
- UPS y Ethernet cableado.

Esta es la configuración mínima que conviene comprar si se desea evitar una ampliación temprana. Mantén al menos 25–30 % del NVMe libre para PostgreSQL, actualizaciones, WAL y operaciones de mantenimiento.

### Configuración con margen cómodo

- CPU: 8 núcleos o más.
- RAM: **32 GB**.
- Disco principal: **1 TB NVMe**.
- Respaldo local: **2 TB**.
- Copia externa/off-site adicional.

Con esta configuración hay margen para aumentar usuarios, conservar más imágenes/documentos, ejecutar respaldos, reportes y tareas programadas sin que PostgreSQL compita continuamente por memoria.

### Consumo estimado

Si los tickets y recibos se regeneran y no se guardan como PDF, la base de datos pura probablemente seguirá ocupando una fracción pequeña del disco. Para planear capacidad, reserva aproximadamente:

- Sistema operativo + Docker + imágenes: 40–80 GB.
- PostgreSQL, índices, WAL y crecimiento de datos: 30–80 GB.
- Imágenes y documentos operativos: 50–150 GB, dependiendo de la política de archivos.
- Área temporal y margen de mantenimiento: 50–100 GB.

Por eso **512 GB** es una base razonable aunque los datos iniciales ocupen mucho menos. Los respaldos no deben depender del espacio libre de ese mismo disco.

## 6. Recomendación de plan

Para pruebas pequeñas puede utilizarse Free. Para operación diaria con varios usuarios, PDF, imágenes y respaldo administrado, la opción razonable es iniciar con Supabase Pro y revisar el consumo mensual.

Configura alertas de uso y revisa:

- Database size.
- Storage size.
- Egress.
- Monthly active users.

## 7. ¿Se puede usar una laptop vieja como nube?

Sí, Supabase puede autohospedarse con Docker Compose. Sin embargo, en self-hosting la empresa se hace responsable de:

- Servidor y mantenimiento.
- Actualizaciones de sistema y contenedores.
- Seguridad, firewall y secretos.
- PostgreSQL.
- Backups y recuperación.
- Monitoreo y disponibilidad.
- Escalabilidad.
- HTTPS y dominio.

### Uso recomendado de la laptop

- Entorno de pruebas.
- Servidor de respaldo.
- Laboratorio de capacitación.
- Réplica secundaria no crítica.

No la uses como único servidor productivo sin:

- SSD saludable.
- RAM suficiente para todos los contenedores.
- UPS.
- Ethernet estable.
- Copia externa automática.
- Monitoreo.
- Reemplazo previsto ante falla.
- Administrador responsable.

### Publicar una laptop sin abrir puertos

Cloudflare Tunnel puede publicar una aplicación mediante conexiones salientes de `cloudflared`, sin requerir IP pública ni puertos entrantes. Esto no elimina la obligación de actualizar, respaldar y proteger el servidor.

### Recomendación final

Mantén el CRM de producción en Cloudflare Pages + Supabase administrado. Usa la laptop vieja para pruebas o respaldo. Evalúa self-hosting solo cuando exista una persona responsable de infraestructura y un plan de continuidad.

## 8. Subir el frontend a Cloudflare Pages con GitHub

### GitHub

1. Crea un repositorio privado.
2. Copia el contenido de esta carpeta a la raíz.
3. No subas contraseñas, `service_role`, dumps con datos ni archivos `.env` privados.
4. Usa ramas:
   - `main`: producción.
   - `desarrollo`: pruebas.

### Cloudflare Pages

1. Cloudflare → Workers & Pages.
2. Create application.
3. Pages.
4. Import an existing Git repository.
5. Selecciona el repositorio.
6. Production branch: `main`.
7. Build command: vacío.
8. Build output directory: raíz del proyecto.
9. Deploy.

Cada push a `main` publica automáticamente. Las ramas generan vistas previas.

### Dominio

1. Pages → proyecto → Custom domains.
2. Set up a domain.
3. Introduce `crm.skilledmx.cloud`.
4. Confirma el registro DNS indicado.
5. Espera el certificado HTTPS.

No crees únicamente el CNAME sin asociar primero el dominio desde Pages.

### Supabase Authentication

Configura:

- Site URL: `https://crm.skilledmx.cloud`
- Redirect de producción: `https://crm.skilledmx.cloud/**`
- Redirect local: `http://127.0.0.1:5500/**`

## 9. Backups

### Código

- Repositorio privado.
- Etiquetas o releases para estados estables.
- Copia local cifrada.

### Base de datos

- En Free: exporta regularmente con Supabase CLI `db dump` o `pg_dump`.
- En planes pagados: revisa Database → Backups.
- Para una operación crítica, considera PITR según el costo y la necesidad.

### Storage

El backup de Postgres no restaura los archivos eliminados de Storage. Copia los buckets de manera independiente.

### Regla 3-2-1

- 3 copias.
- 2 medios diferentes.
- 1 copia fuera del sitio principal.

Prueba la restauración. Un archivo de respaldo no probado no garantiza recuperación.

## 10. Seguridad

- Habilita 2FA en GitHub, Supabase y Cloudflare.
- Usa usuarios individuales.
- Desactiva cuentas que ya no se utilicen.
- Revisa RLS antes de producción.
- Mantén `service_role` fuera del navegador.
- Usa únicamente HTTPS.
- Rotar cualquier secreto que haya sido compartido.
- Conserva el repositorio privado.
- No publiques dumps con datos de la empresa.

## 11. Flujo seguro de cambios

1. Trabaja en `desarrollo`.
2. Publica vista previa.
3. Prueba con cuentas de cada rol.
4. Ejecuta `python auditar.py`.
5. Verifica consola del navegador.
6. Haz copia de seguridad antes de SQL.
7. Fusiona a `main`.
8. Realiza prueba de humo en producción.

## 12. Prueba de humo obligatoria

- Inicio de sesión con Jefe de almacén.
- Perfil visible en todas las páginas.
- Buscador global.
- Entrada al almacén general.
- Entrada reservada.
- Salida de proyecto.
- Préstamo.
- Traspaso de sobrante.
- Orden de compra y PDF.
- Reporte de alcance en PDF y Excel.
- Asignación y devolución de herramienta.
- Alta de vehículo.
- Etiqueta y ticket con logo.
- Cámara en HTTPS.

## Fuentes oficiales

- https://supabase.com/docs/guides/self-hosting
- https://supabase.com/docs/guides/self-hosting/docker
- https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https
- https://supabase.com/docs/guides/storage
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/docs/guides/storage/pricing
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/

## Equipo disponible: laptop con 8 GB RAM y 1 TB de almacenamiento

Sí se pueden conectar unidades de almacenamiento externas por USB. Para este CRM conviene distinguir entre **almacenamiento principal** y **respaldo/archivo**:

- Mantener PostgreSQL, Docker y los volúmenes principales de Supabase en el SSD interno siempre que sea posible.
- Usar un SSD/HDD externo USB 3.0, 3.1, 3.2 o USB-C para respaldos, exportaciones, archivos históricos y copias de seguridad.
- Evitar memorias USB comunes como almacenamiento permanente de la base de datos.
- Si se conectan varias unidades, preferir gabinete o hub alimentado externamente para evitar desconexiones por falta de energía.
- En Linux, montar la unidad mediante UUID y usar un sistema de archivos estable como ext4 para que el servidor la encuentre después de reiniciar.
- Desactivar suspensión selectiva/ahorro de energía del puerto usado por el disco y vigilar temperatura y estado SMART de las unidades.

### Evaluación de capacidad

El disco interno de **1 TB es suficiente como punto de partida para aproximadamente tres años** para el volumen previsto del CRM, especialmente si los comprobantes PDF se regeneran bajo demanda en vez de guardar todas las copias. El almacenamiento USB debe considerarse principalmente como expansión y respaldo, no como sustituto del disco principal.

La limitación más importante del equipo es la **RAM de 8 GB**. Puede utilizarse para pruebas y una producción pequeña, pero es el mínimo práctico para Supabase self-hosted. Si la laptop permite ampliación, se recomienda subir a **16 GB como mínimo**, y 32 GB sería ideal para dar margen a PostgreSQL, Docker, Auth, Storage, API y copias de seguridad simultáneas.

Si no es posible ampliar la RAM, conviene configurar memoria swap, limitar servicios no utilizados, vigilar el consumo de Docker y programar respaldos pesados fuera del horario de mayor uso.

### Distribución sugerida

- SSD interno 1 TB: sistema operativo, Docker, PostgreSQL/Supabase y datos activos.
- SSD externo 1 TB o 2 TB por USB 3.x: respaldo diario y archivos históricos.
- Una segunda copia de respaldo separada del servidor, cuando sea posible.
