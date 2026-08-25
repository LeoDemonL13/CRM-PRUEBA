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

function signatureImageElement(source){
return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('La imagen de firma guardada no se pudo decodificar.'));img.src=source});
}
async function prepareSignatureImage(source){
const value=text(source);
if(!value)return null;
if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value))throw new Error('La firma guardada no tiene un formato de imagen válido. Vuelve a guardarla desde Mi perfil.');
const img=await signatureImageElement(value);
const width=Math.max(1,Number(img.naturalWidth||img.width||1)),height=Math.max(1,Number(img.naturalHeight||img.height||1));
const maxW=900,maxH=270,scale=Math.min(1,maxW/width,maxH/height),cw=Math.max(1,Math.round(width*scale)),ch=Math.max(1,Math.round(height*scale));
const transparent=document.createElement('canvas');transparent.width=cw;transparent.height=ch;const tctx=transparent.getContext('2d');tctx.clearRect(0,0,cw,ch);tctx.drawImage(img,0,0,cw,ch);
const png=transparent.toDataURL('image/png');
const opaque=document.createElement('canvas');opaque.width=cw;opaque.height=ch;const octx=opaque.getContext('2d');octx.fillStyle='rgb(248,249,250)';octx.fillRect(0,0,cw,ch);octx.drawImage(transparent,0,0);const jpeg=opaque.toDataURL('image/jpeg',0.94);
return{png,jpeg,width:cw,height:ch};
}
async function prepareSignatureRows(rows=[]){
const source=Array.isArray(rows)?rows:[];
return Promise.all(source.map(async row=>{const copy={...(row||{})};if(text(copy.firmaDataUrl)){try{copy._pdfImage=await prepareSignatureImage(copy.firmaDataUrl)}catch(error){copy._pdfImageError=error}}return copy}));
}
function drawSignatureImage(doc,row,x,sy,boxW){
if(!text(row?.firmaDataUrl))return;
if(row?._pdfImageError)throw row._pdfImageError;
const prepared=row?._pdfImage;
if(!prepared)throw new Error('La firma existe, pero no pudo prepararse para el PDF.');
const maxW=boxW-8,maxH=14,ratio=Math.max(.1,Number(prepared.width||1)/Math.max(1,Number(prepared.height||1)));let iw=maxW,ih=iw/ratio;if(ih>maxH){ih=maxH;iw=ih*ratio}
const px=x+(boxW-iw)/2,py=sy+7+(maxH-ih)/2;let firstError=null;
try{doc.addImage(prepared.png,'PNG',px,py,iw,ih,undefined,'FAST');return}catch(error){firstError=error}
try{doc.addImage(prepared.jpeg,'JPEG',px,py,iw,ih,undefined,'FAST');return}catch(error){throw new Error(`No se pudo insertar la imagen de firma en el PDF. ${text(error?.message)||text(firstError?.message)||'Error de imagen.'}`)}
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
codigoMarca:text(item.codigoMarca??item.codigo_marca??item.modelo??item.producto?.codigoMarca??item.producto?.codigo_marca??item.producto?.modelo),
modelo:text(item.codigoMarca??item.codigo_marca??item.modelo??item.producto?.codigoMarca??item.producto?.codigo_marca??item.producto?.modelo),
categoria:text(item.categoria??item.producto?.categoria),
unidad:text(item.unidad??item.producto?.unidad),
cantidad:number(item.cantidadPendiente??item.pendiente??item.cantidad??item.cantidadSolicitada??item.cantidad_solicitada),
precio:number(item.precio??item.precioUnitario??item.precio_unitario??item.precioCotizado??item.precio_cotizado??item.producto?.precio),
moneda:text(item.moneda)||'MXN',
plazoEntregaDias:Math.max(0,Math.round(number(item.plazoEntregaDias??item.plazo_entrega_dias))),
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
const rawSignatures=Array.isArray(data.firmas)?data.firmas:[];for(const row of rawSignatures){if(text(row?.firmadoAt)&&!text(row?.firmaDataUrl))throw new Error(`La aprobación ${text(row?.tipo)||''} tiene fecha de firma pero no contiene la imagen. El PDF no se generará incompleto.`)}const preparedSignatures=await prepareSignatureRows(rawSignatures);
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
materiales:items.map(item=>({codigo:item.codigo,descripcion:item.descripcion,marca:item.marca,codigoMarca:item.codigoMarca,modelo:item.modelo,categoria:item.categoria,unidad:item.unidad,cantidad:item.cantidad,precio:item.precio,moneda:item.moneda,plazoEntregaDias:item.plazoEntregaDias,almacen:item.almacen,almacenId:item.almacenId,existencia:item.existencia,minimo:item.minimo,medio:item.medio,maximo:item.maximo,solicitudCompraId:item.solicitudCompraId,folioSolicitud:item.folioSolicitud,cantidadSolicitada:item.cantidadSolicitada,cantidadRecibida:item.cantidadRecibida,cantidadPendiente:item.cantidadPendiente}))
};
const encoded=encodePayload(payload);
const marker=`SKILLED_OC_JSON_BEGIN ${encoded} SKILLED_OC_JSON_END`;
const {jsPDF}=window.jspdf;
const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
doc.setProperties({title:`Orden de compra ${order}`,subject:marker,author:'Skilled Proyectos Industriales',keywords:`SKILLED_CRM ORDEN_COMPRA ${order}`});
const logoData=await logo();
if(logoData)doc.addImage(logoData,'PNG',14,9,48,16,undefined,'FAST');
doc.setTextColor(0,65,107);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('Skilled Proyectos Industriales',14,33);
doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(45,76,102);doc.text('Dirección: Álamo 29, int 5, Sanctorum, Cuautlancingo Puebla, C.P. 72730',14,39,{maxWidth:92});doc.text('RFC: SPI190610JE5',14,44);doc.text('Tel: 222 639 0740',14,49);doc.text('Correo: facturacion@skilled.mx',14,54);
doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(0,65,107);doc.text('Orden de compra',116,17);doc.text('Fecha',156,17);doc.text('Referencia',177,17);
doc.setFontSize(9);doc.setTextColor(234,0,41);doc.text(order,116,23,{maxWidth:37});doc.setTextColor(45,76,102);doc.text(dateLabel(data.fecha),156,23,{maxWidth:19});doc.text(text(data.referencia)||'—',177,23,{maxWidth:19});
doc.setFont('helvetica','bold');doc.setTextColor(0,65,107);doc.setFontSize(8);doc.text('Proveedor',116,34);doc.setFont('helvetica','normal');doc.setTextColor(45,76,102);doc.setFontSize(8);doc.text(text(data.proveedor)||'Por definir',116,40,{maxWidth:80});doc.setFont('helvetica','bold');doc.text('Contacto:',116,47);doc.setFont('helvetica','normal');doc.text(text(data.contactoProveedor)||'Por definir',134,47,{maxWidth:62});doc.setFont('helvetica','bold');doc.text('Solicita:',14,62);doc.setFont('helvetica','normal');doc.text(text(data.solicitadoPor)||'No especificado',30,62,{maxWidth:65});
const subtotal=items.reduce((sum,item)=>sum+(number(item.precio)*number(item.cantidad)),0);const iva=subtotal*.16;const total=subtotal+iva;const currency=(items.find(item=>item.moneda)?.moneda||'MXN').toUpperCase();
doc.autoTable({
startY:69,
head:[['Pos','Descripción','Modelo','T.E.','Cant.','UM','PU','Total']],
body:items.map(item=>[String(item.numero).padStart(2,'0'),item.descripcion,item.codigoMarca||item.modelo||'—',item.plazoEntregaDias||'—',number(item.cantidad).toLocaleString('es-MX'),item.unidad||'PIEZA',number(item.precio).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}),number(item.precio*item.cantidad).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})]),
margin:{left:14,right:14},
styles:{font:'helvetica',fontSize:6.9,cellPadding:2.1,textColor:[35,66,91],lineColor:[190,198,207],lineWidth:.12,valign:'middle',overflow:'linebreak'},
headStyles:{fillColor:[239,241,243],textColor:[0,65,107],fontStyle:'bold',fontSize:7},
alternateRowStyles:{fillColor:[255,255,255]},
columnStyles:{0:{cellWidth:9,halign:'center'},1:{cellWidth:62},2:{cellWidth:31},3:{cellWidth:12,halign:'center'},4:{cellWidth:14,halign:'right'},5:{cellWidth:18,halign:'center'},6:{cellWidth:18,halign:'right'},7:{cellWidth:18,halign:'right'}},
didDrawPage:()=>{const page=doc.internal.getNumberOfPages();const height=doc.internal.pageSize.getHeight();doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(80,105,126);doc.text('SK-F-COM-003-R02',14,height-8);doc.text('Orden de compra',105,height-8,{align:'center'});doc.text(`Página ${page}`,196,height-8,{align:'right'})}
});
let y=doc.lastAutoTable.finalY+5;if(y>214){doc.addPage();y=20}
doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(0,65,107);doc.text(`Moneda: ${currency}`,14,y+4);doc.text('Condiciones de pago:',14,y+11);doc.setFont('helvetica','normal');doc.text(text(data.condicionesPago)||'Por definir',45,y+11);doc.setFont('helvetica','bold');doc.text('Ubicación de entrega:',14,y+18);doc.setFont('helvetica','normal');doc.text(text(data.ubicacionEntrega)||text(items[0]?.almacen)||'Por definir',48,y+18,{maxWidth:100});doc.setFont('helvetica','bold');doc.text('Comentarios y/o observaciones:',14,y+25);doc.setFont('helvetica','normal');doc.text(text(data.notas)||'Ninguna',59,y+25,{maxWidth:91});
const tx=156,tw=40;doc.setDrawColor(180,190,200);doc.setFillColor(248,249,250);doc.rect(tx,y,tw,28,'FD');[['Sub total:',subtotal],['IVA:',iva],['Total:',total]].forEach((row,index)=>{const yy=y+7+index*8;doc.setFont('helvetica','bold');doc.setFontSize(7.4);doc.setTextColor(0,65,107);doc.text(row[0],tx+2,yy);doc.setTextColor(234,0,41);doc.text(`$ ${number(row[1]).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`,tx+tw-2,yy,{align:'right'})});
let sy=y+34;if(sy>249){doc.addPage();sy=22}const signatureTypes=['solicito','elaboro','reviso','aprobo'];const signatureLabels={solicito:'Solicitó:',elaboro:'Elaboró:',reviso:'Revisó:',aprobo:'Aprobó:'};const signatures=preparedSignatures;const boxW=45.5,boxH=32;signatureTypes.forEach((type,index)=>{const x=14+index*boxW,row=signatures.find(s=>text(s.tipo)===type)||{};doc.setDrawColor(170,180,190);doc.setFillColor(248,249,250);doc.rect(x,sy,boxW,boxH,'FD');doc.setFont('helvetica','bold');doc.setFontSize(7.2);doc.setTextColor(0,65,107);doc.text(signatureLabels[type],x+2,sy+5);if(row.firmaDataUrl)drawSignatureImage(doc,row,x,sy,boxW);doc.setFont('helvetica','normal');doc.setFontSize(6.6);doc.setTextColor(45,76,102);doc.text(text(row.nombre)||'',x+boxW/2,sy+25,{align:'center',maxWidth:boxW-5});if(row.firmadoAt){const d=new Date(row.firmadoAt);if(!Number.isNaN(d.getTime()))doc.setFontSize(5.6),doc.text(d.toLocaleDateString('es-MX'),x+boxW/2,sy+29,{align:'center'})}else if(row.pendiente&&row.nombre){doc.setFont('helvetica','italic');doc.setFontSize(5.4);doc.setTextColor(120,130,140);doc.text('Pendiente de firma',x+boxW/2,sy+29,{align:'center'})}});
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
codigoMarca:text(request.codigoMarcaModelo??request.codigo_marca_modelo??original.codigoMarca??original.codigo_marca??original.modelo),
modelo:text(request.codigoMarcaModelo??request.codigo_marca_modelo??original.codigoMarca??original.codigo_marca??original.modelo),
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
