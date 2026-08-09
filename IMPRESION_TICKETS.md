# Ticket de 47 mm e impresión directa

## Archivos

El archivo `AL.ticket-materiales.js` se copia directamente en la carpeta principal del CRM y reemplaza al anterior.

`AL.prueba-ticket.html` permite revisar el diseño sin registrar movimientos.

## Tamaño

El rollo continúa configurado como papel de 58 mm. El contenido útil del comprobante mide exactamente 47 mm y queda centrado con 5.5 mm de espacio a cada lado.

En las preferencias de la impresora selecciona papel de 58 mm, escala 100 %, márgenes mínimos o cero y orientación vertical.

## Impresión normal

El botón `Imprimir ticket térmico` ya no abre una ventana de vista previa propia. Crea un marco invisible y llama de inmediato a la función de impresión del navegador.

En un navegador abierto normalmente todavía aparecerá el cuadro de impresión del sistema.

## Impresión directa sin cuadro de diálogo

1. Ejecuta `CONFIGURAR_POS58_PREDETERMINADA.ps1`.
2. Verifica que la impresora se llame `POS-58 11.3.0.0`. Si tiene otro nombre, ejecuta:

```powershell
.\CONFIGURAR_POS58_PREDETERMINADA.ps1 -PrinterName "NOMBRE EXACTO"
```

3. Abre `ABRIR_CRM_IMPRESION_DIRECTA.bat` con Bloc de notas.
4. Cambia `CRM_URL` si la dirección final del CRM es distinta.
5. Cierra la ventana y abre siempre el CRM usando ese archivo.
6. Para salir del modo de pantalla completa usa `Alt + F4`.

El archivo usa un perfil independiente de Brave o Chrome. La impresión térmica se envía a la impresora predeterminada al presionar el botón. El formato tamaño carta conserva el cuadro normal de impresión.

## Primera prueba

1. Abre el CRM con `ABRIR_CRM_IMPRESION_DIRECTA.bat`.
2. Registra un movimiento de una sola pieza.
3. Presiona `Imprimir ticket térmico`.
4. Confirma que se utiliza la POS-58.
5. Revisa centrado, nitidez y corte.
6. Después prueba un ticket con cinco materiales y descripciones largas.
