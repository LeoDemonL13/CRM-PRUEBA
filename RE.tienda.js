(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v??'').trim(),lower=v=>text(v).toLocaleLowerCase('es-MX'),num=v=>Number(v)||0;
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=(v,c='MXN')=>new Intl.NumberFormat('es-MX',{style:'currency',currency:['MXN','USD','EUR'].includes(c)?c:'MXN'}).format(num(v));
const date=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('es-MX'):'Sin fecha';
let rows=[],groups=[],editing=null,draft=[],supplies=[],receiving=null;
function listLocked(group){return !!group&&(group.estado==='comprado'||group.items.some(i=>num(i.cantidadRecibida)>0))}
function badge(s){return({no_revisada:'<span class="profile-badge warning">Por revisar</span>',en_compra:'<span class="profile-badge info">En compra / recepción</span>',comprado:'<span class="profile-badge success">Recibida completa</span>',no_viable:'<span class="profile-badge danger">No viable</span>',cancelado:'<span class="profile-badge">Cancelada</span>'})[s]||'<span class="profile-badge">Sin estado</span>'}
function makeGroups(){const map=new Map();rows.forEach(r=>{const key=r.folio||`ST-${r.id}`;if(!map.has(key))map.set(key,{folio:key,items:[],estado:r.estado,prioridad:r.prioridad,fechaRequerida:r.fechaRequerida,solicitadoPor:r.solicitadoPor,responsableCompra:r.responsableCompra,motivoNoViable:r.motivoNoViable,notas:r.notas,createdAt:r.createdAt});map.get(key).items.push(r)});groups=[...map.values()].sort((a,b)=>String(b.folio).localeCompare(String(a.folio)))}
function filtered(){const q=lower($('search').value),s=$('state').value,p=$('priority').value;return groups.filter(g=>(!q||(window.SkilledSearch?.matches?window.SkilledSearch.matches([g.folio,g.solicitadoPor,g.responsableCompra,...g.items.flatMap(i=>[i.negocio,i.producto,i.marcaEspecifica])],q):lower(JSON.stringify(g)).includes(q)))&&(!s||g.estado===s)&&(!p||g.prioridad===p))}
function groupProgress(g){const total=g.items.length,completeItems=g.items.filter(i=>num(i.cantidadRecibida)>=num(i.cantidad)).length,partialItems=g.items.filter(i=>num(i.cantidadRecibida)>0&&num(i.cantidadRecibida)<num(i.cantidad)).length,ratio=total?g.items.reduce((s,i)=>s+Math.min(1,num(i.cantidad)?num(i.cantidadRecibida)/num(i.cantidad):0),0)/total:0;return {total,completeItems,partialItems,pct:Math.round(ratio*100),complete:total>0&&completeItems===total}}
function render(){
makeGroups();
const data=filtered();
$('m-new').textContent=groups.filter(g=>g.estado==='no_revisada').length;
$('m-buying').textContent=groups.filter(g=>g.estado==='en_compra').length;
$('m-done').textContent=groups.filter(g=>groupProgress(g).complete).length;
$('m-cost').textContent=money(groups.filter(g=>!['cancelado','no_viable'].includes(g.estado)).flatMap(g=>g.items).reduce((s,r)=>s+num(r.costoEstimado)*num(r.cantidad),0));
$('lists').innerHTML=data.length?data.map(g=>{
const total=g.items.reduce((s,i)=>s+num(i.costoEstimado)*num(i.cantidad),0),businesses=[...new Set(g.items.map(i=>i.negocio).filter(Boolean))],progress=groupProgress(g),receivedStarted=g.items.some(i=>num(i.cantidadRecibida)>0),locked=listLocked(g),inactive=['cancelado','no_viable'].includes(g.estado);
const actions=[`<button class="profile-action-button" data-print-list="${esc(g.folio)}">Hoja de compra</button>`];
if(!progress.complete&&!inactive){actions.push(`<button class="profile-action-button success" data-receive-list="${esc(g.folio)}">${receivedStarted?'Recibir pendiente':'Recibir lista'}</button>`)}
if(!locked){actions.push(`<button class="profile-action-button primary" data-edit-list="${esc(g.folio)}">Abrir lista</button>`)}
const lockNote=progress.complete?'<span class="text-[9px] text-emerald-300">Compra cerrada · solo consulta</span>':receivedStarted?'<span class="text-[9px] text-amber-300">Recepción iniciada · edición bloqueada</span>':'';
return `<article class="profile-card overflow-hidden purchase-card"><div class="purchase-card-accent"></div><div class="p-5"><div class="flex items-start justify-between gap-4"><div><div class="flex flex-wrap items-center gap-2"><span class="font-mono text-[10px] font-bold text-sky-300">${esc(g.folio)}</span>${badge(g.estado)}${g.prioridad==='urgente'?'<span class="profile-badge danger">Urgente</span>':''}</div><h2 class="mt-3 text-lg font-bold text-white">${g.items.length} artículo${g.items.length===1?'':'s'}</h2><p class="mt-1 text-xs text-gray-500">${esc(businesses.join(' · ')||'Negocio por definir')} · Requerido ${date(g.fechaRequerida)}</p></div><div class="text-right"><p class="text-[9px] uppercase tracking-widest text-gray-500">Estimado</p><p class="mt-1 text-xl font-bold text-emerald-300">${money(total)}</p></div></div><div class="mt-4 rounded-xl border border-[#1a2944] bg-[#08101f] p-3"><div class="flex items-center justify-between gap-3"><span class="text-[10px] font-semibold text-gray-300">Recepción física</span><strong class="text-[10px] ${progress.complete?'text-emerald-300':'text-sky-300'}">${progress.pct}%</strong></div><div class="purchase-progress mt-2"><i style="width:${progress.pct}%"></i></div><div class="mt-2 flex flex-wrap items-center justify-between gap-2"><p class="text-[9px] text-gray-500">${progress.completeItems} de ${progress.total} partidas completas${progress.partialItems?` · ${progress.partialItems} parcial${progress.partialItems===1?'':'es'}`:''}.</p>${lockNote}</div></div><div class="mt-4 space-y-2">${g.items.slice(0,4).map(i=>{const pending=Math.max(0,num(i.cantidad)-num(i.cantidadRecibida));return `<div class="flex items-center justify-between gap-3 rounded-xl border border-[#1a2944] bg-[#0b1222] px-3 py-2"><div class="min-w-0"><p class="truncate text-xs font-semibold text-white">${esc(i.producto)}</p><p class="mt-1 truncate text-[9px] text-gray-500">${esc(i.negocio||'Por definir')} · ${esc(i.marcaEspecifica||'Sin especificación')}</p></div><div class="text-right shrink-0"><strong class="text-xs text-gray-200">${num(i.cantidad)} ${esc(i.unidad)}</strong><p class="mt-1 text-[9px] ${pending?'text-amber-300':'text-emerald-300'}">${pending?`${pending} pendiente${pending===1?'':'s'}`:'Completo'}</p></div></div>`}).join('')}${g.items.length>4?`<p class="text-[10px] text-sky-300">+ ${g.items.length-4} artículos adicionales</p>`:''}</div></div><div class="border-t border-[#1a2944] px-5 py-3 flex flex-wrap items-center justify-between gap-2"><p class="text-[10px] text-gray-500">Solicita: ${esc(g.solicitadoPor||'No indicado')}</p><div class="flex flex-wrap gap-2">${actions.join('')}</div></div></article>`
}).join(''):'<div class="profile-card profile-empty xl:col-span-2"><div><div class="profile-empty-icon">⌕</div><p class="profile-empty-title">Sin listas</p><p class="profile-empty-copy">No hay listas de compra con los filtros actuales.</p></div></div>'
}
function renderDraft(){const total=draft.reduce((s,i)=>s+num(i.costoEstimado)*num(i.cantidad),0);$('item-count').textContent=`${draft.length} artículo${draft.length===1?'':'s'}`;$('list-total').textContent=money(total);$('items-body').innerHTML=draft.length?draft.map((i,index)=>`<tr><td>${index+1}</td><td>${esc(i.negocio||'—')}</td><td><p class="font-semibold text-white">${esc(i.producto)}</p></td><td>${esc(i.marcaEspecifica||'—')}</td><td>${i.cantidad} ${esc(i.unidad)}</td><td class="font-bold text-emerald-300">${money(num(i.costoEstimado)*num(i.cantidad))}</td><td class="text-right"><button class="profile-action-button text-rose-300" data-remove-item="${index}">Quitar</button></td></tr>`).join(''):'<tr><td colspan="7" class="py-10 text-center text-gray-500">Agrega el primer artículo.</td></tr>';$('items-cards').innerHTML=draft.length?draft.map((i,index)=>`<article class="rounded-xl border border-[#1a2944] bg-[#0a1020] p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[9px] uppercase tracking-wider text-gray-500">${esc(i.negocio||'Por definir')}</p><p class="mt-1 text-sm font-bold text-white break-words">${esc(i.producto)}</p><p class="mt-1 text-[10px] text-gray-500">${esc(i.marcaEspecifica||'Sin especificación')}</p></div><button class="profile-action-button text-rose-300 shrink-0" data-remove-item="${index}">Quitar</button></div><div class="mt-3 flex items-center justify-between gap-3 border-t border-[#1a2944] pt-3"><span class="text-xs text-gray-300">${i.cantidad} ${esc(i.unidad)}</span><strong class="text-sm text-emerald-300">${money(num(i.costoEstimado)*num(i.cantidad))}</strong></div></article>`).join(''):'<div class="py-8 text-center text-xs text-gray-500">Agrega el primer artículo.</div>'}
function findSupply(value){const q=lower(value);return supplies.find(s=>lower(s.descripcion)===q)||null}
function applySupply(){const s=findSupply($('product').value);if(!s)return;$('product').value=s.descripcion;$('brand').value=s.marca||'';$('unit').value=s.unidad||'pieza';$('cost').value=num(s.precio)||''}
function addItem(){const s=findSupply($('product').value),item={suministroId:s?.id||null,negocio:text($('business').value),producto:text($('product').value),marcaEspecifica:text($('brand').value),presentacion:'',cantidad:Math.max(.01,num($('quantity').value)||1),unidad:text($('unit').value)||'pieza',costoEstimado:Math.max(0,num($('cost').value))};if(!item.producto)return alert('Captura el producto.');draft.push(item);['product','brand','cost'].forEach(id=>$(id).value='');$('business').value='';$('quantity').value=1;$('unit').value='pieza';$('product').focus();renderDraft()}
function open(group=null){
if(group&&listLocked(group))return alert(group.estado==='comprado'?'Esta compra ya fue recibida y cerrada. Solo puedes consultar o imprimir la hoja de compra.':'Esta lista ya tiene una recepción registrada. Para proteger el inventario ya no se puede editar; únicamente puedes recibir lo pendiente o consultar la hoja de compra.');
editing=group;draft=group?group.items.map(i=>({...i})):[];$('modal-title').textContent=group?'Editar lista de compra':'Nueva lista de compra';$('requested-by').value=group?.solicitadoPor||'';$('buyer').value=group?.responsableCompra||'';$('required').value=group?.fechaRequerida||'';$('item-priority').value=group?.prioridad||'normal';$('item-state').value=group?.estado||'no_revisada';$('not-viable').value=group?.motivoNoViable||'';$('notes').value=group?.notas||'';['business','product','brand','cost'].forEach(id=>$(id).value='');$('quantity').value=1;$('unit').value='pieza';$('delete-list').classList.toggle('hidden',!group);$('print-modal').classList.toggle('hidden',!group);renderDraft();$('modal').classList.remove('hidden');$('modal').classList.add('flex')
}
function close(){$('modal').classList.add('hidden');$('modal').classList.remove('flex');editing=null;draft=[]}
async function save(){if(editing&&listLocked(editing))return alert('Esta lista ya tiene recepción registrada y quedó bloqueada para edición.');if(!draft.length)return alert('Agrega al menos un artículo.');const state=$('item-state').value,motive=text($('not-viable').value);if(state==='no_viable'&&!motive)return alert('Captura el motivo por el que la compra no es viable.');const b=$('save');b.disabled=true;try{const folio=editing?.folio||`ST-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(Date.now()).slice(-6)}`;if(editing){const existingIds=new Set(draft.map(i=>Number(i.id)).filter(Boolean));for(const old of editing.items)if(!existingIds.has(Number(old.id)))await SkilledDB.deleteStoreRequest(old.id)}for(const item of draft)await SkilledDB.saveStoreRequest({id:item.id,folio,suministroId:item.suministroId,negocio:item.negocio||'Por definir',producto:item.producto,marcaEspecifica:item.marcaEspecifica,presentacion:item.presentacion,cantidad:item.cantidad,unidad:item.unidad,costoEstimado:item.costoEstimado,fechaRequerida:$('required').value,prioridad:$('item-priority').value,estado:state,solicitadoPor:$('requested-by').value,responsableCompra:$('buyer').value,motivoNoViable:motive,notas:$('notes').value});close();await load()}catch(e){alert(e.message)}finally{b.disabled=false}}
async function removeList(){if(!editing||!confirm(`¿Eliminar la lista ${editing.folio} y sus ${editing.items.length} artículos?`))return;try{for(const item of editing.items)await SkilledDB.deleteStoreRequest(item.id);close();await load()}catch(e){alert(e.message)}}
function openReceive(group){receiving=group;$('receive-title').textContent=`Recibir ${group.folio}`;$('received-by').value='';$('receive-items').innerHTML=group.items.map(i=>{const pending=Math.max(0,num(i.cantidad)-num(i.cantidadRecibida)),supply=findSupply(i.producto);return `<tr data-receive-row="${i.id}"><td><strong class="text-white">${esc(i.producto)}</strong><div class="mt-1 text-[9px] ${supply||i.suministroId?'text-emerald-300':'text-amber-300'}">${supply||i.suministroId?'Vinculado a Suministros':'Sin vínculo automático con Suministros'}</div></td><td>${num(i.cantidad)} ${esc(i.unidad)}</td><td>${num(i.cantidadRecibida)}</td><td><input data-receive-qty type="number" min="0" max="${pending}" step="any" value="${pending}" class="field compact"></td><td><input data-receive-price type="number" min="0" step="0.01" value="${num(i.precioUltimo||i.costoEstimado)}" class="field compact"></td><td>${pending?'<span class="profile-badge warning">Pendiente</span>':'<span class="profile-badge success">Completo</span>'}</td></tr>`}).join('');$('receive-modal').classList.remove('hidden');$('receive-modal').classList.add('flex')}
function closeReceive(){$('receive-modal').classList.add('hidden');$('receive-modal').classList.remove('flex');receiving=null}
function receiveAll(){if(!receiving)return;[...$('receive-items').querySelectorAll('[data-receive-row]')].forEach(row=>{const item=receiving.items.find(i=>Number(i.id)===Number(row.dataset.receiveRow)),input=row.querySelector('[data-receive-qty]');if(item&&input)input.value=Math.max(0,num(item.cantidad)-num(item.cantidadRecibida))})}
async function saveReceive(){if(!receiving)return;const items=[...$('receive-items').querySelectorAll('[data-receive-row]')].map(row=>({itemId:Number(row.dataset.receiveRow),cantidad:num(row.querySelector('[data-receive-qty]').value),precioUnitario:num(row.querySelector('[data-receive-price]').value)})).filter(x=>x.cantidad>0);if(!items.length)return alert('Captura al menos una cantidad recibida.');$('save-receive').disabled=true;try{await SkilledDB.receiveReceptionStoreListV108(receiving.folio,items,$('received-by').value);closeReceive();await load();alert('Recepción registrada. Las existencias vinculadas fueron actualizadas.') }catch(e){alert(e.message)}finally{$('save-receive').disabled=false}}
function printGroup(group){
if(!group)return;
const total=group.items.reduce((s,i)=>s+num(i.costoEstimado)*num(i.cantidad),0),w=window.open('','_blank','width=1100,height=850');
if(!w)return alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
const PAGE_ROWS=12,items=[...group.items],chunks=[];
for(let i=0;i<items.length;i+=PAGE_ROWS)chunks.push(items.slice(i,i+PAGE_ROWS));
if(!chunks.length)chunks.push([]);
const pageCount=chunks.length;
const pagesHtml=chunks.map((chunk,pageIndex)=>{
const rowsHtml=chunk.map((i,index)=>{
const absoluteIndex=pageIndex*PAGE_ROWS+index;
return `<tr><td class="n">${String(absoluteIndex+1).padStart(2,'0')}</td><td class="product"><b>${esc(i.producto)}</b>${i.marcaEspecifica?`<small>${esc(i.marcaEspecifica)}</small>`:''}</td><td class="business">${esc(i.negocio||'Por definir')}</td><td class="center">${num(i.cantidad).toLocaleString('es-MX')} ${esc(i.unidad)}</td><td class="money">${money(i.costoEstimado,i.moneda)}</td><td class="money">${money(num(i.costoEstimado)*num(i.cantidad),i.moneda)}</td><td class="check">□</td></tr>`;
}).join('');
const isLast=pageIndex===pageCount-1;
return `<section class="sheet">
<div class="top"><div class="brand"><img src="logo-reporte.png" alt="Skilled"></div><div class="doc"><h1>HOJA DE COMPRA</h1><p>Recepción · Skilled Proyectos Industriales</p></div></div>
<div class="stripe"></div>
<div class="meta"><div><label>Folio</label><strong>${esc(group.folio)}</strong></div><div><label>Fecha requerida</label><strong>${date(group.fechaRequerida)}</strong></div><div><label>Solicitado por</label><strong>${esc(group.solicitadoPor||'—')}</strong></div><div><label>Responsable</label><strong>${esc(group.responsableCompra||'—')}</strong></div></div>
<div class="summary"><strong>Lista de adquisición · ${group.items.length} partida${group.items.length===1?'':'s'}</strong><span>${pageCount>1?`Página ${pageIndex+1} de ${pageCount} · `:''}Verificar cantidad y precio antes de recibir</span></div>
<table><colgroup><col class="c-num"><col class="c-product"><col class="c-business"><col class="c-qty"><col class="c-price"><col class="c-total"><col class="c-check"></colgroup><thead><tr><th>#</th><th>Producto / especificación</th><th>Negocio</th><th>Cantidad</th><th>P. unitario</th><th>Importe</th><th>✓</th></tr></thead><tbody>${rowsHtml}</tbody></table>
${isLast?`<div class="total"><div><small>Total estimado</small><strong>${money(total)}</strong></div></div><div class="notes"><label>Notas / observaciones de compra</label><p>${esc(group.notas||'')}</p></div><div class="sign"><div>Solicitó</div><div>Responsable de compra</div><div>Entrega a Recepción</div></div>`:`<div class="continuation">Continúa en la página ${pageIndex+2}</div>`}
<div class="foot"><span>Documento regenerado desde el CRM · No se almacena PDF</span><span>${esc(group.folio)}${pageCount>1?` · ${pageIndex+1}/${pageCount}`:''}</span></div>
</section>`;
}).join('');
w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(group.folio)}</title><style>
@page{size:215.9mm 279.4mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#d9dde3}
body{font-family:Arial,Helvetica,sans-serif;color:#172033}
.sheet{width:215.9mm;min-height:279.4mm;margin:0 auto 8mm;background:#fff;padding:12mm 13mm 11mm;display:flex;flex-direction:column;overflow:hidden}
.top{display:grid;grid-template-columns:42mm 1fr;align-items:center;border:1px solid #cbd5e1;border-radius:3mm;overflow:hidden;flex:0 0 auto}
.brand{height:24mm;padding:4mm 5mm;display:flex;align-items:center;border-right:1px solid #cbd5e1;background:#fff}
.brand img{display:block;width:31mm;max-height:15mm;object-fit:contain}
.doc{min-height:24mm;padding:4mm 5mm;text-align:right;background:#f8fafc;display:flex;flex-direction:column;justify-content:center}
.doc h1{margin:0;color:#00416b;font-size:18pt;line-height:1.05;letter-spacing:.02em}
.doc p{margin:1.5mm 0 0;font-size:7pt;color:#64748b;text-transform:uppercase;letter-spacing:.11em}
.stripe{height:1.6mm;background:linear-gradient(90deg,#00416b 0 72%,#ea0029 72%);flex:0 0 auto}
.meta{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:2mm;margin:3mm 0}
.meta div{border:1px solid #dbe3ec;border-radius:2mm;padding:2.4mm 2.7mm;min-height:13mm}
.meta label{display:block;font-size:5.8pt;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.meta strong{display:block;margin-top:1.3mm;font-size:8.2pt;line-height:1.15;color:#111827;overflow-wrap:anywhere}
.summary{display:flex;justify-content:space-between;align-items:center;gap:4mm;margin:1.5mm 0 2.2mm;padding:2.2mm 2.7mm;border-left:1.2mm solid #00416b;background:#f1f5f9}
.summary strong{font-size:8.2pt}
.summary span{font-size:6.5pt;color:#64748b;text-align:right}
table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:7.1pt;border:1px solid #cbd5e1;border-radius:2mm;overflow:hidden}
col.c-num{width:5%}col.c-product{width:34%}col.c-business{width:14%}col.c-qty{width:13%}col.c-price{width:12%}col.c-total{width:14%}col.c-check{width:8%}
thead{display:table-header-group}
thead th{background:#00416b;color:#fff;text-transform:uppercase;letter-spacing:.045em;font-size:5.8pt;padding:2.2mm 1.5mm;text-align:left;line-height:1.12}
td{border-top:1px solid #e2e8f0;padding:2.3mm 1.5mm;vertical-align:middle;line-height:1.18;overflow-wrap:anywhere}
tbody tr{break-inside:avoid;page-break-inside:avoid}
tbody tr:nth-child(even){background:#f8fafc}
td b{font-size:7.2pt}
td small{display:block;margin-top:1mm;color:#64748b;font-size:5.9pt}
.n{color:#64748b;text-align:center}
.center{text-align:center}
.money{text-align:right;white-space:nowrap;font-size:6.8pt}
.check{text-align:center;font-size:12pt}
.business{font-size:6.6pt}
.total{display:flex;justify-content:flex-end;margin-top:2.4mm}
.total div{min-width:48mm;border:1px solid #cbd5e1;border-radius:2mm;padding:2.4mm 3mm;text-align:right;background:#fbfdff}
.total small{display:block;color:#64748b;font-size:5.8pt;text-transform:uppercase;letter-spacing:.07em}
.total strong{display:block;color:#00416b;font-size:12pt;margin-top:.8mm}
.notes{margin-top:2.8mm;border:1px solid #dbe3ec;border-radius:2mm;padding:2.5mm 3mm;min-height:17mm}
.notes label{font-size:5.8pt;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.06em}
.notes p{font-size:7pt;margin:1.5mm 0 0;white-space:pre-wrap;line-height:1.3}
.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:9mm;margin-top:auto;padding-top:12mm;text-align:center}
.sign div{border-top:1px solid #64748b;padding-top:1.7mm;font-size:6.5pt}
.continuation{margin-top:auto;padding-top:8mm;text-align:right;color:#64748b;font-size:6.4pt}
.foot{display:flex;justify-content:space-between;gap:4mm;margin-top:4mm;padding-top:2mm;border-top:1px solid #e2e8f0;font-size:5.6pt;color:#94a3b8}
@media print{
html,body{width:215.9mm;background:#fff!important}
.sheet{margin:0;width:215.9mm;height:279.4mm;min-height:279.4mm;page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}
}
</style></head><body>${pagesHtml}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
w.document.close()
}
async function load(){try{const [store,supplyRows]=await Promise.all([SkilledDB.listStoreRequests(),SkilledDB.listReceptionSupplies()]);rows=store;supplies=supplyRows;$('supplies-options').innerHTML=supplies.map(s=>`<option value="${esc(s.descripcion)}">${esc(s.marca||'Sin marca')} · ${esc(s.ubicacion||'Sin ubicación')}</option>`).join('');render()}catch(e){$('lists').innerHTML=`<div class="profile-card profile-empty xl:col-span-2"><p class="text-rose-300">${esc(e.message)}</p></div>`}}
$('new').addEventListener('click',()=>open());$('refresh').addEventListener('click',load);$('lists').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-list]'),print=e.target.closest('[data-print-list]'),receive=e.target.closest('[data-receive-list]');if(edit)open(groups.find(g=>g.folio===edit.dataset.editList));if(print)printGroup(groups.find(g=>g.folio===print.dataset.printList));if(receive)openReceive(groups.find(g=>g.folio===receive.dataset.receiveList))});$('product').addEventListener('change',applySupply);$('product').addEventListener('blur',applySupply);$('add-item').addEventListener('click',addItem);[$('items-body'),$('items-cards')].forEach(node=>node.addEventListener('click',e=>{const b=e.target.closest('[data-remove-item]');if(b){const item=draft[Number(b.dataset.removeItem)];if(num(item?.cantidadRecibida)>0)return alert('No puedes retirar una partida que ya tiene recepción física registrada.');draft.splice(Number(b.dataset.removeItem),1);renderDraft()}}));['search','state','priority'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));$('global-search').addEventListener('input',e=>{$('search').value=e.target.value;render()});$('close').addEventListener('click',close);$('cancel').addEventListener('click',close);$('save').addEventListener('click',save);$('delete-list').addEventListener('click',removeList);$('print-modal').addEventListener('click',()=>editing&&printGroup(editing));$('modal').addEventListener('click',e=>{if(e.target===$('modal'))close()});$('receive-close').addEventListener('click',closeReceive);$('receive-cancel').addEventListener('click',closeReceive);$('receive-all').addEventListener('click',receiveAll);$('save-receive').addEventListener('click',saveReceive);$('receive-modal').addEventListener('click',e=>{if(e.target===$('receive-modal'))closeReceive()});const initialQ=text(new URLSearchParams(location.search).get('q'));if(initialQ){$('search').value=initialQ;$('global-search').value=initialQ}load();
})();
