(function(){
'use strict';
const $=id=>document.getElementById(id);
const text=value=>String(value??'').trim();
const lower=value=>text(value).toLocaleLowerCase('es-MX');
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
const fmt=value=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:3}).format(number(value));
const esc=value=>text(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finalStates=new Set(['finalizado','finalizada','cerrado','cerrada','completado','completada']);
let projects=[];
let warehouses=[];
let lines=[];
let currentProject=null;
let busy=false;
function isFinal(project){return finalStates.has(lower(project?.estado))}
function available(line){return Math.max(0,number(line?.disponibleTraspaso??line?.disponible_traspaso??line?.entregadoDisponible??line?.entregado_disponible??(number(line?.entregado)-number(line?.sobrante??line?.cantidadSobrante??line?.cantidad_sobrante))))}
function returned(line){return Math.max(0,number(line?.sobrante??line?.cantidadSobrante??line?.cantidad_sobrante))}
function delivered(line){return Math.max(0,number(line?.entregadoHistorico??line?.entregado_historico??line?.entregado))}
function selectedRows(){return lines.map((line,index)=>({line,index,qty:number(document.querySelector(`[data-return-qty="${index}"]`)?.value)})).filter(item=>item.qty>0)}
function setStatus(message,type='info'){
 const target=$('status');
 if(!message){target.className='mt-3 hidden';target.textContent='';return}
 target.className=`mt-3 ${type==='error'?'surplus-error':'surplus-success'}`;
 target.textContent=message;
}
function renderProjectOptions(){
 const finalProjects=projects.filter(isFinal).sort((a,b)=>text(b.fechaEntrega).localeCompare(text(a.fechaEntrega))||text(a.proyecto).localeCompare(text(b.proyecto),'es',{numeric:true}));
 $('project').innerHTML='<option value="">Selecciona un proyecto…</option>'+finalProjects.map(item=>`<option value="${esc(item.proyecto)}">${esc(item.proyecto)} · ${esc(item.nombreProyecto||'Sin nombre')} · ${esc(item.estado||'Finalizado')}</option>`).join('');
 const requested=text(new URLSearchParams(location.search).get('proyecto'));
 if(requested&&finalProjects.some(item=>text(item.proyecto)===requested)){$('project').value=requested;loadProject(requested)}
 if(!finalProjects.length)$('project-note').textContent='No hay proyectos finalizados/cerrados/completados disponibles. Cuando un proyecto cambie a estado finalizado aparecerá aquí.';
}
function renderWarehouses(){
 $('warehouse').innerHTML='<option value="">Selecciona almacén destino…</option>'+warehouses.map(item=>`<option value="${Number(item.id)||0}">${esc(item.nombre||`Almacén ${item.id}`)}</option>`).join('');
 if(warehouses.length===1)$('warehouse').value=String(warehouses[0].id);
}
function renderKpis(){
 const deliveredLines=lines.filter(line=>delivered(line)>0);
 $('kpi-lines').textContent=String(deliveredLines.length);
 $('kpi-delivered').textContent=fmt(deliveredLines.reduce((sum,line)=>sum+delivered(line),0));
 $('kpi-returned').textContent=fmt(deliveredLines.reduce((sum,line)=>sum+returned(line),0));
 $('kpi-available').textContent=fmt(deliveredLines.reduce((sum,line)=>sum+available(line),0));
}
function renderMaterials(){
 const rows=lines.filter(line=>delivered(line)>0);
 renderKpis();
 if(!currentProject){$('materials-wrap').innerHTML='<div class="surplus-empty"><div><strong>Sin proyecto seleccionado</strong><span>Elige un proyecto finalizado para visualizar sus materiales entregados.</span></div></div>';updateSelected();return}
 if(!rows.length){$('materials-wrap').innerHTML='<div class="surplus-empty"><div><strong>El proyecto no tiene materiales entregados</strong><span>No hay cantidades que puedan regresar al almacén.</span></div></div>';updateSelected();return}
 $('materials-wrap').innerHTML=`<table class="crm-table surplus-table w-full min-w-[980px] text-xs"><thead><tr><th class="px-4 py-3 text-left">Material</th><th class="px-4 py-3 text-left">Alcance</th><th class="px-4 py-3 text-right">Entregado</th><th class="px-4 py-3 text-right">Ya devuelto</th><th class="px-4 py-3 text-right">Disponible</th><th class="px-4 py-3 text-right">Devolver ahora</th></tr></thead><tbody>${rows.map(line=>{const index=lines.indexOf(line),max=available(line),outside=Boolean(line.fueraPlan??line.fuera_plan);return`<tr class="surplus-row border-t border-[#161f38]" data-disabled="${max<=0?'1':'0'}"><td class="px-4 py-3"><div class="surplus-code">${esc(line.codigo)}</div><div class="surplus-desc mt-1">${esc(line.descripcion||line.material?.descripcion||line.material?.desc||line.codigo)}</div><div class="surplus-meta">${esc(line.unidad||'Sin unidad')}</div></td><td class="px-4 py-3"><span class="surplus-chip ${outside?'warn':'good'}">${outside?'Fuera del plan':'Dentro del plan'}</span></td><td class="px-4 py-3 text-right font-bold text-gray-200">${fmt(delivered(line))}</td><td class="px-4 py-3 text-right text-amber-300">${fmt(returned(line))}</td><td class="px-4 py-3 text-right text-emerald-300 font-bold">${fmt(max)}</td><td class="px-4 py-3 text-right"><input data-return-qty="${index}" data-max="${max}" type="number" min="0" max="${max}" step="any" value="" placeholder="0" class="field surplus-qty" ${max<=0?'disabled':''}></td></tr>`}).join('')}</tbody></table>`;
 document.querySelectorAll('[data-return-qty]').forEach(input=>input.addEventListener('input',()=>{const max=number(input.dataset.max),value=Math.max(0,number(input.value));if(value>max)input.value=String(max);updateSelected()}));
 updateSelected();
}
function updateSelected(){
 const selected=selectedRows();
 const total=selected.reduce((sum,item)=>sum+item.qty,0);
 $('selected-total').textContent=fmt(total);
 const canSubmit=Boolean(currentProject&&isFinal(currentProject)&&Number($('warehouse').value)>0&&total>0&&!busy);
 $('return').disabled=!canSubmit;
 $('fill-all').disabled=!currentProject||!lines.some(line=>available(line)>0)||busy;
 $('clear-all').disabled=!currentProject||busy;
}
async function loadProject(projectNumber){
 currentProject=projects.find(item=>text(item.proyecto)===text(projectNumber))||null;
 lines=[];
 setStatus('');
 if(!currentProject){renderMaterials();$('project-note').textContent='Selecciona un proyecto finalizado para consultar los materiales entregados.';return}
 if(!isFinal(currentProject)){$('project-note').textContent='Este proyecto todavía no está finalizado. La devolución de sobrantes se habilita cuando el proyecto se cierre.';renderMaterials();return}
 $('project-note').textContent=`Proyecto ${currentProject.proyecto} · ${currentProject.nombreProyecto||'Sin nombre'} · Estado: ${currentProject.estado||'finalizado'}. Consultando movimientos…`;
 $('materials-wrap').innerHTML='<div class="surplus-empty"><div><strong>Consultando materiales…</strong><span>Calculando entregado, devuelto y disponible para regresar.</span></div></div>';
 try{
  const result=await SkilledDB.listProjectMovementPlan(currentProject.proyecto,{includeOutsidePlan:true});
  lines=Array.isArray(result)?result:[];
  $('project-note').textContent=`Proyecto ${currentProject.proyecto} · ${currentProject.nombreProyecto||'Sin nombre'} · ${lines.filter(line=>delivered(line)>0).length} materiales con historial de entrega.`;
  renderMaterials();
 }catch(error){lines=[];renderMaterials();setStatus(error?.message||'No se pudieron consultar los materiales del proyecto.','error')}
}
async function registerReturn(){
 if(busy)return;
 const selected=selectedRows();
 const warehouseId=Number($('warehouse').value)||0;
 const warehouse=warehouses.find(item=>Number(item.id)===warehouseId);
 const reason=text($('reason').value)||`Devolución de sobrantes al finalizar el proyecto ${currentProject?.proyecto||''}`;
 if(!currentProject||!isFinal(currentProject)){setStatus('Selecciona un proyecto finalizado.','error');return}
 if(!warehouse){setStatus('Selecciona el almacén que recibirá el sobrante.','error');return}
 if(!selected.length){setStatus('Captura al menos una cantidad a devolver.','error');return}
 for(const item of selected){if(item.qty>available(item.line)+0.000001){setStatus(`La cantidad de ${item.line.codigo} supera el sobrante disponible.`,'error');return}}
 const products=selected.map(item=>({codigo:item.line.codigo,descripcion:item.line.descripcion||item.line.material?.descripcion||item.line.codigo,unidad:item.line.unidad||item.line.material?.unidad,cantidad:item.qty,cantidadDentroPlan:Boolean(item.line.fueraPlan??item.line.fuera_plan)?0:item.qty,cantidadFueraPlan:Boolean(item.line.fueraPlan??item.line.fuera_plan)?item.qty:0,alcance:Boolean(item.line.fueraPlan??item.line.fuera_plan)?'fuera_plan':'dentro_plan'}));
 const total=selected.reduce((sum,item)=>sum+item.qty,0);
 if(!confirm(`Se devolverán ${fmt(total)} unidades distribuidas en ${products.length} material${products.length===1?'':'es'} al almacén ${warehouse.nombre}. ¿Continuar?`))return;
 busy=true;updateSelected();setStatus('Registrando la devolución y actualizando existencias…');
 try{
  const requestId=window.crypto?.randomUUID?window.crypto.randomUUID():`SOB-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  await SkilledDB.transferProjectMaterials({requestId,proyectoOrigen:currentProject.proyecto,modo:'almacen',almacenDestinoId:warehouseId,almacenDestino:warehouse.nombre,motivo:reason,productos:products});
  setStatus(`Devolución registrada correctamente. ${products.length} material${products.length===1?'':'es'} · ${fmt(total)} unidades regresaron a ${warehouse.nombre}.`);
  $('reason').value='';
  await loadProject(currentProject.proyecto);
 }catch(error){setStatus(error?.message||'No se pudo registrar la devolución de sobrantes.','error')}
 finally{busy=false;updateSelected()}
}
async function init(){
 try{
  const results=await Promise.all([SkilledDB.listProjects(),SkilledDB.listWarehouses({activeOnly:true})]);
  projects=Array.isArray(results[0])?results[0]:[];
  warehouses=Array.isArray(results[1])?results[1]:[];
  renderProjectOptions();renderWarehouses();renderKpis();updateSelected();
 }catch(error){setStatus(error?.message||'No se pudo cargar la información necesaria.','error')}
}
$('project')?.addEventListener('change',event=>loadProject(event.target.value));
$('warehouse')?.addEventListener('change',updateSelected);
$('fill-all')?.addEventListener('click',()=>{document.querySelectorAll('[data-return-qty]').forEach(input=>{if(!input.disabled)input.value=input.dataset.max||''});updateSelected()});
$('clear-all')?.addEventListener('click',()=>{document.querySelectorAll('[data-return-qty]').forEach(input=>input.value='');updateSelected()});
$('return')?.addEventListener('click',registerReturn);
$('refresh')?.addEventListener('click',async()=>{await init();if(currentProject)await loadProject(currentProject.proyecto)});
document.addEventListener('DOMContentLoaded',init,{once:true});
})();
