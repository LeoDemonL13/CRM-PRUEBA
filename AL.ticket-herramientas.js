(function () {
    'use strict';

    const text = value => String(value ?? '').trim();
    const escapeHtml = value => text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const dateText = value => {
        if (!value) return '—';
        const source = String(value);
        const date = new Date(source.length <= 10 ? `${source}T12:00:00` : source);
        if (Number.isNaN(date.getTime())) return text(value) || '—';
        return new Intl.DateTimeFormat('es-MX', {
            dateStyle: 'medium',
            ...(source.length > 10 ? { timeStyle: 'short' } : {})
        }).format(date);
    };

    const eventLabel = value => ({
        alta: 'Alta de herramienta',
        asignacion: 'Asignación de herramientas',
        devolucion: 'Devolución de herramientas',
        cancelacion: 'Cancelación de asignación',
        mantenimiento: 'Movimiento a mantenimiento',
        baja: 'Baja de herramienta',
        cambio_estado: 'Cambio de estado',
        estado: 'Cambio de estado'
    })[text(value).toLowerCase()] || 'Movimiento de herramientas';

    const documentTitle = value => `Comprobante de ${eventLabel(value).toLowerCase()}`;

    function normalizeItem(item = {}) {
        const unit = item.unidad || item.herramientas_unidades || item;
        const tool = unit.herramienta || unit.herramientas_catalogo || item.herramienta || item.herramientas_catalogo || {};
        return {
            codigo: text(unit.codigoInterno ?? unit.codigo_interno ?? item.codigoInterno ?? item.codigo_interno),
            serie: text(unit.numeroSerie ?? unit.numero_serie ?? item.numeroSerie ?? item.numero_serie),
            sku: text(tool.sku ?? item.sku),
            descripcion: text(tool.descripcion ?? tool.desc ?? item.descripcion ?? item.desc) || 'Herramienta sin descripción',
            marca: text(tool.marca ?? item.marca),
            modelo: text(tool.modelo ?? item.modelo),
            estado: text(unit.estado ?? item.estado)
        };
    }

    function normalizeDocument(data = {}) {
        const source = Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.asignaciones)
                ? data.asignaciones
                : [];
        const items = source.map(normalizeItem).filter(item => item.codigo || item.serie || item.sku || item.descripcion);
        const type = text(data.tipo || data.tipoEvento || data.tipo_evento).toLowerCase() || 'asignacion';
        return {
            tipo: type,
            titulo: text(data.titulo) || documentTitle(type),
            folio: text(data.folio || data.grupoId || data.grupo_id) || `HT-${Date.now()}`,
            fecha: data.fecha || data.createdAt || data.created_at || new Date().toISOString(),
            destino: text(data.destino) || 'Control de herramientas',
            responsable: text(data.responsable) || 'No especificado',
            personaContacto: text(data.personaContacto || data.persona_contacto),
            fechaDevolucionEstimada: data.fechaDevolucionEstimada || data.fecha_devolucion_estimada || '',
            estadoAnterior: text(data.estadoAnterior || data.estado_anterior),
            estadoNuevo: text(data.estadoNuevo || data.estado_nuevo),
            observaciones: text(data.observaciones || data.detalle) || 'Sin observaciones',
            condicion: text(data.condicion),
            accesorios: text(data.accesorios),
            items
        };
    }

    const isLetter = format => ['carta', 'letter', 'a4'].includes(text(format).toLowerCase());

    function createHtml(data, format = '58mm', embedded = false) {
        const documentData = normalizeDocument(data);
        const letter = isLetter(format);
        const qrPayload = `SKILLED|HERRAMIENTAS|${documentData.folio}`;
        const qrLiteral = JSON.stringify(qrPayload).replace(/</g, '\\u003c');
        const metadata = [
            ['Fecha', dateText(documentData.fecha)],
            ['Movimiento', eventLabel(documentData.tipo)],
            ['Destino', documentData.destino],
            ['Responsable', documentData.responsable],
            documentData.personaContacto ? ['Contacto', documentData.personaContacto] : null,
            documentData.fechaDevolucionEstimada ? ['Devolución esperada', dateText(documentData.fechaDevolucionEstimada)] : null,
            documentData.estadoAnterior || documentData.estadoNuevo
                ? ['Estado', [documentData.estadoAnterior, documentData.estadoNuevo].filter(Boolean).join(' → ')]
                : null,
            documentData.condicion ? ['Condición', documentData.condicion] : null,
            documentData.accesorios ? ['Accesorios', documentData.accesorios] : null
        ].filter(Boolean);

        const metadataHtml = metadata.map(([label, value]) => `
            <div class="dato"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>
        `).join('');

        const letterRows = documentData.items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${escapeHtml(item.descripcion)}</strong>
                    ${item.marca || item.modelo ? `<small>${escapeHtml([item.marca, item.modelo].filter(Boolean).join(' · '))}</small>` : ''}
                </td>
                <td>${escapeHtml(item.sku || '—')}</td>
                <td>${escapeHtml(item.codigo || '—')}</td>
                <td>${escapeHtml(item.serie || '—')}</td>
            </tr>
        `).join('');

        const thermalRows = documentData.items.map((item, index) => `
            <article class="producto-termico">
                <div class="producto-numero">${index + 1}</div>
                <div class="producto-contenido">
                    <div class="producto-codigo">${escapeHtml(item.codigo || item.sku || 'SIN CÓDIGO')}</div>
                    <div class="producto-descripcion">${escapeHtml(item.descripcion)}</div>
                    <div class="producto-detalle">SKU: ${escapeHtml(item.sku || '—')} · Serie: ${escapeHtml(item.serie || '—')}</div>
                </div>
            </article>
        `).join('');

        const controls = embedded ? '' : `
            <div class="no-print">
                <button class="imprimir" type="button" onclick="window.print()">Imprimir</button>
                <button class="cerrar" type="button" onclick="window.close()">Cerrar</button>
            </div>
        `;

        return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(documentData.titulo)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
@page{size:${letter ? 'letter' : '58mm auto'};margin:0!important}
*{box-sizing:border-box}
html,body{margin:0!important;padding:0!important;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
.ticket{background:#fff;transform:none!important;zoom:1!important}
.ticket-carta{width:216mm;min-height:279mm;padding:14mm;margin:0 auto}
.ticket-termico{width:47mm!important;max-width:47mm!important;margin:0 auto!important;padding:1.5mm 0 3mm;color:#000;font-size:7.8pt;line-height:1.18;overflow:visible}
.cabecera{display:grid;align-items:start;border-bottom:.35mm solid #000}
.ticket-carta .cabecera{grid-template-columns:1fr 1fr;gap:12px;padding-bottom:8px}
.ticket-termico .cabecera{grid-template-columns:17mm minmax(0,1fr);gap:1.5mm;padding-bottom:1.8mm}
.marca{font-weight:700;letter-spacing:0;line-height:1}
.marca img{display:block;height:auto;object-fit:contain}
.ticket-carta .marca img{max-width:46mm;max-height:25mm}
.ticket-termico .marca img{max-width:16mm;max-height:11mm}
.marca small{display:block;color:#000;text-transform:uppercase;font-weight:700;line-height:1.12}
.ticket-carta .marca small{font-size:8px;letter-spacing:1.4px;margin-top:4px}
.ticket-termico .marca small{font-size:5.2pt;letter-spacing:.28pt;margin-top:.8mm}
.titulo{text-align:right;min-width:0}
.titulo h1{margin:0;font-weight:700;line-height:1.12;overflow-wrap:anywhere}
.ticket-carta .titulo h1{font-size:18px}
.ticket-termico .titulo h1{font-size:7.5pt}
.folio{color:#000;text-align:right;overflow-wrap:anywhere}
.ticket-carta .folio{font-size:10px;margin-top:4px}
.ticket-termico .folio{font-size:5.8pt;margin-top:.8mm;line-height:1.12}
.datos{border:.25mm solid #000;border-radius:0}
.ticket-carta .datos{margin:10px 0;display:grid;grid-template-columns:1fr 1fr;gap:0 14px;padding:6px 9px}
.ticket-termico .datos{margin:2.2mm 0;padding:1.25mm 1.35mm}
.dato{display:grid;align-items:start}
.ticket-carta .dato{grid-template-columns:105px 1fr;padding:3px 0;font-size:10px}
.ticket-termico .dato{grid-template-columns:14.2mm minmax(0,1fr);gap:.8mm;padding:.7mm 0;border-bottom:.2mm solid #000;font-size:7pt;line-height:1.17}
.ticket-termico .dato:last-child{border-bottom:0}
.dato span{color:#000}
.dato strong{font-weight:700;overflow-wrap:anywhere;word-break:break-word}
.seccion-titulo{font-weight:700;text-transform:uppercase;letter-spacing:.22pt;border-bottom:.3mm solid #000}
.ticket-carta .seccion-titulo{font-size:11px;padding:5px 0}
.ticket-termico .seccion-titulo{font-size:7.2pt;padding:.9mm 0;margin-top:.4mm}
.tabla-carta{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}
.tabla-carta th,.tabla-carta td{border-bottom:1px solid #000;padding:5px 3px;vertical-align:top;overflow-wrap:anywhere}
.tabla-carta th{text-align:left;background:#fff;font-size:9px;text-transform:uppercase}
.tabla-carta th:nth-child(1),.tabla-carta td:nth-child(1){width:7%;text-align:center}
.tabla-carta th:nth-child(2),.tabla-carta td:nth-child(2){width:39%}
.tabla-carta th:nth-child(3),.tabla-carta td:nth-child(3){width:18%}
.tabla-carta th:nth-child(4),.tabla-carta td:nth-child(4){width:19%}
.tabla-carta th:nth-child(5),.tabla-carta td:nth-child(5){width:17%}
.tabla-carta small{display:block;margin-top:3px;font-size:8px;color:#222}
.productos-termicos{border-bottom:.3mm solid #000}
.producto-termico{display:grid;grid-template-columns:3.6mm minmax(0,1fr);gap:.8mm;align-items:start;padding:1.55mm 0;border-bottom:.2mm solid #000;break-inside:avoid}
.producto-termico:last-child{border-bottom:0}
.producto-numero{width:3.3mm;height:3.3mm;border:.2mm solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:5.7pt;font-weight:700}
.producto-contenido{min-width:0}
.producto-codigo{font-family:"Courier New",Courier,monospace;font-size:5.9pt;color:#000;line-height:1.12;overflow-wrap:anywhere;word-break:break-word}
.producto-descripcion{font-size:7.5pt;font-weight:700;line-height:1.16;margin-top:.5mm;overflow-wrap:anywhere;word-break:break-word}
.producto-detalle{font-size:5.2pt;line-height:1.2;margin-top:.65mm;overflow-wrap:anywhere;word-break:break-word}
.resumen{font-weight:700;border:.3mm solid #000}
.ticket-carta .resumen{margin-top:7px;padding:6px 8px;text-align:right;font-size:10px}
.ticket-termico .resumen{margin-top:1.8mm;padding:1.25mm 1.35mm;display:flex;justify-content:space-between;font-size:7.6pt}
.notas{border:.25mm solid #000;overflow-wrap:anywhere}
.ticket-carta .notas{margin-top:10px;padding:7px;font-size:9px;min-height:32px}
.ticket-termico .notas{margin-top:1.8mm;padding:1.35mm;font-size:6.7pt;line-height:1.22;min-height:9mm}
.firma{display:grid}
.ticket-carta .firma{margin-top:42mm;grid-template-columns:1fr 1fr;gap:25mm}
.ticket-termico .firma{margin-top:13mm;grid-template-columns:1fr;gap:9mm}
.linea{border-top:.3mm solid #000;text-align:center}
.ticket-carta .linea{padding-top:5px;font-size:9px}
.ticket-termico .linea{padding-top:1.3mm;font-size:7pt;line-height:1.18}
.qr-ticket{display:flex;flex-direction:column;align-items:center;justify-content:center;border-top:.25mm solid #000}
.ticket-carta .qr-ticket{margin-top:12px;padding-top:10px}
.ticket-termico .qr-ticket{margin-top:2.5mm;padding-top:1.8mm}
.qr-ticket canvas{display:block!important;image-rendering:pixelated;image-rendering:crisp-edges}.qr-ticket img{display:none!important}
.ticket-carta .qr-ticket canvas{width:28mm!important;height:28mm!important}
.ticket-termico .qr-ticket canvas{width:20mm!important;height:20mm!important}
.qr-ticket span{font-weight:700;text-align:center}
.ticket-carta .qr-ticket span{font-size:8px;margin-top:5px}
.ticket-termico .qr-ticket span{font-size:5.5pt;margin-top:.9mm}
.pie{border-top:.2mm solid #000;text-align:center;color:#000}
.ticket-carta .pie{margin-top:12px;padding-top:7px;font-size:8px}
.ticket-termico .pie{margin-top:2.5mm;padding-top:1.2mm;font-size:5.8pt;line-height:1.18}
.no-print{display:flex;gap:8px;justify-content:center;padding:10px;background:#e5e7eb;position:sticky;top:0;z-index:20}
.no-print button{border:0;border-radius:7px;padding:8px 14px;cursor:pointer;font:700 13px Arial,Helvetica,sans-serif}
.imprimir{background:#1d4ed8;color:#fff}.cerrar{background:#cbd5e1;color:#111}
@media screen{body{background:${embedded ? '#e9eef6' : '#eef1f5'};min-height:100vh}.ticket{box-shadow:0 10px 32px rgba(15,23,42,.18)}.ticket-termico{margin-top:18px!important;margin-bottom:28px!important}}
@media screen and (max-width:700px){.ticket-carta{width:100%;min-height:auto;padding:24px}.ticket-carta .cabecera{grid-template-columns:1fr}.ticket-carta .titulo,.ticket-carta .folio{text-align:left}.ticket-carta .datos{grid-template-columns:1fr}}
@media print{html,body{margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}.no-print{display:none!important}.ticket{box-shadow:none!important;transform:none!important;zoom:1!important}.ticket-carta{width:216mm;min-height:279mm;margin:0!important}.ticket-termico{width:47mm!important;max-width:47mm!important;margin-left:auto!important;margin-right:auto!important;padding-top:1.5mm!important;padding-bottom:3mm!important}}
</style>
</head>
<body>
${controls}
<section class="ticket ${letter ? 'ticket-carta' : 'ticket-termico'}">
    <div class="cabecera">
        <div class="marca"><img src="logo-reporte.png" alt="Skilled"><small>Proyectos Industriales</small></div>
        <div class="titulo"><h1>${escapeHtml(documentData.titulo)}</h1><div class="folio">Folio: ${escapeHtml(documentData.folio)}</div></div>
    </div>
    <div class="datos">${metadataHtml}</div>
    <div class="seccion-titulo">Herramientas</div>
    ${letter
        ? `<table class="tabla-carta"><thead><tr><th>#</th><th>Herramienta</th><th>SKU</th><th>Código interno</th><th>No. serie</th></tr></thead><tbody>${letterRows || '<tr><td colspan="5">Sin herramientas relacionadas</td></tr>'}</tbody></table>`
        : `<div class="productos-termicos">${thermalRows || '<article class="producto-termico"><div class="producto-contenido">Sin herramientas relacionadas</div></article>'}</div>`}
    <div class="resumen">${letter
        ? `Total de unidades: ${documentData.items.length}`
        : `<span>Total de unidades</span><strong>${documentData.items.length}</strong>`}</div>
    <div class="notas"><strong>Observaciones:</strong><br>${escapeHtml(documentData.observaciones)}</div>
    <div class="firma">
        <div class="linea">Entrega / responsable<br><strong>${escapeHtml(documentData.responsable)}</strong></div>
        ${letter ? '<div class="linea">Recibe / conformidad</div>' : ''}
    </div>
    <div class="qr-ticket"><div id="tool-qr"></div><span>Escanea para consultar este evento en el CRM</span></div>
    <div class="pie">Conserve este comprobante como respaldo del movimiento registrado en el control de herramientas.</div>
</section>
<script>
window.addEventListener('load',function(){
    var container=document.getElementById('tool-qr');
    if(window.QRCode&&container){
        var holder=document.createElement('div');
        holder.style.position='fixed';holder.style.left='-9999px';document.body.appendChild(holder);
        new QRCode(holder,{text:${qrLiteral},width:180,height:180,typeNumber:0,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.L});
        setTimeout(function(){
            var canvas=holder.querySelector('canvas');container.innerHTML='';
            if(canvas){var clean=document.createElement('canvas');clean.width=canvas.width;clean.height=canvas.height;var ctx=clean.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,clean.width,clean.height);ctx.drawImage(canvas,0,0);container.appendChild(clean);}
            holder.remove();
        },0);
    }
});
</script>
</body>
</html>`;
    }

    let modal = null;
    let currentData = null;
    let currentFormat = 'carta';

    function close() {
        modal?.remove();
        modal = null;
        currentData = null;
    }

    function updatePreview() {
        if (!modal || !currentData) return;
        const frame = modal.querySelector('iframe');
        frame.srcdoc = createHtml(currentData, currentFormat, true);
        modal.querySelectorAll('[data-tool-format]').forEach(button => {
            const active = button.dataset.toolFormat === currentFormat;
            button.classList.toggle('bg-blue-600', active);
            button.classList.toggle('text-white', active);
            button.classList.toggle('bg-[#10172a]', !active);
            button.classList.toggle('text-gray-300', !active);
        });
    }

    function openWindow(data, format = 'carta', autoPrint = false) {
        const popup = window.open('about:blank', '_blank');
        if (!popup) throw new Error('El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para este sitio.');
        popup.document.open();
        popup.document.write(createHtml(data, format, false));
        popup.document.close();
        if (autoPrint) {
            const print = () => setTimeout(() => { popup.focus(); popup.print(); }, 500);
            if (popup.document.readyState === 'complete') print();
            else popup.addEventListener('load', print, { once: true });
        }
        return popup;
    }

    function printCurrent() {
        if (!currentData) return;
        const frame = modal?.querySelector('iframe');
        if (frame?.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            return;
        }
        openWindow(currentData, currentFormat, true);
    }

    function show(data, format = 'carta') {
        close();
        currentData = normalizeDocument(data);
        currentFormat = isLetter(format) ? 'carta' : '58mm';
        modal = document.createElement('div');
        modal.id = 'skilled-tool-ticket-modal';
        modal.className = 'fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center';
        modal.innerHTML = `
            <section class="w-full max-w-6xl max-h-[96vh] overflow-hidden rounded-2xl border border-[#243257] bg-[#090d1a] shadow-2xl text-gray-200 flex flex-col">
                <header class="flex items-start justify-between gap-4 border-b border-[#243257] px-5 py-4">
                    <div>
                        <span class="inline-flex rounded-full border border-blue-500/30 bg-blue-950/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-blue-300">Control de herramientas</span>
                        <h2 class="mt-2 text-lg font-bold text-white">Ticket y comprobante</h2>
                        <p class="mt-1 text-xs text-gray-500">Revisa la información y selecciona el formato antes de imprimir.</p>
                    </div>
                    <button type="button" data-tool-close class="text-xl text-gray-500 hover:text-white">×</button>
                </header>
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#243257] px-4 py-3">
                    <div class="flex gap-2">
                        <button type="button" data-tool-format="carta" class="rounded-lg border border-[#243257] px-3 py-2 text-xs font-bold">Comprobante carta</button>
                        <button type="button" data-tool-format="58mm" class="rounded-lg border border-[#243257] px-3 py-2 text-xs font-bold">Ticket 58 mm</button>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" data-tool-open class="rounded-lg border border-[#243257] bg-[#10172a] px-3 py-2 text-xs font-bold text-gray-200">Abrir en otra pestaña</button>
                        <button type="button" data-tool-print class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">Imprimir</button>
                    </div>
                </div>
                <div class="min-h-0 flex-1 bg-[#dfe7f2] p-3">
                    <iframe title="Vista previa del comprobante de herramientas" class="h-[68vh] w-full rounded-xl border-0 bg-white"></iframe>
                </div>
            </section>`;
        modal.querySelector('[data-tool-close]').addEventListener('click', close);
        modal.querySelector('[data-tool-open]').addEventListener('click', () => openWindow(currentData, currentFormat));
        modal.querySelector('[data-tool-print]').addEventListener('click', printCurrent);
        modal.querySelectorAll('[data-tool-format]').forEach(button => {
            button.addEventListener('click', () => {
                currentFormat = button.dataset.toolFormat;
                updatePreview();
            });
        });
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        document.body.appendChild(modal);
        updatePreview();
    }

    function print(data, format = '58mm') {
        const normalized = normalizeDocument(data);
        return openWindow(normalized, isLetter(format) ? 'carta' : '58mm', true);
    }

    window.SkilledToolTickets = Object.freeze({
        crearHtml: createHtml,
        abrir: openWindow,
        mostrar: show,
        imprimir: print,
        cerrar: close,
        disponible: true
    });
    window.dispatchEvent(new CustomEvent('skilled:tool-tickets-ready'));
})();
