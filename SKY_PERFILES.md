# Sky global por perfiles

Desde V13 Sky es un componente compartido (`skilled-sky.js`) y no pertenece exclusivamente a Almacén.

## Detección automática

Sky determina el contexto en este orden:

1. Parámetro `?perfil=` de la URL.
2. Prefijo del archivo (`AL.`, `CO.`, `RH.`, `FI.`).
3. `data-profile` de la página.
4. Perfil activo guardado en la sesión.
5. Rol de la cuenta.

Esto permite que una misma pantalla compartida, por ejemplo `AL.vehiculos.html?perfil=rh`, use Sky de RH en lugar de Sky de Almacén.

## Perfiles incluidos

- Almacén: materiales, ubicaciones, mínimos, OC, herramientas, vehículos y proyectos.
- Compras: OC/requisiciones, proveedores, servicios, tienda y mínimos.
- RH: personal, ausencias/incidencias, documentos/contratos, capacitación, proyectos sin personal y vehículos compartidos.
- Finanzas: presupuestos y costo real de proyectos ya conectados a Supabase. Sky avisa cuando un módulo financiero aún no tiene datos transaccionales reales.
- Proyectos: estado, avance, costo, solicitudes y rutas de picking.
- Consulta: búsqueda de lectura dentro de los datos autorizados.

## Perfiles futuros

Toda página nueva que use `skilled-sidebar.js` carga Sky automáticamente. Un módulo futuro puede añadir su lógica específica sin copiar el motor completo:

```js
window.addEventListener('skilled:skyready', () => {
  SkilledSky.registerProfile('logistica', {
    async query(ctx) {
      ctx.setAnswer('Logística', 'Respuesta del módulo', 'Datos consultados por el perfil.');
      return 'Respuesta hablada de Logística.';
    }
  });
});
```

El perfil futuro también se detecta automáticamente por prefijo. Por ejemplo, `LG.inicio.html` se identifica como `lg` hasta que se registre un adaptador específico.

## Voz

La voz se configura por usuario y dispositivo desde `Mi perfil`. Se guardan voz, velocidad y tono en el navegador con una clave asociada al usuario autenticado. Esto es intencional porque las voces disponibles cambian entre Windows, Android, iOS y navegadores.

Atajo predeterminado: `Alt + S` en Windows/Linux y `Option + S` en macOS/iPad con teclado.

## Comandos generales V14

Estos comandos están disponibles en todos los perfiles antes de ejecutar una consulta de negocio:

- ¿Qué hora es?
- ¿Qué día es hoy?
- ¿Qué día de la semana es hoy?
- ¿En qué mes estamos?
- ¿En qué año estamos?
- Hola / Buenos días / Buenas tardes
- ¿Quién eres?
- ¿Qué perfil estoy usando?
- ¿Qué puedes hacer?
- Repite la respuesta
- Silencio / deja de hablar
- Cálculos básicos como “¿Cuánto es 25 por 8?”

No es obligatorio decir “Sky” al principio. El reconocimiento tolera variantes del nombre y pequeñas diferencias de pronunciación.
