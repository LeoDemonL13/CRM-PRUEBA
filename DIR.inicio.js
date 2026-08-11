(function(){
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),num=v=>Number(v)||0;
const money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(num(v));
function roleLabel(){return String(window.SkilledSession?.role||'')==='gerente_general'?'Gerencia General':'Subgerencia'}
function tone(value){return value>0?'text-rose-300':value<0?'text-emerald-300':'text-gray-300'}
function render(rows){
 const active=rows.filter(r=>!['completado','completada','cerrado','cerrada','cancelado','cancelada'].includes(String(r.estado||'').toLowerCase()));
 const mat=rows.reduce((s,r)=>s+num(r.material_real),0), pay=rows.reduce((s,r)=>s+num(r.nomina_real),0), planned=rows.reduce((s,r)=>s+num(r.total_planeado),0), actual=rows.reduce((s,r)=>s+num(r.total_real),0), deviation=actual-planned;
 $('metric-active').textContent=active.length.toLocaleString('es-MX'); $('metric-material').textContent=money(mat); $('metric-payroll').textContent=money(pay); $('metric-total').textContent=money(actual); $('metric-deviation').textContent=money(deviation); $('metric-deviation').className=`metric-value ${tone(deviation)}`;
 const attention=[...rows].sort((a,b)=>num(b.desviacion_total)-num(a.desviacion_total)).slice(0,6);
 $('project-list').innerHTML=attention.length?attention.map(r=>`<a href="${roleLabel()==='Gerencia General'?'GG':'SG'}.proyectos.html?proyecto=${encodeURIComponent(r.proyecto)}" class="exec-row"><div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="font-mono text-[10px] text-sky-300">${esc(r.proyecto)}</span><span class="exec-status">${esc(r.estado||'Sin estado')}</span></div><p class="mt-1 text-sm font-bold text-white">${esc(r.nombre||'Proyecto')}</p><p class="mt-1 text-[10px] text-gray-500">${esc(r.cliente||'Sin cliente')} · ${esc(r.responsable||'Sin responsable')}</p><div class="mt-2 flex flex-wrap gap-2 text-[9px]"><span class="rounded-lg border border-sky-500/20 bg-sky-950/10 px-2 py-1 text-sky-200">Materiales ${money(r.material_real)}</span><span class="rounded-lg border border-violet-500/20 bg-violet-950/10 px-2 py-1 text-violet-200">Sueldos ${money(r.nomina_real)}</span></div></div><div class="text-right shrink-0"><p class="text-[9px] uppercase tracking-widest text-gray-600">Gasto del proyecto</p><p class="mt-1 text-sm font-bold text-white">${money(r.total_real)}</p><p class="mt-1 text-[9px] text-gray-500">Planeado ${money(r.total_planeado)}</p><p class="mt-1 text-[10px] ${tone(r.desviacion_total)}">${num(r.desviacion_total)>0?'+':''}${money(r.desviacion_total)}</p><span class="mt-2 inline-block text-[9px] text-blue-300">Ver detalle →</span></div></a>`).join(''):'<div class="profile-empty py-10"><div><p class="profile-empty-title">Sin proyectos</p><p class="profile-empty-copy">Cuando existan proyectos aparecerán aquí.</p></div></div>';
 $('subtitle-role').textContent=roleLabel();
}
async function load(){try{const rows=await SkilledDB.getExecutiveProjectSummary();render(rows||[])}catch(e){$('project-list').innerHTML=`<div class="p-5 text-sm text-rose-300">${esc(e.message)}</div>`}}
window.addEventListener('skilled:sessionready',load,{once:true}); if(window.SkilledSession)load();
})();
