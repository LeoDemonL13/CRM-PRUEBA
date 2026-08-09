# Convención de nombres por perfil

Los documentos específicos de cada perfil usan un prefijo fijo:

- `AL.` — Almacén y operación logística.
- `CO.` — Compras.
- `RH.` — Recursos Humanos.
- `FI.` — Finanzas.

Ejemplos: `AL.vehiculos.html`, `CO.proveedores.html`, `RH.personal.html`, `FI.presupuestos.html`.

Los archivos compartidos por todos los perfiles conservan su nombre sin prefijo: `login.html`, `inicio.html` (enrutador por rol), `perfil.html`, `auth-guard.js`, `skilled-sidebar.js`, `skilled-supabase.js`, `interfaz.css`, logos y recursos de seguridad.

Los nombres anteriores de páginas de Almacén se conservan únicamente como redirecciones de compatibilidad; toda la navegación nueva utiliza los nombres `AL.`.
