(function(){
    'use strict';
    function texto(valor){return String(valor??'').trim()}
    function escapar(valor){return texto(valor).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;')}
    function fechaLegible(valor){
        const fecha=valor?new Date(valor):new Date();
        if(Number.isNaN(fecha.getTime()))return texto(valor);
        return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(fecha)
    }
    function normalizarProductos(productos){
        return(Array.isArray(productos)?productos:[]).map(item=>{
            const producto=item.producto||{};
            return{
                codigo:texto(producto.codigo??item.codigo??item.material_codigo),
                descripcion:texto(producto.desc??producto.descripcion??item.descripcion),
                cantidad:Number(item.cantidad)||0,
                unidad:texto(producto.unidad??item.unidad)
            }
        })
    }
    function esFormatoCarta(formato){return['carta','letter','a4'].includes(texto(formato).toLowerCase())}
    function crearHtmlTicket(datos,formato='58mm'){
        const productos=normalizarProductos(datos.productos);
        const esCarta=esFormatoCarta(formato);
        const titulo=texto(datos.titulo)||'Comprobante de movimiento de material';
        const recibe=texto(datos.recibeNombre)||'No especificado';
        const recibeTipo=texto(datos.recibeTipo);
        const folio=texto(datos.folio??datos.requestId)||'Sin folio';
        const proyecto=texto(datos.proyecto)||'Sin proyecto';
        const bodegaOrigen=texto(datos.bodegaOrigen);
        const bodegaDestino=texto(datos.bodegaDestino);
        const ubicacionGeneral=texto(datos.ubicacion);
        const ubicacionOrigen=texto(datos.ubicacionOrigen);
        const ubicacionDestino=texto(datos.ubicacionDestino);
        const ordenCompra=texto(datos.ordenCompra);
        const fechaOrdenCompra=texto(datos.fechaOrdenCompra);
        const referencia=texto(datos.referencia);
        const notas=texto(datos.notas??datos.motivo);
        const total=productos.reduce((acum,item)=>acum+item.cantidad,0);
        const qrId=texto(datos.requestId||datos.referencia||datos.folio||folio);
        const qrPayload=`SKT:${qrId}`;
        const qrLiteral=JSON.stringify(qrPayload).replace(/</g,'\\u003c');
        const datosTicket=[
            ['Fecha',fechaLegible(datos.fecha)],
            ['Proyecto',proyecto],
            referencia?['Referencia',referencia]:null,
            ordenCompra?['Orden de compra',ordenCompra]:null,
            fechaOrdenCompra?['Fecha OC',fechaOrdenCompra]:null,
            bodegaOrigen?['Bodega origen',bodegaOrigen]:null,
            bodegaDestino?['Bodega destino',bodegaDestino]:null,
            ubicacionOrigen?['Ubicación origen',ubicacionOrigen]:null,
            ubicacionDestino?['Ubicación destino',ubicacionDestino]:null,
            ubicacionGeneral&&!ubicacionOrigen&&!ubicacionDestino?['Ubicación',ubicacionGeneral]:null,
            texto(datos.recibeNombre)?['Recibe',`${recibe}${recibeTipo?` (${recibeTipo})`:''}`]:null
        ].filter(Boolean);
        const filasCarta=productos.map(item=>`<tr><td>${escapar(item.codigo)}</td><td>${escapar(item.descripcion)}</td><td class="cantidad">${escapar(item.cantidad)}</td><td>${escapar(item.unidad)}</td></tr>`).join('');
        const filasTicket=productos.map((item,index)=>`<article class="producto-termico"><div class="producto-numero">${index+1}</div><div class="producto-contenido"><div class="producto-codigo">${escapar(item.codigo)||'SIN CÓDIGO'}</div><div class="producto-descripcion">${escapar(item.descripcion)||'Material sin descripción'}</div></div><div class="producto-medida"><strong>${escapar(item.cantidad)}</strong><span>${escapar(item.unidad)}</span></div></article>`).join('');
        const datosHtml=datosTicket.map(([etiqueta,valor])=>`<div class="dato"><span>${escapar(etiqueta)}</span><strong>${escapar(valor)}</strong></div>`).join('');
        return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><style>
@page{size:58mm auto;margin:0!important}
*{box-sizing:border-box}
html,body{margin:0!important;padding:0!important;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
.ticket{background:#fff;transform:none!important;zoom:1!important}
.ticket-carta{width:216mm;min-height:279mm;padding:14mm;margin:0 auto}
.ticket-termico{width:47mm!important;max-width:47mm!important;margin:0 auto!important;padding:1.5mm 0 3mm;color:#000;font-size:7.8pt;line-height:1.18;overflow:visible}
.cabecera{display:grid;align-items:start;border-bottom:.35mm solid #000}
.ticket-carta .cabecera{grid-template-columns:1fr 1fr;gap:12px;padding-bottom:8px}
.ticket-termico .cabecera{grid-template-columns:17mm minmax(0,1fr);gap:1.5mm;padding-bottom:1.8mm}
.marca{font-weight:700;letter-spacing:0;line-height:1}
.ticket-carta .marca{font-size:24px}
.ticket-termico .marca{font-size:14pt}
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
.ticket-carta .dato{grid-template-columns:100px 1fr;padding:3px 0;font-size:10px}
.ticket-termico .dato{grid-template-columns:14.2mm minmax(0,1fr);gap:.8mm;padding:.7mm 0;border-bottom:.2mm solid #000;font-size:7pt;line-height:1.17}
.ticket-termico .dato:last-child{border-bottom:0}
.dato span{color:#000}
.dato strong{font-weight:700;overflow-wrap:anywhere;word-break:break-word}
.seccion-titulo{font-weight:700;text-transform:uppercase;letter-spacing:.22pt;border-bottom:.3mm solid #000}
.ticket-carta .seccion-titulo{font-size:11px;padding:5px 0}
.ticket-termico .seccion-titulo{font-size:7.2pt;padding:.9mm 0;margin-top:.4mm}
.tabla-carta{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}
.tabla-carta th,.tabla-carta td{border-bottom:1px solid #000;padding:5px 3px;vertical-align:top;overflow-wrap:anywhere}
.tabla-carta th{text-align:left;background:#fff;font-size:10px;text-transform:uppercase}
.tabla-carta th:nth-child(1),.tabla-carta td:nth-child(1){width:22%}
.tabla-carta th:nth-child(2),.tabla-carta td:nth-child(2){width:48%}
.tabla-carta th:nth-child(3),.tabla-carta td:nth-child(3){width:14%;text-align:right}
.tabla-carta th:nth-child(4),.tabla-carta td:nth-child(4){width:16%}
.productos-termicos{border-bottom:.3mm solid #000}
.producto-termico{display:grid;grid-template-columns:3.6mm minmax(0,1fr) 9mm;gap:.8mm;align-items:start;padding:1.55mm 0;border-bottom:.2mm solid #000;break-inside:avoid}
.producto-termico:last-child{border-bottom:0}
.producto-numero{width:3.3mm;height:3.3mm;border:.2mm solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:5.7pt;font-weight:700}
.producto-contenido{min-width:0}
.producto-codigo{font-family:"Courier New",Courier,monospace;font-size:5.9pt;color:#000;line-height:1.12;overflow-wrap:anywhere;word-break:break-word}
.producto-descripcion{font-size:7.5pt;font-weight:700;line-height:1.16;margin-top:.5mm;overflow-wrap:anywhere;word-break:break-word}
.producto-medida{text-align:right;white-space:normal;min-width:9mm}
.producto-medida strong{display:block;font-size:9pt;line-height:1}
.producto-medida span{display:block;font-size:5.2pt;color:#000;text-transform:uppercase;margin-top:.65mm;overflow-wrap:anywhere}
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
.imprimir{background:#1d4ed8;color:#fff}
.cerrar{background:#cbd5e1;color:#111}
@media screen and (max-width:700px){
.ticket-carta{width:100%;min-height:auto;padding:24px}
.ticket-carta .cabecera{grid-template-columns:1fr}
.ticket-carta .titulo{text-align:left}
.ticket-carta .folio{text-align:left}
.ticket-carta .datos{grid-template-columns:1fr}
}
@media screen{
body{background:#eef1f5;min-height:100vh}
.ticket{box-shadow:0 10px 32px rgba(15,23,42,.18)}
.ticket-termico{margin-top:18px!important;margin-bottom:28px!important}
}
@media print{
html,body{width:58mm!important;min-width:58mm!important;max-width:58mm!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}
.no-print{display:none!important}
.ticket{box-shadow:none!important;transform:none!important;zoom:1!important}
.ticket-carta{width:216mm;min-height:279mm;margin:0!important}
.ticket-termico{width:47mm!important;max-width:47mm!important;margin-left:auto!important;margin-right:auto!important;padding-top:1.5mm!important;padding-bottom:3mm!important}
}
</style></head><body><div class="no-print"><button class="imprimir" onclick="window.print()">Imprimir</button><button class="cerrar" onclick="window.close()">Cerrar</button></div><section class="ticket ${esCarta?'ticket-carta':'ticket-termico'}"><div class="cabecera"><div class="marca"><img src="logo-reporte.png" alt="Skilled" style="max-width:${esCarta?'46mm':'16mm'};height:auto;display:block"><small>Proyectos Industriales</small></div><div class="titulo"><h1>${escapar(titulo)}</h1><div class="folio">Folio: ${escapar(folio)}</div></div></div><div class="datos">${datosHtml}</div><div class="seccion-titulo">Materiales</div>${esCarta?`<table class="tabla-carta"><thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unidad</th></tr></thead><tbody>${filasCarta||'<tr><td colspan="4">Sin materiales</td></tr>'}</tbody></table>`:`<div class="productos-termicos">${filasTicket||'<article class="producto-termico"><div class="producto-contenido">Sin materiales</div></article>'}</div>`}<div class="resumen">${esCarta?`Cantidad total: ${escapar(total)}`:`<span>Cantidad total</span><strong>${escapar(total)}</strong>`}</div>${notas?`<div class="notas"><strong>Notas:</strong><br>${escapar(notas)}</div>`:''}<div class="firma"><div class="linea">Firma de quien recibe<br><strong>${escapar(recibe)}</strong></div>${esCarta?'<div class="linea">Entrega / Almacén</div>':''}</div><div class="qr-ticket"><div id="ticket-qr"></div><span>Escanea para consultar este movimiento en el CRM</span></div><div class="pie">Conserve este comprobante como respaldo del movimiento registrado en el CRM.</div></section><script>window.addEventListener('load',function(){var cont=document.getElementById('ticket-qr');if(window.QRCode&&cont){cont.innerHTML='';var aux=document.createElement('div');aux.style.position='fixed';aux.style.left='-9999px';document.body.appendChild(aux);new QRCode(aux,{text:${qrLiteral},width:180,height:180,typeNumber:0,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.L});setTimeout(function(){var canvas=aux.querySelector('canvas');cont.innerHTML='';if(canvas){var clean=document.createElement('canvas');clean.width=canvas.width;clean.height=canvas.height;var ctx=clean.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,clean.width,clean.height);ctx.drawImage(canvas,0,0);cont.appendChild(clean);}aux.remove();},0);}});</script></body></html>`
    }
    function imprimirCarta(datos){
        const ventana=window.open('','_blank','width=1050,height=820');
        if(!ventana)throw new Error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.');
        ventana.document.open();
        ventana.document.write(crearHtmlTicket(datos,'carta'));
        ventana.document.close();
        const imprimirCuandoEsteListo=()=>{
            setTimeout(()=>{
                try{
                    ventana.focus();
                    ventana.print()
                }catch(error){}
            },500)
        };
        if(ventana.document.readyState==='complete')imprimirCuandoEsteListo();
        else ventana.addEventListener('load',imprimirCuandoEsteListo,{once:true});
        return ventana
    }
    function imprimirTermico(datos){
        const anterior=document.getElementById('skilled-ticket-print-frame');
        if(anterior)anterior.remove();
        const frame=document.createElement('iframe');
        frame.id='skilled-ticket-print-frame';
        frame.setAttribute('aria-hidden','true');
        frame.style.cssText='position:fixed;right:-10000px;bottom:0;width:58mm;height:20mm;border:0;opacity:0;pointer-events:none;background:#fff;';
        document.body.appendChild(frame);
        const documento=frame.contentDocument||frame.contentWindow.document;
        documento.open();
        documento.write(crearHtmlTicket(datos,'58mm'));
        documento.close();
        let limpio=false;
        const limpiar=()=>{
            if(limpio)return;
            limpio=true;
            setTimeout(()=>frame.remove(),200)
        };
        frame.onload=()=>{
            const ventana=frame.contentWindow;
            ventana.addEventListener('afterprint',limpiar,{once:true});
            setTimeout(()=>{
                try{
                    ventana.focus();
                    ventana.print()
                }catch(error){
                    limpiar();
                    throw error
                }
            },450)
        };
        setTimeout(limpiar,180000);
        return frame
    }
    function imprimir(datos,formato='58mm'){
        return esFormatoCarta(formato)?imprimirCarta(datos):imprimirTermico(datos)
    }
    function mostrarListo(datos){
        document.getElementById('skilled-ticket-modal')?.remove();
        const modal=document.createElement('div');
        modal.id='skilled-ticket-modal';
        modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px';
        const modalTitulo=texto(datos.modalTitulo)||(datos.desdeHistorial?'Ticket del movimiento':'Movimiento registrado');
        const modalDescripcion=texto(datos.modalDescripcion)||(datos.desdeHistorial?'Selecciona el formato para consultar o imprimir este movimiento.':'El movimiento quedó guardado. Selecciona el formato del comprobante.');
        modal.innerHTML=`<div style="width:min(450px,100%);background:#090d1a;border:1px solid #243257;border-radius:14px;padding:22px;color:#e5e7eb;font-family:Inter,system-ui,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.5)"><div style="display:flex;gap:12px;align-items:flex-start"><div style="width:42px;height:42px;border-radius:10px;background:rgba(16,185,129,.12);color:#34d399;display:flex;align-items:center;justify-content:center;font-size:22px">✓</div><div style="flex:1"><h2 style="margin:0;font-size:17px">${escapar(modalTitulo)}</h2><p style="margin:5px 0 0;color:#94a3b8;font-size:12px">${escapar(modalDescripcion)}</p></div></div><div style="margin-top:16px;padding:12px;background:#060814;border:1px solid #1f2c4e;border-radius:9px;font-size:12px;color:#cbd5e1"><div><strong>Folio:</strong> ${escapar(datos.folio??datos.requestId)}</div><div style="margin-top:4px"><strong>Recibe:</strong> ${escapar(datos.recibeNombre||'No especificado')}</div><div style="margin-top:4px"><strong>Materiales:</strong> ${normalizarProductos(datos.productos).length}</div></div><div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end;margin-top:18px"><button data-ticket-cerrar style="border:1px solid #334155;background:#111827;color:#cbd5e1;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer">Cerrar</button><button data-ticket-carta style="border:1px solid #334155;background:#1e293b;color:#fff;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer">Imprimir tamaño carta</button><button data-ticket-termico style="border:0;background:#2563eb;color:#fff;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer">Imprimir ticket térmico</button></div></div>`;
        modal.querySelector('[data-ticket-cerrar]').addEventListener('click',()=>modal.remove());
        modal.querySelector('[data-ticket-carta]').addEventListener('click',()=>imprimir(datos,'carta'));
        modal.querySelector('[data-ticket-termico]').addEventListener('click',()=>imprimir(datos,'58mm'));
        modal.addEventListener('click',evento=>{if(evento.target===modal)modal.remove()});
        document.body.appendChild(modal)
    }
    window.SkilledTickets=Object.freeze({imprimir,imprimirTermico,imprimirCarta,mostrarListo,crearHtmlTicket})
})();
