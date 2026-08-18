(function(){
'use strict';
const $=id=>document.getElementById(id);const txt=v=>String(v??'').trim();const esc=v=>txt(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const role=document.body.dataset.profile||'';
const cfg={
 planeacion:{label:'Planeación',kicker:'PL · Planeación y seguimiento',title:'Planeación operativa',copy:'Prioriza proyectos, fechas, faltantes y solicitudes antes de que se conviertan en retrasos.',links:[['AL.proyectos.html?perfil=planeacion','Proyectos'],['PROY.importar.html?perfil=planeacion','Importar proyectos'],['AL.solicitudes-material.html?perfil=planeacion','Solicitudes'],['AL.reportes.html?perfil=planeacion','Reportes']],automations:['Detección de proyectos próximos a vencer','Cruce de proyectos con solicitudes de material','Resumen de prioridades consultable por Skill']},
 coordinacion:{label:'Coordinación',kicker:'CR · Coordinación operativa',title:'Coordinación de proyectos',copy:'Concentra lo que requiere seguimiento entre proyectos, materiales, personal y movilidad sin abrir áreas que no necesitas.',links:[['AL.proyectos.html?perfil=coordinacion','Proyectos'],['AL.solicitudes-material.html?perfil=coordinacion','Solicitudes'],['AL.vehiculos.html?perfil=coordinacion','Vehículos'],['AL.reportes.html?perfil=coordinacion','Reportes']],automations:['Prioridad por fecha de proyecto','Seguimiento de solicitudes abiertas','Disponibilidad vehicular visible en un solo punto']},
 logistica:{label:'Logística',kicker:'LG · Logística y movilidad',title:'Control logístico',copy:'Visualiza disponibilidad, viajes y entregas para coordinar recursos sin duplicar capturas.',links:[['AL.vehiculos.html?perfil=logistica','Vehículos'],['CO.entregas.html?perfil=logistica','Entregas'],['AL.proyectos.html?perfil=logistica','Proyectos'],['AL.catalogo.html?perfil=logistica','Consulta de materiales']],automations:['Detección de vehículos disponibles','Viajes activos destacados','Entregas configuradas disponibles para consulta rápida']},
 recepcion:{label:'Recepción',kicker:'RE · Recepción y apoyo operativo',title:'Recepción operativa',copy:'Mantén a la vista entregas, movilidad y avisos relevantes; Skill resuelve consultas sin exponer módulos innecesarios.',links:[['CO.entregas.html?perfil=recepcion','Entregas'],['AL.vehiculos.html?perfil=recepcion','Vehículos'],['perfil.html?perfil=recepcion','Mi perfil']],automations:['Entregas visibles por prioridad','Disponibilidad vehicular de consulta','Skill como acceso rápido a información autorizada']}
}[role]||null;
if(!cfg)return;
function set(id,v){if($(id))$(id).textContent=v}
set('ops-kicker',cfg.kicker);set('ops-title',cfg.title);set('ops-copy',cfg.copy);set('ops-label',cfg.label);
const links=$('ops-links');if(links)links.innerHTML=cfg.links.map(([href,label])=>`<a class="profile-module-card" href="${href}"><div class="profile-module-icon">↗</div><h2 class="profile-module-title">${esc(label)}</h2><p class="profile-module-copy">Abrir información autorizada para ${esc(cfg.label)}.</p><span class="profile-module-link">Abrir →</span></a>`).join('');
const auto=$('ops-automations');if(auto)auto.innerHTML=cfg.automations.map(x=>`<div class="crm-v83-automation"><i></i><div><strong>${esc(x)}</strong><p>Se calcula a partir de los datos existentes; no modifica registros automáticamente.</p></div></div>`).join('');
const safe=async(fn,fb=[])=>{try{return typeof fn==='function'?await fn():fb}catch(_){return fb}};
async function load(){
 const db=window.SkilledDB;if(!db){set('ops-status','Conexión no disponible');return}
 const [projects,requests,vehicles,trips,deliveries,alerts]=await Promise.all([
  safe(()=>db.listProjects()),safe(()=>db.listMaterialRequests({})),safe(()=>db.listVehicles({includeInactive:true})),safe(()=>db.listVehicleTrips({})),safe(()=>db.listDeliveryInfos({})),safe(()=>db.listOperationalAlerts())
 ]);
 const activeProjects=(projects||[]).filter(p=>!['finalizado','cerrado','cancelado','inactivo'].includes(txt(p.estado).toLowerCase()));
 const openReq=(requests||[]).filter(r=>!['entregado','cerrado','cancelado','rechazado'].includes(txt(r.estado).toLowerCase()));
 const available=(vehicles||[]).filter(v=>v.activo!==false&&['disponible',''].includes(txt(v.estado).toLowerCase()));
 const activeTrips=(trips||[]).filter(t=>!['finalizado','cerrado','cancelado'].includes(txt(t.estado).toLowerCase()));
 set('ops-m1',activeProjects.length.toLocaleString('es-MX'));set('ops-m2',openReq.length.toLocaleString('es-MX'));set('ops-m3',available.length.toLocaleString('es-MX'));set('ops-m4',(deliveries||[]).length.toLocaleString('es-MX'));
 const list=$('ops-priority');if(list){let rows=[];
  if(role==='logistica'||role==='recepcion')rows=[...(activeTrips||[]).slice(0,4).map(x=>({t:txt(x.destino||x.motivo||'Viaje activo'),m:`Vehículo ${txt(x.vehiculo_nombre||x.vehiculo_id||'por confirmar')}`,b:'Viaje'})),...(deliveries||[]).slice(0,4).map(x=>({t:txt(x.nombre||x.proyecto||'Entrega configurada'),m:txt(x.direccion||x.horario||'Información disponible'),b:'Entrega'}))];
  else rows=[...activeProjects.slice(0,5).map(x=>({t:`${txt(x.numero_proyecto||x.numero||'Proyecto')} · ${txt(x.nombre_proyecto||x.nombre||'')}`,m:`${txt(x.cliente||'Sin cliente')} · ${txt(x.estado||'activo')}`,b:'Proyecto'})),...openReq.slice(0,3).map(x=>({t:txt(x.descripcion||x.material_descripcion||x.material_codigo||'Solicitud'),m:`${txt(x.proyecto_numero||x.proyecto||'Sin proyecto')} · ${txt(x.estado||'pendiente')}`,b:'Solicitud'}))];
  list.innerHTML=rows.length?rows.slice(0,7).map(r=>`<div class="crm-v83-list-item"><div><strong>${esc(r.t)}</strong><p>${esc(r.m)}</p></div><span class="profile-badge info">${esc(r.b)}</span></div>`).join(''):'<div class="crm-v83-empty">No hay pendientes visibles para este perfil.</div>';
 }
 set('ops-status',`${(alerts||[]).length} señales operativas · actualizado ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`);
}
$('ops-refresh')?.addEventListener('click',load);load();
})();
