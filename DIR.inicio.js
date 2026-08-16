(function(){
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),num=v=>Number(v)||0;
const money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(num(v));
const date=v=>{if(!v)return'—';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})};
function role(){return String(window.SkilledSession?.role||document.body.dataset.profile||'').toLowerCase()}
function prefix(){return role()==='gerente_general'?'GG':'SG'}
function isClosed(row){return /complet|cerrad|cancelad/i.test(String(row.estado||''))}
function daysTo(row){if(!row.fechaEntrega)return null;const target=new Date(`${row.fechaEntrega}T12:00:00`),today=new Date();today.setHours(0,0,0,0);if(Number.isNaN(target.getTime()))return null;return Math.ceil((target-today)/86400000)}
function utilization(row){const plan=num(row.total_planeado),real=num(row.total_real);return plan>0?real/plan*100:real>0?100:0}
function risk(row){const days=daysTo(row),plan=num(row.total_planeado),dev=num(row.desviacion_total),use=utilization(row);let score=0;if(dev>0)score+=25+Math.min(55,plan>0?dev/plan*100:35);if(use>=100)score+=22;else if(use>=85)score+=10;if(days!==null&&days<0)score+=60;else if(days!==null&&days<=7)score+=38;else if(days!==null&&days<=14)score+=20;if(!String(row.responsable||'').trim())score+=8;return score}
function riskMeta(row){const score=risk(row),days=daysTo(row),dev=num(row.desviacion_total);if(score>=70)return{label:'Crítico',cls:'critical'};if(score>=35)return{label:'Atención',cls:'warning'};if(dev>0)return{label:'Sobre plan',cls:'warning'};if(days!==null&&days<=14)return{label:'Entrega próxima',cls:'info'};return{label:'Estable',cls:'ok'}}
function deliveryText(days){if(days===null)return'Sin fecha';if(days<0)return`${Math.abs(days)} días vencido`;if(days===0)return'Vence hoy';if(days===1)return'Vence mañana';return`Faltan ${days} días`}
function setText(id,value){const node=$(id);if(node)node.textContent=value}
function renderOperationalAlerts(alerts){const summary=alerts?.summary||{},values={low:num(summary.bajoMinimo),purchases:num(summary.comprasPendientes),locations:num(summary.ubicacionesPendientes),tools:num(summary.herramientasVencidas),vehicles:num(summary.documentosVehiculo)};setText('ops-low',values.low.toLocaleString('es-MX'));setText('ops-purchases',values.purchases.toLocaleString('es-MX'));setText('ops-locations',values.locations.toLocaleString('es-MX'));setText('ops-tools',values.tools.toLocaleString('es-MX'));setText('ops-vehicles',values.vehicles.toLocaleString('es-MX'));[['alert-low',values.low],['alert-purchases',values.purchases],['alert-locations',values.locations],['alert-tools',values.tools],['alert-vehicles',values.vehicles]].forEach(([id,value])=>{const node=$(id);if(!node)return;node.dataset.alert=value>0?'1':'0';node.dataset.critical=value>=5?'1':'0'});const total=Object.values(values).reduce((a,b)=>a+b,0);setText('ops-status',total?`${total} señales`:'Sin alertas');}

function ensureExecutiveEnhancements(){
 if(document.getElementById('exec-decision-center'))return;
 const main=document.querySelector('main.profile-shell')||document.querySelector('main');
 const metrics=document.querySelector('.exec-metrics');
 if(!main||!metrics)return;
 const section=document.createElement('section');
 section.id='exec-decision-center';
 section.className='exec-section exec-decision-center';
 section.innerHTML=`<div class="exec-section-head"><div><h2>Centro de decisiones</h2><p>Lectura rápida para Gerencia y Subgerencia: qué revisar, por qué y qué preguntarle a Sky.</p></div><button id="exec-copy-brief" class="crm-secondary" type="button">Copiar resumen</button></div><div class="exec-decision-grid"><article class="exec-panel exec-decision-main"><header class="exec-panel-head"><div><h2>Semáforo ejecutivo</h2><p id="decision-copy">Analizando operación…</p></div><span id="decision-status" class="profile-badge">Calculando</span></header><div class="exec-panel-body"><div id="decision-cards" class="exec-decision-cards"></div></div></article><article class="exec-panel exec-sky-prompts"><header class="exec-panel-head"><div><h2>Preguntas útiles para Sky</h2><p>Accesos rápidos para presentar o revisar datos sin navegar por todos los módulos.</p></div></header><div class="exec-panel-body"><div id="exec-sky-prompts"></div></div></article></div>`;
 metrics.insertAdjacentElement('afterend',section);
 document.getElementById('exec-copy-brief')?.addEventListener('click',async()=>{const value=document.getElementById('decision-copy')?.textContent||'';try{await navigator.clipboard.writeText(value);document.getElementById('exec-copy-brief').textContent='Copiado'}catch(_){document.getElementById('exec-copy-brief').textContent='No copió'}setTimeout(()=>{const b=document.getElementById('exec-copy-brief');if(b)b.textContent='Copiar resumen'},1400)});
}
function renderDecisionCenter(rows=[],alerts={}){
 ensureExecutiveEnhancements();
 const active=rows.filter(row=>!isClosed(row)),planned=rows.reduce((s,r)=>s+num(r.total_planeado),0),real=rows.reduce((s,r)=>s+num(r.total_real),0),over=active.filter(row=>num(row.desviacion_total)>0),due=active.filter(row=>{const d=daysTo(row);return d!==null&&d<=14}),critical=active.filter(row=>risk(row)>=70),warning=active.filter(row=>risk(row)>=35&&risk(row)<70);
 const summary=alerts?.summary||{},low=num(summary.bajoMinimo),purchases=num(summary.comprasPendientes),locations=num(summary.ubicacionesPendientes),tools=num(summary.herramientasVencidas),vehicles=num(summary.documentosVehiculo),alertTotal=low+purchases+locations+tools+vehicles;
 const budgetPct=planned>0?real/planned*100:real>0?100:0;
 const level=critical.length||budgetPct>100||alertTotal>=8?'Atención alta':warning.length||due.length||alertTotal?'Vigilancia':'Estable';
 const copy=`${active.length} proyectos activos, ${Math.round(budgetPct)}% del presupuesto utilizado, ${over.length} sobre plan, ${due.length} con entrega próxima o vencida y ${alertTotal} señales operativas transversales.`;
 setText('decision-status',level);setText('decision-copy',copy);
 const cards=[
  {t:'Presupuesto',v:`${Math.round(budgetPct)}%`,d:`${money(real)} real · ${money(planned)} planeado`,c:budgetPct>100},
  {t:'Riesgo de proyectos',v:String(critical.length+warning.length),d:`${critical.length} críticos · ${warning.length} en vigilancia`,c:critical.length>0},
  {t:'Entregas próximas',v:String(due.length),d:'Proyectos a 14 días o vencidos',c:due.length>0},
  {t:'Operación transversal',v:String(alertTotal),d:`Mínimos ${low} · compras ${purchases} · ubicaciones ${locations}`,c:alertTotal>0}
 ];
 const cardHost=document.getElementById('decision-cards');if(cardHost)cardHost.innerHTML=cards.map(item=>`<article class="exec-decision-card" data-critical="${item.c?'1':'0'}"><span>${esc(item.t)}</span><b>${esc(item.v)}</b><small>${esc(item.d)}</small></article>`).join('');
 const prompts=[
  'Sky, dame un resumen ejecutivo de lo que requiere atención',
  'Sky, ¿qué proyectos están sobre lo planeado?',
  'Sky, ¿qué entregas están próximas o vencidas?',
  'Sky, ¿qué compras o mínimos requieren seguimiento?',
  'Sky, prepara un mensaje breve para pedir revisión de prioridades'
 ];
 const promptHost=document.getElementById('exec-sky-prompts');if(promptHost)promptHost.innerHTML=prompts.map(q=>`<button class="exec-sky-prompt" type="button" data-exec-sky="${esc(q)}">${esc(q)}</button>`).join('');
 promptHost?.querySelectorAll('[data-exec-sky]').forEach(button=>button.addEventListener('click',()=>{const q=button.dataset.execSky||'';if(window.SkilledSky){window.SkilledSky.open();setTimeout(()=>window.SkilledSky.query(q),120)}else{document.getElementById('sky-open')?.click();setTimeout(()=>window.SkilledSky?.query(q),420)}}));
}
function injectExecutiveStyles(){
 if(document.getElementById('exec-v81-styles'))return;
 const style=document.createElement('style');style.id='exec-v81-styles';style.textContent=`.exec-decision-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(280px,.82fr);gap:14px}.exec-decision-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.exec-decision-card{border:1px solid #1a2946;border-radius:12px;background:#0b1426;padding:12px;min-height:86px}.exec-decision-card span{display:block;color:#6d7d95;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.1em}.exec-decision-card b{display:block;margin-top:8px;color:#f8fafc;font-size:21px;font-weight:900}.exec-decision-card small{display:block;margin-top:4px;color:#74839a;font-size:8px;line-height:1.4}.exec-decision-card[data-critical="1"]{border-color:rgba(245,158,11,.32);background:rgba(92,57,9,.08)}.exec-sky-prompts .exec-panel-body{padding-top:12px}.exec-sky-prompt{width:100%;display:block;text-align:left;margin-bottom:9px;border:1px solid #1d3357;border-radius:10px;background:#0b1426;color:#cfe1ff;padding:10px 11px;font-size:10px;font-weight:750;line-height:1.35}.exec-sky-prompt:hover{border-color:#3b82f6;background:#10203b}.tema-claro .exec-decision-card,.tema-claro .exec-sky-prompt{background:#fff!important;border-color:#dbe3ef!important}.tema-claro .exec-decision-card b{color:#0f172a!important}.tema-claro .exec-sky-prompt{color:#1e3a8a!important}@media(max-width:1100px){.exec-decision-grid{grid-template-columns:1fr}.exec-decision-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.exec-decision-cards{grid-template-columns:1fr}}`;
 document.head.appendChild(style);
}

function card(row,mode='risk'){const meta=riskMeta(row),days=daysTo(row),use=Math.round(utilization(row)),dev=num(row.desviacion_total);return `<a class="exec-priority" href="${prefix()}.proyectos.html?proyecto=${encodeURIComponent(row.proyecto)}"><div class="exec-priority-main"><div class="exec-project-line"><span class="exec-code">${esc(row.proyecto)}</span><span class="exec-risk ${meta.cls}">${meta.label}</span></div><strong>${esc(row.nombre||'Proyecto')}</strong><small>${esc(row.cliente||'Sin cliente')} · ${esc(row.responsable||'Responsable pendiente')}</small></div><div class="exec-priority-side"><b>${mode==='delivery'?date(row.fechaEntrega):money(row.total_real)}</b><span>${mode==='delivery'?deliveryText(days):`${use}% utilizado${dev>0?` · +${money(dev)}`:''}`}</span></div></a>`}
function render(rows){
 const active=rows.filter(row=>!isClosed(row)),planned=rows.reduce((s,r)=>s+num(r.total_planeado),0),real=rows.reduce((s,r)=>s+num(r.total_real),0),dev=real-planned,over=active.filter(r=>num(r.desviacion_total)>0),due=active.filter(r=>{const d=daysTo(r);return d!==null&&d<=14}),mat=rows.reduce((s,r)=>s+num(r.material_real),0),pay=rows.reduce((s,r)=>s+num(r.nomina_real),0),pct=planned>0?real/planned*100:real>0?100:0;
 setText('metric-active',active.length.toLocaleString('es-MX'));setText('metric-planned',money(planned));setText('metric-real',money(real));setText('metric-deviation',`${dev>0?'+':''}${money(dev)}`);setText('metric-over',over.length.toLocaleString('es-MX'));setText('metric-due',due.length.toLocaleString('es-MX'));
 const devNode=$('metric-deviation');if(devNode)devNode.className=`metric-value ${dev>0?'text-rose-300':dev<0?'text-emerald-300':'text-white'}`;
 setText('budget-percent',`${Math.round(pct)}%`);setText('budget-detail',`${money(real)} utilizados de ${money(planned)} planeados`);if($('budget-bar'))$('budget-bar').style.width=`${Math.min(100,Math.max(0,pct))}%`;if($('budget-bar'))$('budget-bar').classList.toggle('over',pct>100);
 const totalMix=mat+pay,matPct=totalMix>0?mat/totalMix*100:0,payPct=totalMix>0?pay/totalMix*100:0;setText('mix-material',`${money(mat)} · ${Math.round(matPct)}%`);setText('mix-payroll',`${money(pay)} · ${Math.round(payPct)}%`);if($('mix-material-bar'))$('mix-material-bar').style.width=`${matPct}%`;if($('mix-payroll-bar'))$('mix-payroll-bar').style.width=`${payPct}%`;
 const attention=active.map(row=>({row,score:risk(row)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||num(b.row.desviacion_total)-num(a.row.desviacion_total)).slice(0,6).map(item=>item.row);$('attention-list').innerHTML=attention.length?attention.map(row=>card(row,'risk')).join(''):'<div class="exec-empty">No hay proyectos con señales de atención inmediata.</div>';
 const deliveries=active.map(row=>({row,days:daysTo(row)})).filter(item=>item.days!==null).sort((a,b)=>a.days-b.days).slice(0,6).map(item=>item.row);$('delivery-list').innerHTML=deliveries.length?deliveries.map(row=>card(row,'delivery')).join(''):'<div class="exec-empty">No hay fechas de entrega registradas.</div>';
 const focus=role()==='gerente_general'?[...rows].sort((a,b)=>num(b.desviacion_total)-num(a.desviacion_total)).slice(0,6):[...active].sort((a,b)=>risk(b)-risk(a)).slice(0,6);$('project-list').innerHTML=focus.length?focus.map(row=>card(row,'risk')).join(''):'<div class="exec-empty">No hay proyectos disponibles.</div>';
 setText('focus-title',role()==='gerente_general'?'Mayor desviación contra lo planeado':'Seguimiento operativo prioritario');setText('focus-copy',role()==='gerente_general'?'Vista estratégica de los proyectos que más se alejan del presupuesto planeado.':'Proyectos ordenados por riesgo, fecha de entrega y utilización del presupuesto.');setText('last-update',`Actualizado ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`);
 const healthy=active.filter(row=>risk(row)<35).length;setText('health-summary',active.length?`${healthy} de ${active.length} proyectos activos se encuentran sin señales críticas.`:'No hay proyectos activos.');
}
async function load(){try{injectExecutiveStyles();ensureExecutiveEnhancements();setText('last-update','Actualizando…');const results=await Promise.allSettled([SkilledDB.getExecutiveProjectSummary(),SkilledDB.listOperationalAlerts?.()]);const projectResult=results[0],alertsResult=results[1];if(projectResult.status!=='fulfilled')throw projectResult.reason;render(projectResult.value||[]);const alertsData=alertsResult?.status==='fulfilled'?alertsResult.value:null;if(alertsData)renderOperationalAlerts(alertsData);else setText('ops-status','Sin acceso a alertas');renderDecisionCenter(projectResult.value||[],alertsData||{})}catch(e){$('attention-list').innerHTML=`<div class="exec-error">${esc(e.message)}</div>`;$('delivery-list').innerHTML='';$('project-list').innerHTML='';setText('last-update','No se pudo actualizar');setText('ops-status','No disponible')}}
window.addEventListener('skilled:sessionready',load,{once:true});if(window.SkilledSession)load();
})();
