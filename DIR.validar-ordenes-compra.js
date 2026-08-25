(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v??'').trim(),esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],signatures=[],defaultSlot=1,busy=false,view='pending',query='';
const money=(v,m='MXN')=>new Intl.NumberFormat('es-MX',{style:'currency',currency:m||'MXN',maximumFractionDigits:2}).format(Number(v)||0);
function role(){return String(window.SkilledSession?.role||document.body.dataset.profile||'').toLowerCase()}
function home(){return role()==='gerente_general'?'GG.inicio.html':'SG.inicio.html'}
function pendingRows(){return rows.filter(r=>r.pendientesEjecutivas.length>0&&!r.miFirmaEjecutiva)}
function visibleRows(){
 const base=view==='pending'?pendingRows():rows;
 const q=query.toLowerCase();
 if(!q)return base;
 return base.filter(r=>[r.ordenCompra,r.proveedor,r.referencia,r.solicitadoPor,...r.firmasResumen.map(f=>f.nombre)].join(' ').toLowerCase().includes(q));
}
function slotsFor(row){const out=[];if(!row.revisoFirmado)out.push(['reviso','Revisó']);if(!row.aproboFirmado)out.push(['aprobo','Aprobó']);return out}
function signatureOptions(){return signatures.filter(x=>x.configurada).map(x=>`<option value="${x.slot}" ${x.slot===defaultSlot?'selected':''}>${esc(x.nombre||`Firma ${x.slot}`)}${x.slot===defaultSlot?' · predeterminada':''}</option>`).join('')}
function fmtDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?text(v):d.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}
function statusBadge(r){if(r.revisoFirmado&&r.aproboFirmado)return'<span class="approval-badge approval-ok">Validación completa</span>';if(r.miFirmaEjecutiva)return'<span class="approval-badge approval-info">Firmada por mí</span>';return`<span class="approval-badge">${r.firmadasCount}/4 firmadas</span>`}
function signatureLine(r){
 const labels={solicito:'Solicitó',elaboro:'Elaboró',reviso:'Revisó',aprobo:'Aprobó'};
 const map=new Map(r.firmasResumen.map(f=>[f.tipo,f]));
 return ['solicito','elaboro','reviso','aprobo'].map(k=>{const f=map.get(k);return`<span class="signature-chip ${f?'signed':'pending'}"><b>${labels[k]}</b>${f?`${esc(f.nombre||'Firmado')} · ${esc(fmtDate(f.firmadoAt))}`:'Pendiente'}</span>`}).join('');
}
function updateTabs(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('tab-pending-count').textContent=String(pendingRows().length);$('tab-all-count').textContent=String(rows.length)}
function render(){
 const pending=pendingRows();
 $('metric-pending').textContent=String(pending.length);$('metric-all').textContent=String(rows.length);$('metric-signed').textContent=String(rows.filter(r=>r.firmadasCount>0).length);$('metric-total').textContent=money(rows.reduce((s,r)=>s+r.total,0),'MXN');
 updateTabs();
 const host=$('orders'),configured=signatures.filter(x=>x.configurada),list=visibleRows();
 $('panel-title').textContent=view==='pending'?'Pendientes de mi firma':'Todas las órdenes';
 if(!list.length){host.innerHTML=`<div class="exec-empty">${view==='pending'?'No tienes órdenes de compra pendientes de firma ejecutiva.':'No se encontraron órdenes con el filtro actual.'}</div>`;return}
 host.innerHTML=list.map((r,i)=>{const sourceIndex=rows.indexOf(r),slots=slotsFor(r),canSign=!r.miFirmaEjecutiva&&slots.length>0&&configured.length>0;return `<article class="approval-card">
 <div class="approval-main"><div class="approval-top"><span class="approval-order">${esc(r.ordenCompra)}</span>${statusBadge(r)}</div><h3>${esc(r.proveedor||'Proveedor por definir')}</h3><p>${esc(r.fecha||'Fecha pendiente')}${r.referencia?` · Ref. ${esc(r.referencia)}`:''}${r.solicitadoPor?` · Solicita ${esc(r.solicitadoPor)}`:''}</p><div class="approval-meta"><span>${r.materiales} partida${r.materiales===1?'':'s'}</span><span>${money(r.total,r.moneda)}</span></div><div class="signature-summary">${signatureLine(r)}</div></div>
 <div class="approval-actions"><button type="button" class="crm-secondary" data-pdf="${sourceIndex}" ${r.pdfUrl?'':'disabled'}>${r.pdfUrl?'Ver PDF':'PDF no disponible'}</button>${canSign?`<select class="field" data-slot="${sourceIndex}">${slots.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><select class="field" data-signature="${sourceIndex}">${signatureOptions()}</select><button class="crm-primary" data-sign="${sourceIndex}">Firmar</button>`:''}</div></article>`}).join('');
 host.querySelectorAll('[data-pdf]').forEach(btn=>btn.addEventListener('click',()=>openPdf(Number(btn.dataset.pdf))));
 host.querySelectorAll('[data-sign]').forEach(btn=>btn.addEventListener('click',()=>sign(Number(btn.dataset.sign))));
}
function openPdf(index){const row=rows[index];if(!row?.pdfUrl)return;const modal=$('pdf-modal'),frame=$('pdf-frame');$('pdf-title').textContent=`Orden de compra ${row.ordenCompra}`;$('pdf-subtitle').textContent=[row.proveedor||'Proveedor por definir',row.referencia?`Ref. ${row.referencia}`:''].filter(Boolean).join(' · ');frame.src=row.pdfUrl;modal.hidden=false;requestAnimationFrame(()=>modal.classList.add('open'));document.body.classList.add('pdf-open')}
function closePdf(){const modal=$('pdf-modal'),frame=$('pdf-frame');modal.classList.remove('open');document.body.classList.remove('pdf-open');setTimeout(()=>{modal.hidden=true;frame.src='about:blank'},160)}
async function load(){try{$('status').textContent='Actualizando…';const [all,my]=await Promise.all([SkilledDB.listExecutivePurchaseOrdersV137(),SkilledDB.getMySignatures()]);rows=all;signatures=Array.isArray(my?.firmas)?my.firmas:[];defaultSlot=Number(my?.predeterminadaSlot||signatures.find(x=>x.predeterminada)?.slot||signatures.find(x=>x.configurada)?.slot||1);render();$('status').textContent=`Actualizado ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;}catch(e){console.error(e);$('orders').innerHTML=`<div class="exec-error">${esc(e.message||'No se pudieron cargar las órdenes.')}</div>`;$('status').textContent='Error de consulta'}}
async function sign(index){if(busy)return;const row=rows[index],slot=document.querySelector(`[data-slot="${index}"]`)?.value,signature=Number(document.querySelector(`[data-signature="${index}"]`)?.value||0);if(!row||!slot||!signature)return;if(!confirm(`¿Confirmas que revisaste la orden ${row.ordenCompra} y deseas firmar el espacio ${slot==='reviso'?'Revisó':'Aprobó'} con tu firma seleccionada?`))return;busy=true;try{await SkilledDB.approvePurchaseOrderWithMySignature(row.ordenCompra,slot,signature);await load()}catch(e){alert(e.message||'No se pudo firmar la orden.')}finally{busy=false}}
window.addEventListener('DOMContentLoaded',()=>{
 document.querySelector('[data-back]')?.addEventListener('click',()=>location.href=home());$('refresh')?.addEventListener('click',load);
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render()}));
 $('approval-search')?.addEventListener('input',e=>{query=text(e.target.value);render()});
 document.querySelectorAll('[data-close-pdf]').forEach(b=>b.addEventListener('click',closePdf));$('pdf-modal')?.addEventListener('click',e=>{if(e.target.id==='pdf-modal')closePdf()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('pdf-modal').hidden)closePdf()});
 load();
},{once:true});
})();
