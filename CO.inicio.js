(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v??'').trim(),num=v=>Number(v)||0;
const esc=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const date=v=>{if(!v)return'—';const d=new Date(`${v}`.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})};
const money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(num(v));
let quotes=[],providers=[],providerMaterials=[],services=[];
function empty(t,c){return`<div class="profile-empty"><div><div class="profile-empty-icon">✓</div><p class="profile-empty-title">${esc(t)}</p><p class="profile-empty-copy">${esc(c)}</p></div></div>`}
function quoteBadge(s){const map={solicitada:['warning','Solicitada'],en_revision:['info','En revisión'],cotizando:['accent','Cotizando'],comparada:['success','Comparada'],aprobada:['success','Aprobada'],rechazada:['danger','Rechazada'],cerrada:['','Cerrada']};const v=map[s]||['','Pendiente'];return`<span class="profile-badge ${v[0]}">${v[1]}</span>`}
function supplierStats(){const by=new Map();providerMaterials.filter(x=>x.activo!==false).forEach(x=>{const k=Number(x.proveedorId);if(!by.has(k))by.set(k,{count:0,priced:0,days:0});const r=by.get(k);r.count++;if(x.precioUnitario>0)r.priced++;if(x.plazoEntregaDias>0)r.days++});return by}
function render(){
 const open=quotes.filter(q=>['solicitada','en_revision','cotizando'].includes(q.estado));
 $('co-suppliers').textContent=providers.filter(p=>p.estado!=='inactivo').length.toLocaleString('es-MX');
 $('co-attention').textContent=open.length.toLocaleString('es-MX');
 $('co-purchased').textContent=quotes.filter(q=>q.estado==='aprobada').length.toLocaleString('es-MX');
 const now=new Date(),due=services.filter(s=>s.estado==='activo'&&new Date(`${s.proximaFechaPago}T23:59:59`)<=new Date(now.getTime()+num(s.anticipacionDias)*86400000));
 $('co-services').textContent=due.length.toLocaleString('es-MX');
 $('co-order-list').innerHTML=quotes.filter(q=>q.estado!=='aprobada'&&q.estado!=='cerrada').slice(0,8).map(q=>`<div class="profile-list-item"><div><p class="profile-list-title">${esc(q.folio)}</p><p class="profile-list-meta">${(q.items||[]).length} material${(q.items||[]).length===1?'':'es'} · ${esc(q.solicitadoPor||'Almacén')} · requerida ${date(q.fechaRequerida)}</p></div><div class="text-right">${quoteBadge(q.estado)}<a href="CO.cotizaciones.html?id=${encodeURIComponent(q.id)}" class="mt-2 block text-[9px] font-bold text-sky-300">Comparar</a></div></div>`).join('')||empty('Sin cotizaciones pendientes','Las solicitudes de Bajo mínimo aparecerán aquí automáticamente.');
 $('co-service-list').innerHTML=due.sort((a,b)=>new Date(a.proximaFechaPago)-new Date(b.proximaFechaPago)).slice(0,7).map(s=>`<div class="profile-list-item"><div><p class="profile-list-title">${esc(s.nombre)}</p><p class="profile-list-meta">${esc(s.proveedor||s.tipo)} · vence ${date(s.proximaFechaPago)}</p></div><div class="text-right"><span class="profile-badge danger">${money(s.montoEstimado)}</span><a href="CO.servicios.html?q=${encodeURIComponent(s.nombre)}" class="mt-2 block text-[9px] font-bold text-sky-300">Abrir</a></div></div>`).join('')||empty('Sin pagos próximos','No hay servicios dentro de su periodo de aviso.');
 const stats=supplierStats();
 $('co-supplier-list').innerHTML=providers.filter(p=>p.estado!=='inactivo').map(p=>({p,s:stats.get(Number(p.id))||{count:0,priced:0,days:0}})).sort((a,b)=>b.s.count-a.s.count).slice(0,7).map(({p,s})=>`<div class="profile-list-item"><div><p class="profile-list-title">${esc(p.nombre_comercial||p.razon_social)}</p><p class="profile-list-meta">${esc(p.contacto||'Contacto pendiente')} · ${s.priced}/${s.count} materiales con precio</p></div><span class="profile-badge info">${s.count} materiales</span></div>`).join('')||empty('Sin proveedores','Agrega proveedores y carga sus materiales, precios y plazos.');
}
async function load(){try{
 await SkilledDB.generateServiceAlerts().catch(()=>0);
 const out=await Promise.allSettled([
   SkilledDB.listQuotationRequests({}),
   SkilledDB.client.from('co_proveedores').select('*').order('razon_social',{ascending:true}),
   SkilledDB.listProviderMaterials({activeOnly:true}),
   SkilledDB.listServices()
 ]);
 if(out[0].status==='rejected')throw out[0].reason;
 quotes=out[0].value||[];
 providers=out[1].status==='fulfilled'&&!out[1].value.error?(out[1].value.data||[]):[];
 providerMaterials=out[2].status==='fulfilled'?out[2].value:[];
 services=out[3].status==='fulfilled'?out[3].value:[];
 render();
}catch(e){['co-order-list','co-service-list','co-supplier-list'].forEach(id=>{if($(id))$(id).innerHTML=`<div class="profile-notice">${esc(e.message)}</div>`})}}
$('refresh')?.addEventListener('click',load);load();
})();
