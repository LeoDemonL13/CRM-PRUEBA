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
 $('project-list').innerHTML=attention.length?attention.map(r=>`<a href="${roleLabel()==='Gerencia General'?'GG':'SG'}.proyectos.html?proyecto=${encodeURIComponent(r.proyecto)}" class="exec-row"><div><div class="flex items-center gap-2"><span class="font-mono text-[10px] text-sky-300">${esc(r.proyecto)}</span><span class="exec-status">${esc(r.estado||'Sin estado')}</span></div><p class="mt-1 text-sm font-bold text-white">${esc(r.nombre||'Proyecto')}</p><p class="mt-1 text-[10px] text-gray-500">${esc(r.cliente||'Sin cliente')} · ${esc(r.responsable||'Sin responsable')}</p></div><div class="text-right"><p class="text-[9px] uppercase tracking-widest text-gray-600">Real / planeado</p><p class="mt-1 text-xs font-bold text-white">${money(r.total_real)} / ${money(r.total_planeado)}</p><p class="mt-1 text-[10px] ${tone(r.desviacion_total)}">${num(r.desviacion_total)>0?'+':''}${money(r.desviacion_total)}</p></div></a>`).join(''):'<div class="profile-empty py-10"><div><p class="profile-empty-title">Sin proyectos</p><p class="profile-empty-copy">Cuando existan proyectos aparecerán aquí.</p></div></div>';
 $('subtitle-role').textContent=roleLabel();
}
async function load(){try{const rows=await SkilledDB.getExecutiveProjectSummary();render(rows||[])}catch(e){$('project-list').innerHTML=`<div class="p-5 text-sm text-rose-300">${esc(e.message)}</div>`}}
window.addEventListener('skilled:sessionready',load,{once:true}); if(window.SkilledSession)load();
})();
