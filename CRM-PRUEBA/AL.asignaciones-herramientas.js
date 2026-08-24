(function(){
'use strict';
const params=new URLSearchParams(location.search);
const toolFilterIds=new Set(String(params.get('herramientas')||'').split(',').map(Number).filter(Boolean));
const originalAvailableUnits=availableUnits;
function rentMoney(value,currency='MXN'){return Number(value||0).toLocaleString('es-MX',{style:'currency',currency:currency||'MXN',minimumFractionDigits:2})}
function unitMonthlyCharge(unit){const tool=unit?.herramienta||{};return Number(tool.costoAdquisicion||0)*(Number(tool.rentaMensualPct||10)/100)}
function updateRentalEstimate(){const box=document.getElementById('assignment-rental-estimate');if(!box)return;const project=document.getElementById('to-project')?.classList.contains('crm-primary');if(!project){box.classList.add('hidden');return}box.classList.remove('hidden');const rows=availableUnits().filter(item=>selectedUnits.has(item.id));const monthly=rows.reduce((s,item)=>s+unitMonthlyCharge(item),0);const missing=rows.filter(item=>Number(item.herramienta?.costoAdquisicion||0)<=0).length;box.innerHTML=`<strong class="block text-[10px] text-blue-200">Cargo interno al proyecto</strong><span class="mt-1 block text-[9px] leading-5 text-gray-400">${rows.length?`${rentMoney(monthly)} por cada periodo de 30 días de uso de las ${rows.length} unidad${rows.length===1?'':'es'} seleccionada${rows.length===1?'':'s'}.`:'Selecciona unidades para calcular el cargo.'} La tarifa se calcula con el porcentaje configurado en cada herramienta.${missing?` <span class="text-amber-300">${missing} unidad${missing===1?'':'es'} no tiene${missing===1?'':'n'} costo de adquisición y no generará${missing===1?'':'n'} cargo hasta completarlo.</span>`:''}</span>`}
function selectedToolUnits(){const rows=originalAvailableUnits();return toolFilterIds.size?rows.filter(item=>toolFilterIds.has(Number(item.herramienta?.id||item.herramientaId))):rows}
availableUnits=selectedToolUnits;
const originalRenderUnits=renderUnits;renderUnits=function(){originalRenderUnits();updateRentalEstimate()};
const originalSetDestination=setDestination;setDestination=function(type){originalSetDestination(type);updateRentalEstimate()};
function ensureAssignmentControls(){
 const actions=document.querySelector('main section.flex.flex-col.sm\\:flex-row .flex.flex-wrap');
 if(actions&&!document.getElementById('assignment-history-link')){
  const current=document.createElement('a');current.href='AL.estado-herramientas.html';current.className='crm-secondary';current.textContent='Estado actual';actions.insertBefore(current,document.getElementById('new-assignment'));
  const history=document.createElement('a');history.id='assignment-history-link';history.href='AL.historial-herramientas.html';history.className='crm-secondary';history.textContent='Historial';actions.insertBefore(history,current);
 }
 const clear=document.getElementById('clear-units');
 if(clear&&!document.getElementById('select-all-units')){
  const select=document.createElement('button');select.id='select-all-units';select.type='button';select.className='crm-secondary !px-3 !py-2';select.textContent='Seleccionar visibles';select.addEventListener('click',()=>{const q=low(document.getElementById('unit-search').value);availableUnits().filter(item=>!q||(window.SkilledSearch?.matches?window.SkilledSearch.matches([item.codigoInterno,item.numeroSerie,item.almacenNombre,item.ubicacionNombre,item.ubicacionCodigo,item.herramienta?.sku,item.herramienta?.descripcion,item.herramienta?.marca,item.herramienta?.modelo],q):low([item.codigoInterno,item.numeroSerie,item.almacenNombre,item.ubicacionNombre,item.ubicacionCodigo,item.herramienta?.sku,item.herramienta?.descripcion,item.herramienta?.marca,item.herramienta?.modelo].join(' ')).includes(q))).forEach(item=>selectedUnits.add(item.id));renderUnits()});clear.parentElement.insertBefore(select,clear);
 }
 if(toolFilterIds.size){
  const list=document.getElementById('unit-list')?.parentElement;
  if(list&&!document.getElementById('selected-tools-notice')){const notice=document.createElement('div');notice.id='selected-tools-notice';notice.className='mb-3 rounded-lg border border-blue-500/25 bg-blue-950/10 px-3 py-2 text-[10px] text-blue-200';notice.textContent=`Asignación filtrada a ${toolFilterIds.size} herramienta${toolFilterIds.size===1?'':'s'} seleccionada${toolFilterIds.size===1?'':'s'} desde el catálogo.`;list.insertBefore(notice,document.getElementById('unit-list'))}
 }
}
function ticketData(item,type='asignacion'){return{tipo,grupoId:item.grupoId,folio:item.grupoId||item.id,fecha:type==='devolucion'?(item.fechaDevolucionReal||new Date().toISOString()):item.fechaAsignacion,destino:item.destinoTipo==='proyecto'?`Proyecto ${item.proyecto}`:item.personaNombre,responsable:item.responsableEntrega,condicion:type==='devolucion'?item.condicionEntrada:item.condicionSalida,accesorios:item.accesoriosSalida,observaciones:type==='devolucion'?item.observacionesDevolucion:item.observaciones,items:[item]}}
window.printToolAssignment=async function(id){const item=assignments.find(row=>row.id===Number(id));if(!item)return;let rows=[item];if(item.grupoId){try{rows=await SkilledDB.getToolAssignmentGroup(item.grupoId)}catch(_){}}const type=item.estadoDb==='devuelta'?'devolucion':item.estadoDb==='cancelada'?'cancelacion':'asignacion';const data=ticketData(item,type);data.items=rows;SkilledToolTickets.mostrar(data)};
const originalRender=render;
render=function(){originalRender();document.querySelectorAll('#tbody tr').forEach((row,index)=>{const item=filtered()[index];if(!item)return;const toolCell=row.children[1];const charge=window.SkilledDB?.toolRentalCharge?SkilledDB.toolRentalCharge(item):null;if(toolCell&&item.destinoTipo==='proyecto'&&charge){const info=document.createElement('div');info.className='mt-1 text-[9px] text-cyan-300';info.textContent=charge.costoAdquisicion>0?`Uso: ${rentMoney(charge.total,item.unidad?.herramienta?.monedaAdquisicion)} · ${charge.meses} mes(es) cobrable(s)`:'Costo de adquisición pendiente';toolCell.appendChild(info)}const cell=row.lastElementChild;if(!cell)return;const button=document.createElement('button');button.type='button';button.className='crm-secondary !px-3 !py-2 ml-1';button.textContent='Comprobante';button.addEventListener('click',()=>printToolAssignment(item.id));cell.appendChild(button)})};
const originalOpen=openAssignment;
openAssignment=function(){originalOpen();renderUnits()};
ensureAssignmentControls();render();
})();
