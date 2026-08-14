# Manual de armado - Checador Skilled V78

Este manual resume el armado recomendado para una Raspberry Pi con lector de huella, pantalla y sincronización local-first.

## Componentes sugeridos
- Raspberry Pi 4/5 o equivalente.
- MicroSD industrial o SSD pequeño.
- Pantalla táctil HDMI/DSI de 5 a 7 pulgadas.
- Lector de huella UART compatible.
- Cámara oficial o USB si se añadirá rostro en una segunda etapa.
- Fuente 5V estable, carcasa impresa y ventilación.

## Proceso
1. Instalar Raspberry Pi OS.
2. Copiar la carpeta CHECADOR/RASPBERRY a la tarjeta.
3. Editar config.json con el código y token generados en RH.
4. Ejecutar instalar.sh.
5. Registrar huellas con enroll_fingerprint.py.
6. Probar checada por código.
7. Probar checada por huella.
8. Desconectar internet, registrar pruebas y reconectar. Deben sincronizarse los pendientes.

## Seguridad
- No guardar fotografías ni huellas crudas en Supabase.
- La contraseña de configuración inicial es Skilled2026 y debe cambiarse en producción.
- Los tokens del dispositivo no deben compartirse.

## Carcasa
La carpeta CHECADOR/CARCASA_3D contiene un diseño conceptual OpenSCAD. Ajustar medidas al hardware real antes de exportar STL.
