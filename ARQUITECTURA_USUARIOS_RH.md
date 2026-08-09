# Arquitectura de usuarios para Recursos Humanos

## Regla principal

No se crea una copia del CRM ni una página diferente para cada usuario.

Todos los usuarios con el mismo rol comparten los mismos archivos, por ejemplo:

- `RH.inicio.html`
- `RH.personal.html`
- `RH.asistencias.html`
- `RH.documentos.html`
- `RH.capacitacion.html`

Lo que cambia es:

1. La cuenta autenticada en Supabase.
2. El perfil almacenado en `perfiles_usuario`.
3. El rol asignado.
4. Los permisos definidos por RLS.
5. Los registros que cada usuario puede consultar o modificar.

## Ejemplo

Dos auxiliares de RH pueden usar exactamente `RH.personal.html`.

- El auxiliar A puede consultar un departamento.
- El auxiliar B puede consultar otro departamento.
- El jefe de RH puede consultar todos.

La diferencia se controla con datos y políticas, no duplicando páginas.

## Cuándo sí crear un apartado diferente

Solo cuando el flujo de trabajo sea realmente distinto, por ejemplo:

- Portal personal del colaborador.
- Panel del jefe de RH.
- Reclutamiento.
- Nómina.
- Evaluaciones de desempeño.

Incluso en esos casos, cada apartado sigue siendo compartido por todos los usuarios que tengan el mismo permiso.

## Módulo inicial incluido

La primera etapa funcional incluye:

- Panel de inicio de RH.
- Directorio de personal.
- Alta y edición de colaboradores.
- Número de empleado.
- Nombre y apellidos.
- Correo y teléfono.
- Puesto y departamento.
- Fecha de ingreso.
- Tipo de contrato.
- Estado laboral.
- Jefe directo.
- Observaciones.

Para activar el guardado en Supabase se debe ejecutar `SQL_MAESTRO_CRM.sql`.
