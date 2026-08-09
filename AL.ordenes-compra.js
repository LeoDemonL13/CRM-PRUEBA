(function(){
'use strict';
const text=value=>String(value??'').trim();
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
const lower=value=>text(value).toLocaleLowerCase('es-MX');
const safe=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'ORDEN';
const encodePayload=value=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)};
const decodePayload=value=>{const binary=atob(text(value));const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))};
const markerRegex=/SKILLED_OC_JSON_BEGIN\s+([A-Za-z0-9+/=]+)\s+SKILLED_OC_JSON_END/i;
let logoPromise=null;
let importInput=null;
let importing=false;
async function toDataUrl(source){
const response=await fetch(source,{mode:'cors',cache:'no-store'});
if(!response.ok)throw new Error('No se pudo cargar el logo.');
const blob=await response.blob();
return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
}
async function logo(){
if(logoPromise)return logoPromise;
logoPromise=(async()=>{for(const source of ['logo-reporte.png']){try{return await toDataUrl(source)}catch(error){}}return null})();
return logoPromise;
}
function dateLabel(value){
if(!value)return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00`:value);
return Number.isNaN(date.getTime())?text(value):new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'long',year:'numeric'}).format(date);
}
function isoDate(value){
const raw=text(value);
if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
const date=new Date(raw);
if(!Number.isNaN(date.getTime()))return date.toISOString().slice(0,10);
const match=raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
if(!match)return'';
let year=Number(match[3]);if(year<100)year+=2000;
return`${year}-${String(match[2]).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
}
function priorityLabel(value){return({urgente:'Urgente',normal:'Normal',critica:'Crítica',alta:'Alta',media:'Media',baja:'Baja',inmediata:'Inmediata',programada:'Programada',sin_urgencia:'Sin urgencia'})[lower(value)]||text(value)||'Normal'}
function normalizeItems(items){
return(Array.isArray(items)?items:[]).map((item,index)=>({
numero:index+1,
codigo:text(item.codigo??item.materialCodigo??item.material_codigo??item.producto?.codigo),
descripcion:text(item.descripcion??item.desc??item.producto?.descripcion??item.producto?.desc),
marca:text(item.marca??item.producto?.marca),
categoria:text(item.categoria??item.producto?.categoria),
unidad:text(item.unidad??item.producto?.unidad),
cantidad:number(item.cantidadPendiente??item.pendiente??item.cantidad??item.cantidadSolicitada??item.cantidad_solicitada),
precio:number(item.precio??item.precioUnitario??item.precio_unitario??item.producto?.precio),
almacen:text(item.almacenNombre??item.almacen??item.bodega??item.bodegaDestino),
almacenId:Number(item.almacenId??item.almacen_id??0)||null,
existencia:number(item.existenciaActual??item.stockAlmacen??item.stock),
minimo:number(item.stockMinimo??item.stockMinimoAlmacen??item.stock_minimo),
medio:number(item.stockMedio??item.stockMedioAlmacen??item.stock_medio),
maximo:number(item.stockMaximo??item.stockMaximoAlmacen??item.stock_maximo),
solicitudCompraId:Number(item.solicitudCompraId??item.solicitud_compra_id??item.idSolicitud??item.id??0)||null,
folioSolicitud:text(item.folioSolicitud??item.folio),
cantidadSolicitada:number(item.cantidadSolicitada??item.cantidad_solicitada??item.cantidad),
cantidadRecibida:number(item.cantidadRecibida??item.cantidad_recibida),
cantidadPendiente:number(item.cantidadPendiente??item.pendiente??item.cantidad??item.cantidadSolicitada??item.cantidad_solicitada)
})).filter(item=>item.codigo&&item.descripcion&&item.cantidad>0);
}
async function createPdf(data={}){
if(!window.jspdf?.jsPDF)throw new Error('No se cargó el generador de PDF.');
const items=normalizeItems(data.materiales??data.items);
const order=text(data.ordenCompra??data.orden);
if(!order)throw new Error('Escribe el número de orden de compra.');
if(!items.length)throw new Error('La orden no contiene materiales válidos.');
const payload={
version:3,
sistema:'SKILLED_CRM',
tipo:'ORDEN_COMPRA',
ordenCompra:order,
fecha:text(data.fecha),
referencia:text(data.referencia),
proyecto:text(data.proyecto),
nombreProyecto:text(data.nombreProyecto),
cliente:text(data.cliente),
responsable:text(data.responsable),
proveedor:text(data.proveedor),
contactoProveedor:text(data.contactoProveedor),
prioridad:text(data.prioridad)||'normal',
solicitadoPor:text(data.solicitadoPor),
notas:text(data.notas),
destinoTipo:text(data.destinoTipo)||(!text(data.proyecto)?'almacen_general':'proyecto'),
materiales:items.map(item=>({codigo:item.codigo,descripcion:item.descripcion,marca:item.marca,categoria:item.categoria,unidad:item.unidad,cantidad:item.cantidad,precio:item.precio,almacen:item.almacen,almacenId:item.almacenId,existencia:item.existencia,minimo:item.minimo,medio:item.medio,maximo:item.maximo,solicitudCompraId:item.solicitudCompraId,folioSolicitud:item.folioSolicitud,cantidadSolicitada:item.cantidadSolicitada,cantidadRecibida:item.cantidadRecibida,cantidadPendiente:item.cantidadPendiente}))
};
const encoded=encodePayload(payload);
const marker=`SKILLED_OC_JSON_BEGIN ${encoded} SKILLED_OC_JSON_END`;
const {jsPDF}=window.jspdf;
const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
doc.setProperties({title:`Orden de compra ${order}`,subject:marker,author:'Skilled Proyectos Industriales',keywords:`SKILLED_CRM ORDEN_COMPRA ${order}`});
const logoData=await logo();
if(logoData)doc.addImage(logoData,'PNG',14,10,58,19,undefined,'FAST');
doc.setDrawColor(0,65,107);doc.setLineWidth(.8);doc.line(14,34,196,34);
doc.setTextColor(0,65,107);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('ORDEN DE COMPRA',196,18,{align:'right'});
doc.setFontSize(10);doc.setTextColor(71,85,105);doc.text(order,196,26,{align:'right'});
doc.setFillColor(246,248,252);doc.setDrawColor(226,232,240);doc.roundedRect(14,40,182,35,2,2,'FD');
const labels=[['FECHA',dateLabel(data.fecha)],['PRIORIDAD',priorityLabel(data.prioridad)],['SOLICITADO POR',text(data.solicitadoPor)||'No especificado'],['REFERENCIA',text(data.referencia)||'Sin referencia']];
labels.forEach((pair,index)=>{const x=19+index*44;doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(100,116,139);doc.text(pair[0],x,48);doc.setFontSize(9.2);doc.setTextColor(15,23,42);doc.text(pair[1],x,55,{maxWidth:39})});
doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(100,116,139);doc.text('PROVEEDOR',19,66);doc.text('CONTACTO DEL PROVEEDOR',106,66);
doc.setFontSize(9.2);doc.setTextColor(15,23,42);doc.text(text(data.proveedor)||'Por definir',19,72,{maxWidth:80});doc.text(text(data.contactoProveedor)||'Por definir',106,72,{maxWidth:84});
doc.autoTable({
startY:82,
head:[['#','Código','Descripción','Almacén','Actual','Medio','Máximo','Comprar']],
body:items.map(item=>[item.numero,item.codigo,item.descripcion,item.almacen||'—',item.existencia,item.medio,item.maximo,`${item.cantidad} ${item.unidad||''}`.trim()]),
margin:{left:14,right:14},
styles:{font:'helvetica',fontSize:7.6,cellPadding:2.4,textColor:[30,41,59],lineColor:[221,228,238],lineWidth:.15,valign:'middle',overflow:'linebreak'},
headStyles:{fillColor:[0,65,107],textColor:[255,255,255],fontStyle:'bold',fontSize:7.2},
alternateRowStyles:{fillColor:[247,249,252]},
columnStyles:{0:{cellWidth:7,halign:'center'},1:{cellWidth:22},2:{cellWidth:55},3:{cellWidth:28},4:{cellWidth:15,halign:'right'},5:{cellWidth:15,halign:'right'},6:{cellWidth:15,halign:'right'},7:{cellWidth:25,halign:'right'}},
didDrawPage:()=>{const page=doc.internal.getNumberOfPages();const height=doc.internal.pageSize.getHeight();doc.setDrawColor(203,213,225);doc.line(14,height-15,196,height-15);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(100,116,139);doc.text('Skilled Proyectos Industriales · Documento generado por el CRM',14,height-9);doc.text(`Página ${page}`,196,height-9,{align:'right'})}
});
let y=doc.lastAutoTable.finalY+8;if(y>250){doc.addPage();y=20}
doc.setFillColor(250,250,251);doc.setDrawColor(226,232,240);doc.roundedRect(14,y,182,26,2,2,'FD');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(71,85,105);doc.text('NOTAS',19,y+7);doc.setFont('helvetica','normal');doc.setTextColor(30,41,59);doc.setFontSize(9);doc.text(text(data.notas)||'Sin notas adicionales.',19,y+13,{maxWidth:172});
doc.setTextColor(255,255,255);doc.setFontSize(.1);doc.text(`SKILLED_OC_NUMERO:${order}`,1,296,{maxWidth:208});
const filename=`OC_${safe(order)}.pdf`;
const blob=doc.output('blob');
return{doc,blob,url:URL.createObjectURL(blob),filename,order,items,payload};
}
function download(result){if(result?.doc)result.doc.save(result.filename||'Orden_de_compra.pdf')}
function revoke(result){if(result?.url?.startsWith('blob:'))URL.revokeObjectURL(result.url)}
function payloadFromMarker(value){
const match=text(value).match(markerRegex);
if(!match)return null;
try{const decoded=decodePayload(match[1]);return decoded&&lower(decoded.tipo)==='orden_compra'?decoded:null}catch(error){return null}
}
function orderFromText(value){
const raw=text(value).replace(/\s+/g,' ');
const hidden=raw.match(/SKILLED_OC_NUMERO\s*:\s*([^\s]+)/i);
if(hidden)return text(hidden[1]);
const title=raw.match(/ORDEN\s+DE\s+COMPRA\s+([A-Z0-9][A-Z0-9._\/-]{2,})/i);
if(title)return text(title[1]);
const field=raw.match(/(?:N[ÚU]MERO\s+DE\s+ORDEN|ORDEN\s+DE\s+COMPRA|ORDEN)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i);
return text(field?.[1]);
}
function orderFromFilename(name){
const base=text(name).replace(/\.pdf$/i,'').replace(/^OC[_\s-]*/i,'');
return text(base).replace(/_/g,'-');
}
async function readPdf(file){
if(!window.pdfjsLib)throw new Error('No se cargó el lector de PDF. Recarga la página con Ctrl + F5.');
window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
let payload=null;
let info={};
try{
const metadata=await pdf.getMetadata();
info=metadata?.info||{};
const candidates=[info.Subject,info.subject,info.Keywords,info.keywords,metadata?.metadata?.get?.('dc:subject'),metadata?.metadata?.get?.('pdf:Keywords')];
for(const candidate of candidates){payload=payloadFromMarker(candidate);if(payload)break}
}catch(error){}
const tokens=[];
const pages=Math.min(pdf.numPages,Math.max(3,Math.min(8,pdf.numPages)));
for(let pageNumber=1;pageNumber<=pages;pageNumber++){
const page=await pdf.getPage(pageNumber);
const content=await page.getTextContent();
content.items.forEach(item=>{const value=text(item.str);if(value)tokens.push(value)});
}
const joined=tokens.join(' ');
if(!payload)payload=payloadFromMarker(joined);
const order=text(payload?.ordenCompra)||orderFromText(joined)||orderFromFilename(file.name)||orderFromText(info.Title);
return{pdf,payload,order,text:joined,info};
}
function normalizedOrder(value){return safe(value).toLocaleLowerCase('es-MX').replace(/_/g,'-')}
async function databaseOrder(order){
if(!window.SkilledDB?.listPurchaseRequests)return{order:text(order),requests:[]};
const requests=await SkilledDB.listPurchaseRequests({});
const wanted=normalizedOrder(order);
const matches=requests.filter(item=>normalizedOrder(item.ordenCompra)===wanted&&!["cancelada","recibida"].includes(lower(item.estado))&&Math.max(0,number(item.cantidadSolicitada)-number(item.cantidadRecibida))>0);
if(matches.length)return{order:text(matches[0].ordenCompra)||text(order),requests:matches};
const direct=requests.filter(item=>lower(item.ordenCompra)===lower(order)&&!["cancelada","recibida"].includes(lower(item.estado))&&Math.max(0,number(item.cantidadSolicitada)-number(item.cantidadRecibida))>0);
return{order:text(direct[0]?.ordenCompra)||text(order),requests:direct};
}
function mergePayload(payload,orderData){
const source=payload&&typeof payload==='object'?payload:{};
const sourceItems=normalizeItems(source.materiales);
const byCode=new Map(sourceItems.map(item=>[lower(item.codigo),item]));
const requests=Array.isArray(orderData.requests)?orderData.requests:[];
const materials=requests.length?requests.map(request=>{
const original=byCode.get(lower(request.materialCodigo))||{};
const pending=Math.max(0,number(request.cantidadSolicitada)-number(request.cantidadRecibida));
return{
codigo:text(request.materialCodigo),
descripcion:text(request.descripcion)||text(original.descripcion),
marca:text(original.marca),
categoria:text(request.categoria)||text(original.categoria),
unidad:text(request.unidad)||text(original.unidad),
cantidad:pending,
cantidadPendiente:pending,
cantidadSolicitada:number(request.cantidadSolicitada),
cantidadRecibida:number(request.cantidadRecibida),
precio:number(original.precio),
almacen:text(request.almacenNombre)||text(original.almacen),
almacenId:Number(request.almacenId)||Number(original.almacenId)||null,
existencia:number(request.existenciaActual)||number(original.existencia),
minimo:number(request.stockMinimo)||number(original.minimo),
medio:number(request.stockMedio)||number(original.medio),
maximo:number(request.stockMaximo)||number(original.maximo),
solicitudCompraId:Number(request.id)||Number(original.solicitudCompraId)||null,
folioSolicitud:text(request.folio)||text(original.folioSolicitud)
};
}):sourceItems.map(item=>({...item,cantidad:item.cantidadPendiente||item.cantidad}));
const first=requests[0]||{};
return{
version:Number(source.version)||3,
sistema:'SKILLED_CRM',
tipo:'ORDEN_COMPRA',
ordenCompra:text(orderData.order)||text(source.ordenCompra),
fecha:text(first.fechaOrdenCompra)||text(source.fecha),
referencia:text(first.referencia)||text(source.referencia),
proyecto:text(source.proyecto),
nombreProyecto:text(source.nombreProyecto),
cliente:text(source.cliente),
responsable:text(source.responsable),
proveedor:text(first.proveedor)||text(source.proveedor),
contactoProveedor:text(first.contactoProveedor)||text(source.contactoProveedor),
prioridad:text(first.prioridad)||text(source.prioridad)||'normal',
solicitadoPor:text(first.solicitadoPor)||text(source.solicitadoPor),
notas:text(first.motivo)||text(source.notas),
destinoTipo:text(source.destinoTipo)||(!text(source.proyecto)?'almacen_general':'proyecto'),
materiales:materials
};
}
async function parsePdf(file){
if(!(file instanceof Blob))throw new Error('Selecciona un archivo PDF válido.');
if(file.type&&file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||''))throw new Error('Selecciona un archivo PDF.');
const read=await readPdf(file);
if(!read.order&&!read.payload?.materiales?.length)throw new Error('No se detectó el número de orden ni información estructurada en el PDF.');
let orderData={order:read.order,requests:[]};
if(read.order){
try{orderData=await databaseOrder(read.order)}catch(error){orderData={order:read.order,requests:[]}}
}
const payload=mergePayload(read.payload,orderData);
if(!payload.ordenCompra)throw new Error('No se pudo identificar el número de orden de compra.');
if(!payload.materiales.length)throw new Error(`Se identificó la orden ${payload.ordenCompra}, pero no contiene materiales pendientes en el CRM.`);
return{...read,payload,fuente:orderData.requests.length?'supabase':read.payload?'pdf_estructurado':'pdf_texto'};
}
function ensureImportInput(){
if(importInput&&document.body.contains(importInput))return importInput;
importInput=document.createElement('input');
importInput.type='file';
importInput.accept='application/pdf,.pdf';
importInput.className='hidden';
importInput.id='skilled-importar-orden-pdf';
importInput.addEventListener('change',async event=>{
const file=event.target.files?.[0];
event.target.value='';
if(!file||importing)return;
importing=true;
try{
const parsed=await parsePdf(file);
if(typeof window.agregarOrdenCompraEstandar!=='function')throw new Error('El módulo de movimientos no está preparado para recibir la orden.');
const result=await window.agregarOrdenCompraEstandar(parsed.payload);
if(!result?.ok)throw new Error(result?.mensaje||'No se pudieron cargar los materiales de la orden.');
const omissions=Array.isArray(result.omitidos)&&result.omitidos.length?`\n\nNo se cargaron:\n${result.omitidos.join('\n')}`:'';
alert(`${result.mensaje}\nFuente de lectura: ${parsed.fuente==='supabase'?'orden registrada en Supabase':'información incluida en el PDF'}.${omissions}`);
}catch(error){
console.error('Error al importar la orden de compra:',error);
alert(`No se pudo importar la orden de compra:\n${error.message}`);
}finally{importing=false}
});
document.body.appendChild(importInput);
return importInput;
}
function importar(){ensureImportInput().click()}
const api=Object.freeze({createPdf,download,revoke,normalizeItems,parsePdf,importar,decodePayload});
window.SkilledPurchaseOrders=api;
window.SkilledLowStockOrders=api;
})();
