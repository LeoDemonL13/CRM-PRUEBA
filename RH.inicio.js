(function(){
'use strict';
const $=id=>document.getElementById(id);
const text=v=>String(v??'').trim();
const esc=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const parse=v=>{if(!v)return null;const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?null:d};
const label=v=>{const d=parse(v);return d?d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—'};
const activeProject=row=>!['finalizado','cerrado','cancelado','inactivo'].includes(text(row.estado).toLowerCase());
function daysUntilBirthday(value){const birth=parse(value);if(!birth)return null;const now=today();let next=new Date(now.getFullYear(),birth.getMonth(),birth.getDate());if(next<now)next=new Date(now.getFullYear()+1,birth.getMonth(),birth.getDate());return Math.round((next-now)/86400000)}
function item(title,meta,badge='',tone=''){return`<div class="profile-list-item"><div><p class="profile-list-title">${esc(title)}</p><p class="profile-list-meta">${esc(meta)}</p></div>${badge?`<span class="profile-badge ${tone}">${esc(badge)}</span>`:''}</div>`}
function empty(title,copy){return`<div class="py-5 text-center"><p class="text-xs font-semibold text-white">${esc(title)}</p><p class="mt-1 text-[9px] text-gray-500">${esc(copy)}</p></div>`}
function failure(title){return`<div class="py-5 text-center"><p class="text-xs font-semibold text-rose-300">${esc(title)}</p><p class="mt-1 text-[9px] text-gray-500">Usa “Diagnóstico RH” para ver el motivo exacto.</p></div>`}
function setMetric(id,value,ok=true){const el=$(id);if(!el)return;el.textContent=ok?Number(value||0).toLocaleString('es-MX'):'—';el.title=ok?'':'La consulta correspondiente no pudo completarse.'}
async function load(){
 RHCore.clear();
 const queries=await Promise.all([
  RHCore.query('Inicio · Personal',()=>SkilledDB.client.from('rh_personal').select('*').order('fecha_ingreso',{ascending:false})),
  RHCore.query('Inicio · Proyectos',()=>SkilledDB.client.from('proyectos').select('*').order('created_at',{ascending:false})),
  RHCore.query('Inicio · Asignaciones',()=>SkilledDB.client.from('rh_proyecto_asignaciones').select('*')),
  RHCore.query('Inicio · Incidencias',()=>SkilledDB.client.from('rh_incidencias').select('*')),
  RHCore.query('Inicio · Documentos',()=>SkilledDB.client.from('rh_documentos').select('*,personal:rh_personal(id,numero_empleado,nombre,apellidos)')),
  RHCore.query('Inicio · Capacitación',()=>SkilledDB.client.from('rh_capacitaciones').select('*')),
  RHCore.query('Inicio · Participantes',()=>SkilledDB.client.from('rh_capacitacion_participantes').select('*,personal:rh_personal(id,nombre,apellidos)'))
 ]);
 const [qp,qpr,qa,qi,qd,qt,qpt]=queries;
 const people=qp.data||[],projects=qpr.data||[],assignments=qa.data||[],incidents=qi.data||[],documents=qd.data||[],training=qt.data||[],participants=qpt.data||[];
 const now=today(),in60=new Date(now);in60.setDate(in60.getDate()+60);
 const currentAbsences=incidents.filter(r=>r.fecha_inicio<=now.toISOString().slice(0,10)&&r.fecha_fin>=now.toISOString().slice(0,10)&&['permiso','vacaciones','incapacidad'].includes(r.tipo)&&!['rechazado','cancelado'].includes(r.estado));
 const contractSoon=people.filter(r=>{const d=parse(r.fecha_fin_contrato);return d&&d>=now&&d<=in60});
 const docSoon=documents.filter(r=>{const d=parse(r.fecha_vencimiento);return d&&d>=now&&d<=in60});
 const trainingOpen=training.filter(r=>['programada','en_curso'].includes(r.estado));
 setMetric('rh-active',people.filter(r=>r.estado==='activo').length,qp.ok);
 setMetric('rh-projects',projects.filter(activeProject).length,qpr.ok);
 setMetric('rh-absent',currentAbsences.length,qi.ok);
 setMetric('rh-contracts',contractSoon.length,qp.ok);
 setMetric('rh-documents',docSoon.length,qd.ok);
 setMetric('rh-training',trainingOpen.length,qt.ok);
 const birthdays=people.map(p=>({...p,days:daysUntilBirthday(p.fecha_nacimiento)})).filter(p=>p.days!=null&&p.days<=30).sort((a,b)=>a.days-b.days).slice(0,6);
 $('birthdays').innerHTML=!qp.ok?failure('No se pudo consultar Personal'):birthdays.length?birthdays.map(p=>item(`${p.nombre} ${p.apellidos}`,`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`,p.days===0?'Hoy':`${p.days} días`,'accent')).join(''):empty('Sin cumpleaños próximos','No hay cumpleaños registrados en los próximos 30 días.');
 const activeAssignments=new Set(assignments.filter(a=>a.estado==='activo').map(a=>a.proyecto_numero));
 const unassigned=projects.filter(activeProject).filter(p=>!activeAssignments.has(p.numero_proyecto)).slice(0,6);
 $('projects-without-staff').innerHTML=!qpr.ok||!qa.ok?failure('No se pudo calcular proyectos sin personal'):unassigned.length?unassigned.map(p=>item(`${p.numero_proyecto} · ${p.nombre_proyecto}`,`${p.cliente||'Sin cliente'} · entrega ${label(p.fecha_entrega)}`,'Sin equipo','warning')).join(''):empty('Todos los proyectos tienen personal','No hay proyectos activos pendientes de asignación.');
 const recent=[...people].sort((a,b)=>new Date(b.fecha_ingreso||0)-new Date(a.fecha_ingreso||0)).slice(0,5);
 $('recent-hires').innerHTML=!qp.ok?failure('No se pudo consultar Personal'):recent.length?recent.map(p=>item(`${p.nombre} ${p.apellidos}`,`${p.numero_empleado} · ${p.puesto}`,label(p.fecha_ingreso),'success')).join(''):empty('Sin altas registradas','Registra personal para ver las incorporaciones recientes.');
 $('contract-expirations').innerHTML=!qp.ok?failure('No se pudo consultar Personal'):contractSoon.length?contractSoon.sort((a,b)=>parse(a.fecha_fin_contrato)-parse(b.fecha_fin_contrato)).slice(0,5).map(p=>item(`${p.nombre} ${p.apellidos}`,`${p.tipo_contrato||'Contrato'} · ${p.puesto}`,label(p.fecha_fin_contrato),'warning')).join(''):empty('Sin vencimientos próximos','No hay contratos que finalicen en los próximos 60 días.');
 const expiringCerts=participants.filter(p=>{const d=parse(p.fecha_vencimiento);return d&&d>=now&&d<=in60});
 const alerts=[...docSoon.slice(0,3).map(d=>({title:d.nombre,meta:`${d.personal?.nombre||''} ${d.personal?.apellidos||''} · vence ${label(d.fecha_vencimiento)}`,badge:'Documento',tone:'warning'})),...expiringCerts.slice(0,3).map(p=>({title:'Certificación por vencer',meta:`${p.personal?.nombre||''} ${p.personal?.apellidos||''} · ${label(p.fecha_vencimiento)}`,badge:'Capacitación',tone:'accent'}))].slice(0,6);
 $('compliance-alerts').innerHTML=!qd.ok||!qpt.ok?failure('No se pudo calcular cumplimiento'):alerts.length?alerts.map(a=>item(a.title,a.meta,a.badge,a.tone)).join(''):empty('Cumplimiento al día','No hay documentos o certificaciones por vencer en 60 días.');
}
$('refresh')?.addEventListener('click',load);
RHCore.ready().then(load).catch(error=>RHCore.report('Inicio RH',error));
})();
