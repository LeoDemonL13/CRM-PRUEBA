(function(){
'use strict';
const text=value=>String(value??'').trim();
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
const safe=value=>text(value).replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'ORDEN';
let logoPromise=null;
async function sourceToDataUrl(source){
const response=await fetch(source,{mode:'cors',cache:'no-store'});
if(!response.ok)throw new Error('No se pudo cargar el logo.');
const blob=await response.blob();
return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
}
async function loadLogo(){
if(logoPromise)return logoPromise;
logoPromise=(async()=>{for(const source of ['logo-reporte.png','logo-reporte.png']){try{return await sourceToDataUrl(source)}catch(error){}}return null})();
return logoPromise;
}
function formatDate(value){
const date=value?new Date(`${value}T12:00:00`):new Date();
if(Number.isNaN(date.getTime()))return text(value);
return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'long',year:'numeric'}).format(date);
}
function priority(value){return({urgente:'Urgente',normal:'Normal',critica:'Crítica',alta:'Alta',media:'Media',baja:'Baja'})[text(value).toLowerCase()]||text(value)||'Normal'}
async function createPdf(data){
if(!window.jspdf?.jsPDF)throw new Error('No se cargó el generador de PDF.');
const {jsPDF}=window.jspdf;
const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
const logo=await loadLogo();
const order=text(data.ordenCompra);
const items=(Array.isArray(data.materiales)?data.materiales:[]).map((item,index)=>({
numero:index+1,
codigo:text(item.codigo),
descripcion:text(item.descripcion??item.desc),
marca:text(item.marca),
unidad:text(item.unidad),
cantidad:number(item.cantidad),
almacen:text(item.almacenNombre??item.almacen)
}));
if(!order)throw new Error('Falta el número de orden de compra.');
if(!items.length)throw new Error('La orden no contiene materiales.');
if(logo)doc.addImage(logo,'PNG',14,11,55,18,undefined,'FAST');
doc.setDrawColor(0,65,107);
doc.setLineWidth(.8);
doc.line(14,33,196,33);
doc.setTextColor(0,65,107);
doc.setFont('helvetica','bold');
doc.setFontSize(20);
doc.text('ORDEN DE COMPRA',196,18,{align:'right'});
doc.setFontSize(10);
doc.setTextColor(71,85,105);
doc.text(order,196,25,{align:'right'});
doc.setFillColor(245,248,252);
doc.roundedRect(14,39,182,31,2,2,'F');
doc.setFontSize(8);
doc.setTextColor(100,116,139);
doc.text('FECHA',19,47);
doc.text('PRIORIDAD',67,47);
doc.text('SOLICITADO POR',113,47);
doc.text('REFERENCIA',159,47);
doc.setFontSize(10);
doc.setTextColor(15,23,42);
doc.setFont('helvetica','bold');
doc.text(formatDate(data.fecha),19,54,{maxWidth:42});
doc.text(priority(data.prioridad),67,54,{maxWidth:38});
doc.text(text(data.solicitadoPor)||'No especificado',113,54,{maxWidth:40});
doc.text(text(data.referencia)||'Sin referencia',159,54,{maxWidth:32});
doc.setFont('helvetica','normal');
doc.setFontSize(8);
doc.setTextColor(100,116,139);
doc.text('PROVEEDOR',19,63);
doc.text('CONTACTO DEL PROVEEDOR',96,63);
doc.setFont('helvetica','bold');
doc.setFontSize(9.5);
doc.setTextColor(15,23,42);
doc.text(text(data.proveedor)||'Por definir',19,68,{maxWidth:70});
doc.text(text(data.contactoProveedor)||'Por definir',96,68,{maxWidth:95});
doc.autoTable({
startY:76,
head:[['#','Código','Descripción','Marca','Unidad','Cantidad','Almacén']],
body:items.map(item=>[item.numero,item.codigo,item.descripcion,item.marca||'—',item.unidad||'—',item.cantidad,item.almacen||'—']),
margin:{left:14,right:14},
styles:{font:'helvetica',fontSize:7.6,cellPadding:2.4,textColor:[30,41,59],lineColor:[221,228,238],lineWidth:.15,valign:'middle'},
headStyles:{fillColor:[0,65,107],textColor:[255,255,255],fontStyle:'bold',fontSize:7.2},
alternateRowStyles:{fillColor:[247,249,252]},
columnStyles:{0:{cellWidth:8,halign:'center'},1:{cellWidth:25},2:{cellWidth:61},3:{cellWidth:22},4:{cellWidth:17},5:{cellWidth:18,halign:'right'},6:{cellWidth:31}},
didDrawPage:hook=>{
const page=doc.internal.getNumberOfPages();
const height=doc.internal.pageSize.getHeight();
doc.setDrawColor(203,213,225);
doc.line(14,height-15,196,height-15);
doc.setFont('helvetica','normal');
doc.setFontSize(7);
doc.setTextColor(100,116,139);
doc.text('Skilled Proyectos Industriales · Documento generado por el CRM',14,height-9);
doc.text(`Página ${page}`,196,height-9,{align:'right'});
}
});
let y=doc.lastAutoTable.finalY+8;
if(y>250){doc.addPage();y=20}
doc.setFillColor(250,250,251);
doc.setDrawColor(226,232,240);
doc.roundedRect(14,y,182,24,2,2,'FD');
doc.setFont('helvetica','bold');
doc.setFontSize(8);
doc.setTextColor(71,85,105);
doc.text('NOTAS',19,y+7);
doc.setFont('helvetica','normal');
doc.setTextColor(30,41,59);
doc.setFontSize(9);
doc.text(text(data.notas)||'Sin notas adicionales.',19,y+13,{maxWidth:172});
const filename=`OC_${safe(order)}.pdf`;
return{doc,blob:doc.output('blob'),filename,order};
}
function download(result){result.doc.save(result.filename)}
window.SkilledLowStockOrders=Object.freeze({createPdf,download});
})();
