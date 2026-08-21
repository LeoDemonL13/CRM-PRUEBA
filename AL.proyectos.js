'use strict';
/* Alcance de movimientos dentro y fuera del plan */
(function () {
    'use strict';
    const renderAnterior = window.renderMovimientosProyecto;
    function texto(v){ return String(v??'').trim(); }
    function clave(v){ return texto(v).toLocaleLowerCase('es-MX'); }
    function moneda(v){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v)||0); }
    function codigosPlan(){ return new Set((planProyectoActual||[]).map(l=>clave(l.codigo))); }
    function actualizarResumenFueraPlan(){
        const p = typeof proyectoActual !== 'undefined' ? proyectoActual : null;
        const target=document.getElementById('detalle-costo-consumido')?.parentElement;
        if(!target||!p)return;

        let note=document.getElementById('detalle-fuera-plan-v122');
        if(!note){
            note=document.createElement('div');
            note.id='detalle-fuera-plan-v122';
            note.className='text-[9px] text-amber-300 mt-1 leading-relaxed';
            target.appendChild(note);
        }

        const partes=[
            `Ingresado/comprado: ${moneda(p.costoIngresado||0)}`,
            `Entregado neto: ${moneda(p.costoEntregado||0)}`
        ];

        if(Number(p.costoFueraPlan||0)>0){
            partes.push(`Fuera del plan: ${moneda(p.costoFueraPlan||0)}`);
        }else{
            partes.push('Sin costo fuera del plan');
        }

        if(p.usaCostoEntradas){
            partes.push('El costo real incluye entradas aún no entregadas y evita duplicarlas cuando después exista una salida');
        }else{
            partes.push('El costo real corresponde a material entregado');
        }

        note.textContent=partes.join(' · ');
    }
    const renderDetalleAnterior = window.renderDetalle;
    if (typeof renderDetalleAnterior === 'function') {
        window.renderDetalle = function () {
            renderDetalleAnterior();
            actualizarResumenFueraPlan();
        };
    }

    window.renderMovimientosProyecto=function(){
        const tbody=document.getElementById('tabla-movimientos-proyecto');
        const vacio=document.getElementById('sin-movimientos-proyecto');
        if(!tbody||!vacio)return renderAnterior();
        const filtrados=movimientosFiltradosHistorial().slice().sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));
        const contador=document.getElementById('historial-contador'); if(contador)contador.textContent=`${filtrados.length} registro${filtrados.length===1?'':'s'} de ${movimientosActuales.length}`;
        const badge=document.getElementById('badge-historial'); if(badge)badge.textContent=formatoNumero.format(movimientosActuales.length);
        const head=tbody.closest('table')?.querySelector('thead tr');
        if(head&&!head.querySelector('[data-alcance-v122]')){ const th=document.createElement('th');th.dataset.alcanceV122='1';th.className='px-4 py-3';th.textContent='Alcance';head.insertBefore(th,head.lastElementChild); }
        if(!filtrados.length){tbody.innerHTML='';vacio.classList.remove('hidden');actualizarResumenFueraPlan();return;}
        vacio.classList.add('hidden');
        const set=codigosPlan();
        tbody.innerHTML=filtrados.map(item=>{
            const clase=item.tipo==='entrada'?'text-emerald-400 bg-emerald-500/10':item.tipo==='salida'?'text-red-400 bg-red-500/10':(item.tipo==='traspaso'||item.tipo==='reingreso')?'text-blue-400 bg-blue-500/10':'text-amber-400 bg-amber-500/10';
            const ruta=item.tipo==='traspaso'?`${item.bodegaOrigen||'—'} → ${item.bodegaDestino||'—'}`:(item.tipo==='entrada'||item.tipo==='reingreso')?(item.bodegaDestino||item.ubicacion||'—'):(item.bodegaOrigen||item.ubicacion||'—');
            const cantidad=`${formatoNumero.format(item.cantidad||0)}${item.unidad?' '+item.unidad:''}`;
            const dentro=set.has(clave(item.codigo));
            const alcance=dentro?'<span class="inline-flex px-2 py-1 rounded-full text-[9px] font-semibold border border-emerald-500/25 bg-emerald-950/15 text-emerald-300">Dentro del plan</span>':'<span class="inline-flex px-2 py-1 rounded-full text-[9px] font-semibold border border-amber-500/25 bg-amber-950/15 text-amber-300">Fuera del plan</span>';
            return `<tr class="border-t border-[#161f38] hover:bg-[#0d1425]"><td class="px-5 py-3 text-[10px] text-gray-400 whitespace-nowrap">${escapeHTML(formatearFecha(item.fecha))}</td><td class="px-4 py-3"><span class="inline-flex px-2 py-1 rounded-full text-[9px] font-bold uppercase ${clase}">${escapeHTML(item.tipo||'')}</span></td><td class="px-4 py-3 text-[10px] font-semibold text-gray-300">${escapeHTML(item.codigo||'')}</td><td class="px-4 py-3 text-[10px] text-gray-400">${escapeHTML(item.descripcion||'')}</td><td class="px-4 py-3 text-right text-[10px] font-semibold text-gray-300 whitespace-nowrap">${escapeHTML(cantidad)}</td><td class="px-4 py-3 text-[10px] text-gray-500">${escapeHTML(ruta)}</td><td class="px-4 py-3 text-[10px] text-gray-500">${escapeHTML(item.recibeNombre||'—')}</td><td class="px-4 py-3 text-[10px] text-gray-500">${escapeHTML(item.folioEntrega||item.requestId||'—')}</td><td class="px-4 py-3">${alcance}</td><td class="px-4 py-3 text-[10px] text-gray-500">${escapeHTML(item.motivo||'—')}</td></tr>`;
        }).join('');
        actualizarResumenFueraPlan();
    };
})();
(function(){
    'use strict';
    const originalData=window.datosReporteAlcance;
    const originalSync=window.sincronizarPlanConMovimientosLocal;
    const text=value=>String(value??'').trim();
    const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
    const key=value=>typeof window.claveProyecto==='function'?window.claveProyecto(value):text(value).toLocaleLowerCase('es-MX');
    function transferSummary(){
        const result=new Map();
        (Array.isArray(window.movimientosActuales)?window.movimientosActuales:[]).forEach(move=>{
            if(text(move.tipo).toLowerCase()!=='traspaso')return;
            const code=text(move.codigo||move.materialCodigo||move.material_codigo||move.codigoManual||move.codigo_manual);
            if(!code)return;
            const token=key(code);
            if(!result.has(token))result.set(token,{inside:0,outside:0});
            const item=result.get(token);
            const quantity=Math.max(0,number(move.cantidad));
            const insideSaved=Math.max(0,number(move.cantidadDentroPlan??move.cantidad_dentro_plan));
            const outsideSaved=Math.max(0,number(move.cantidadFueraPlan??move.cantidad_fuera_plan));
            const scope=text(move.alcance).toLowerCase();
            if(insideSaved>0||outsideSaved>0){item.inside+=insideSaved;item.outside+=outsideSaved;return}
            if(scope==='dentro_plan')item.inside+=quantity;
            else if(scope==='fuera_plan')item.outside+=quantity;
            else{
                const inPlan=(Array.isArray(window.planProyectoActual)?window.planProyectoActual:[]).some(line=>key(line.codigo||line.material?.codigo)===token);
                if(inPlan)item.inside+=quantity;else item.outside+=quantity;
            }
        });
        return result;
    }
    if(typeof originalData==='function'){
        window.datosReporteAlcance=function(){
            const rows=originalData();
            const transfers=transferSummary();
            return rows.map(row=>{
                const moved=transfers.get(key(row.codigo))||{inside:0,outside:0};
                const delivered=Math.max(0,number(row.entregadoReal??row.entregado));
                const leftover=Math.min(delivered,row.alcance==='fuera_plan'?moved.outside:moved.inside);
                const planned=Math.max(0,number(row.planeado));
                return{...row,sobrantes:leftover,pendiente:row.alcance==='fuera_plan'?0:Math.max(0,planned-number(row.entregado)),estado:row.alcance==='fuera_plan'||number(row.entregado)>=planned?'completo':'pendiente'};
            });
        };
    }
    window.sincronizarPlanConMovimientosLocal=function(){
        if(typeof originalSync==='function')originalSync();
        if(!Array.isArray(window.planProyectoActual))return;
        const rows=typeof window.datosReporteAlcance==='function'?window.datosReporteAlcance().filter(item=>item.alcance==='dentro_plan'):[];
        const byCode=new Map(rows.map(item=>[key(item.codigo),item]));
        window.planProyectoActual=window.planProyectoActual.map(line=>{
            const item=byCode.get(key(line.codigo||line.material?.codigo));
            const planned=Math.max(0,number(line.cantidadPlaneada));
            const delivered=item?Math.min(planned,Math.max(0,number(item.entregado))):Math.min(planned,Math.max(0,number(line.cantidadEntregada)));
            const leftover=item?Math.min(delivered,Math.max(0,number(item.sobrantes))):Math.min(delivered,Math.max(0,number(line.cantidadSobrante)));
            return{...line,cantidadEntregada:delivered,cantidadSobrante:leftover,cantidadPendiente:Math.max(0,planned-delivered)};
        });
        if(!window.editandoPlan)window.planBorrador=window.planProyectoActual.map(line=>typeof window.copiarLineaPlan==='function'?window.copiarLineaPlan(line):{...line});
        if(typeof window.actualizarResumenProyectoDesdePlan==='function')window.actualizarResumenProyectoDesdePlan();
    };
    window.estadoVisualPlan=function(line){
        const request=text(line.estadoSolicitud??line.estado_solicitud).toLowerCase()||'pendiente';
        const planned=Math.max(0,number(line.cantidadPlaneada));
        const delivered=Math.max(0,number(line.cantidadEntregada));
        const leftover=Math.max(0,number(line.cantidadSobrante));
        const pending=Math.max(0,number(line.cantidadPendiente??(planned-delivered)));
        if(request==='rechazada')return{texto:'Rechazada',detalle:text(line.rechazoMotivo)||'La solicitud fue rechazada.',clase:'border-rose-500/30 bg-rose-950/20 text-rose-300'};
        if(request!=='aprobada')return{texto:'Aún en aprobación',detalle:'Todavía no puede surtirse como parte del plan.',clase:'border-amber-500/30 bg-amber-950/20 text-amber-300'};
        if(planned>0&&pending<=0)return{texto:leftover>0?'Completo con sobrante':'Completo',detalle:leftover>0?`${delivered} entregado · ${leftover} sobrante registrado`:`${delivered} de ${planned} entregado`,clase:leftover>0?'border-amber-500/30 bg-amber-950/20 text-amber-300':'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'};
        if(delivered>0)return{texto:'Entrega parcial',detalle:`Faltan ${pending} · Sobrante: ${leftover}`,clase:'border-blue-500/30 bg-blue-950/20 text-blue-300'};
        return{texto:'Pendiente',detalle:`Faltan ${pending||planned}`,clase:'border-[#34415f] bg-[#10172a] text-gray-300'};
    };
})();
(function(){
'use strict';
let catalogoHerramientasV14=[];
let planHerramientasV14=[];
let asignacionesHerramientasV14=[];
let borradorHerramientasV14=new Map();
const textoV14=value=>String(value??'').trim();
const claveV14=value=>textoV14(value).toLocaleLowerCase('es-MX');
const numeroV14=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
const escaparV14=value=>typeof escapeHTML==='function'?escapeHTML(value):textoV14(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const prioridadV14=value=>({critica:'Crítica',alta:'Alta',normal:'Normal',baja:'Baja'})[textoV14(value)]||textoV14(value)||'Normal';
function asignacionesActivasV14(){return asignacionesHerramientasV14.filter(item=>item.estadoDb==='activa'||item.estado==='activa'||item.estado==='vencida')}
function asignadasHerramientaV14(id){return asignacionesActivasV14().filter(item=>Number(item.unidad?.herramienta?.id)===Number(id)).length}
async function cargarHerramientasProyectoV14(){
    if(typeof proyectoActual==='undefined'||!proyectoActual?.proyecto)return;
    const numero=proyectoActual.proyecto;
    try{
        [catalogoHerramientasV14,planHerramientasV14,asignacionesHerramientasV14]=await Promise.all([
            SkilledDB.listTools(),
            SkilledDB.listProjectToolPlan(numero),
            SkilledDB.listToolAssignments({project:numero})
        ]);
        if(!proyectoActual||claveV14(proyectoActual.proyecto)!==claveV14(numero))return;
        renderHerramientasProyectoV14();
    }catch(error){
        const tbody=document.getElementById('tabla-plan-herramientas-proyecto');
        if(tbody)tbody.innerHTML=`<tr><td colspan="7" class="px-5 py-12 text-center text-xs text-rose-400">${escaparV14(error.message)}</td></tr>`;
    }
}
function renderHerramientasProyectoV14(){
    const tbody=document.getElementById('tabla-plan-herramientas-proyecto');
    if(!tbody)return;
    const empty=document.getElementById('vacio-plan-herramientas-proyecto');
    const required=planHerramientasV14.reduce((sum,item)=>sum+numeroV14(item.cantidadRequerida),0);
    const assigned=asignacionesActivasV14().length;
    const pending=planHerramientasV14.reduce((sum,item)=>sum+Math.max(0,numeroV14(item.cantidadRequerida)-asignadasHerramientaV14(item.herramientaId)),0);
    document.getElementById('proyecto-hta-requeridas').textContent=formatoNumero.format(required);
    document.getElementById('proyecto-hta-asignadas').textContent=formatoNumero.format(assigned);
    document.getElementById('proyecto-hta-pendientes').textContent=formatoNumero.format(pending);
    document.getElementById('badge-herramientas-proyecto').textContent=formatoNumero.format(planHerramientasV14.length);
    empty?.classList.toggle('hidden',planHerramientasV14.length>0);
    tbody.innerHTML=planHerramientasV14.map(item=>{
        const assignedCount=asignadasHerramientaV14(item.herramientaId);
        const pendingCount=Math.max(0,numeroV14(item.cantidadRequerida)-assignedCount);
        const priorityStyle=item.prioridad==='critica'?'text-rose-300 border-rose-500/30 bg-rose-950/20':item.prioridad==='alta'?'text-amber-300 border-amber-500/30 bg-amber-950/20':'text-blue-300 border-blue-500/30 bg-blue-950/20';
        return `<tr class="border-b border-[#161f38]"><td class="px-4 py-3"><div class="font-semibold text-white">${escaparV14(item.herramienta?.descripcion||item.herramienta?.sku)}</div><div class="mt-1 text-[9px] text-gray-500 font-mono">${escaparV14(item.herramienta?.sku)} · ${escaparV14(item.herramienta?.marca||'Sin marca')}</div></td><td class="px-4 py-3 text-gray-400">${escaparV14(item.herramienta?.clasificacion||'—')}</td><td class="px-4 py-3 text-center font-bold text-white">${formatoNumero.format(item.cantidadRequerida)}</td><td class="px-4 py-3 text-center font-bold text-emerald-400">${formatoNumero.format(assignedCount)}</td><td class="px-4 py-3 text-center font-bold ${pendingCount?'text-amber-400':'text-gray-500'}">${formatoNumero.format(pendingCount)}</td><td class="px-4 py-3"><span class="inline-flex rounded-full border px-2 py-1 text-[9px] font-bold ${priorityStyle}">${escaparV14(prioridadV14(item.prioridad))}</span></td><td class="px-4 py-3 text-gray-500">${escaparV14(item.observaciones||'—')}</td></tr>`;
    }).join('');
    const container=document.getElementById('unidades-asignadas-proyecto');
    const assignmentEmpty=document.getElementById('vacio-asignaciones-proyecto');
    const active=asignacionesActivasV14();
    assignmentEmpty?.classList.toggle('hidden',active.length>0);
    if(container)container.innerHTML=active.map(item=>`<div class="grid grid-cols-[42px_1fr_auto] gap-3 items-center px-4 py-3"><div class="w-10 h-10 rounded-lg border border-[#243257] bg-[#10172a] flex items-center justify-center text-blue-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 01-5 5L3 18l3 3 6.7-6.7a4 4 0 005-5l-3 3-3-3 3-3z"/></svg></div><div><div class="text-xs font-semibold text-white">${escaparV14(item.unidad?.herramienta?.descripcion||'Herramienta')}</div><div class="mt-1 text-[9px] text-gray-500"><span class="font-mono text-blue-300">${escaparV14(item.unidad?.codigoInterno)}</span> · Serie ${escaparV14(item.unidad?.numeroSerie||'—')} · devolución ${escaparV14(item.fechaDevolucionEstimada||'sin fecha')}</div></div><a href="AL.asignaciones-herramientas.html?q=${encodeURIComponent(item.unidad?.codigoInterno||'')}" class="px-3 py-2 rounded-lg border border-[#243257] bg-[#10172a] text-[10px] font-semibold text-gray-300 hover:text-white">Ver asignación</a></div>`).join('');
}
function abrirPlanHerramientasProyectoV14(){
    if(!proyectoActual)return;
    borradorHerramientasV14=new Map(planHerramientasV14.map(item=>[Number(item.herramientaId),{herramientaId:Number(item.herramientaId),cantidadRequerida:numeroV14(item.cantidadRequerida)||1,prioridad:item.prioridad||'normal',observaciones:item.observaciones||''}]));
    const input=document.getElementById('busqueda-plan-herramientas-v14');
    if(input)input.value='';
    renderEditorHerramientasProyectoV14();
    const modal=document.getElementById('modal-plan-herramientas-proyecto-v14');
    modal?.classList.remove('hidden');modal?.classList.add('flex');
}
function cerrarPlanHerramientasProyectoV14(){const modal=document.getElementById('modal-plan-herramientas-proyecto-v14');modal?.classList.add('hidden');modal?.classList.remove('flex')}
function alternarHerramientaProyectoV14(id,checked){
    const tool=catalogoHerramientasV14.find(item=>Number(item.id)===Number(id));
    if(checked)borradorHerramientasV14.set(Number(id),{herramientaId:Number(id),cantidadRequerida:borradorHerramientasV14.get(Number(id))?.cantidadRequerida||1,prioridad:borradorHerramientasV14.get(Number(id))?.prioridad||'normal',observaciones:borradorHerramientasV14.get(Number(id))?.observaciones||''});
    else borradorHerramientasV14.delete(Number(id));
    renderEditorHerramientasProyectoV14();
}
function actualizarHerramientaProyectoV14(id,field,value){const line=borradorHerramientasV14.get(Number(id));if(!line)return;line[field]=field==='cantidadRequerida'?Math.max(1,numeroV14(value)||1):value;borradorHerramientasV14.set(Number(id),line);const count=document.getElementById('contador-plan-herramientas-v14');if(count)count.textContent=`${borradorHerramientasV14.size} herramienta${borradorHerramientasV14.size===1?'':'s'} seleccionada${borradorHerramientasV14.size===1?'':'s'}`}
function renderEditorHerramientasProyectoV14(){
    const query=claveV14(document.getElementById('busqueda-plan-herramientas-v14')?.value);
    const list=catalogoHerramientasV14.filter(item=>!query||(window.SkilledSearch?.matches?window.SkilledSearch.matches([item.sku,item.descripcion,item.clasificacion,item.marca,item.modelo],query):claveV14([item.sku,item.descripcion,item.clasificacion,item.marca,item.modelo].join(' ')).includes(query)));
    const host=document.getElementById('lista-plan-herramientas-v14');
    if(host)host.innerHTML=list.map(item=>{
        const selected=borradorHerramientasV14.has(Number(item.id));
        const line=borradorHerramientasV14.get(Number(item.id))||{};
        return `<article class="rounded-xl border ${selected?'border-blue-500/45 bg-blue-950/10':'border-[#243257] bg-[#0d1425]'} p-4"><div class="grid grid-cols-[20px_1fr] lg:grid-cols-[20px_1fr_130px_130px_1.1fr] gap-3 items-center"><input type="checkbox" ${selected?'checked':''} onchange="alternarHerramientaProyectoV14(${item.id},this.checked)" class="w-4 h-4 accent-blue-500"><div><div class="text-xs font-bold text-white">${escaparV14(item.descripcion)}</div><div class="mt-1 text-[9px] text-gray-500 font-mono">${escaparV14(item.sku)} · ${escaparV14(item.clasificacion||'Sin clasificación')} · ${escaparV14(item.marca||'Sin marca')}</div><div class="mt-1 text-[9px] text-emerald-400">${formatoNumero.format(item.disponibles||0)} disponibles de ${formatoNumero.format(item.total||0)}</div></div><label class="text-[9px] uppercase tracking-wider text-gray-500 font-bold ${selected?'':'opacity-40'}">Cantidad<input ${selected?'':'disabled'} type="number" min="1" step="1" value="${line.cantidadRequerida||1}" onchange="actualizarHerramientaProyectoV14(${item.id},'cantidadRequerida',this.value)" class="mt-1 w-full bg-[#060a14] border border-[#243257] rounded-lg px-3 py-2 text-xs text-gray-300"></label><label class="text-[9px] uppercase tracking-wider text-gray-500 font-bold ${selected?'':'opacity-40'}">Prioridad<select ${selected?'':'disabled'} onchange="actualizarHerramientaProyectoV14(${item.id},'prioridad',this.value)" class="mt-1 w-full bg-[#060a14] border border-[#243257] rounded-lg px-3 py-2 text-xs text-gray-300"><option value="normal" ${line.prioridad==='normal'?'selected':''}>Normal</option><option value="alta" ${line.prioridad==='alta'?'selected':''}>Alta</option><option value="critica" ${line.prioridad==='critica'?'selected':''}>Crítica</option><option value="baja" ${line.prioridad==='baja'?'selected':''}>Baja</option></select></label><label class="text-[9px] uppercase tracking-wider text-gray-500 font-bold ${selected?'':'opacity-40'}">Observaciones<input ${selected?'':'disabled'} value="${escaparV14(line.observaciones||'')}" onchange="actualizarHerramientaProyectoV14(${item.id},'observaciones',this.value)" class="mt-1 w-full bg-[#060a14] border border-[#243257] rounded-lg px-3 py-2 text-xs text-gray-300"></label></div></article>`;
    }).join('')||'<div class="py-14 text-center text-xs text-gray-500">No hay herramientas que coincidan con la búsqueda.</div>';
    const count=document.getElementById('contador-plan-herramientas-v14');
    if(count)count.textContent=`${borradorHerramientasV14.size} herramienta${borradorHerramientasV14.size===1?'':'s'} seleccionada${borradorHerramientasV14.size===1?'':'s'}`;
}
async function guardarPlanHerramientasProyectoV14(){
    if(!proyectoActual)return;
    const button=document.getElementById('guardar-plan-herramientas-v14');
    button.disabled=true;button.textContent='Guardando...';
    try{
        planHerramientasV14=await SkilledDB.saveProjectToolPlan(proyectoActual.proyecto,[...borradorHerramientasV14.values()]);
        cerrarPlanHerramientasProyectoV14();
        renderHerramientasProyectoV14();
    }catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='Guardar selección'}
}
function abrirAsignacionHerramientasProyectoV14(){if(!proyectoActual)return;location.href=`AL.asignaciones-herramientas.html?proyecto=${encodeURIComponent(proyectoActual.proyecto)}&nueva=1`}
async function descargarReporteAlcancePdfV14(){
    if(typeof window.descargarReporteAlcancePdfV16==='function')return window.descargarReporteAlcancePdfV16();
    alert('El generador de PDF todavía no terminó de cargar. Espera un momento y vuelve a intentar.');
}
const abrirProyectoAnteriorV14=abrirProyecto;
abrirProyecto=async function(){const result=await abrirProyectoAnteriorV14.apply(this,arguments);await cargarHerramientasProyectoV14();return result};
const actualizarDetalleAnteriorV14=actualizarDetalle;
actualizarDetalle=async function(){const result=await actualizarDetalleAnteriorV14.apply(this,arguments);await cargarHerramientasProyectoV14();return result};
const cambiarTabAnteriorV14=cambiarTab;
cambiarTab=function(tab){const result=cambiarTabAnteriorV14.apply(this,arguments);if(tab==='herramientas')cargarHerramientasProyectoV14();return result};
const volverAnteriorV14=volverALista;
volverALista=function(){catalogoHerramientasV14=[];planHerramientasV14=[];asignacionesHerramientasV14=[];return volverAnteriorV14.apply(this,arguments)};
window.cargarHerramientasProyectoV14=cargarHerramientasProyectoV14;
window.renderHerramientasProyectoV14=renderHerramientasProyectoV14;
window.abrirPlanHerramientasProyectoV14=abrirPlanHerramientasProyectoV14;
window.cerrarPlanHerramientasProyectoV14=cerrarPlanHerramientasProyectoV14;
window.alternarHerramientaProyectoV14=alternarHerramientaProyectoV14;
window.actualizarHerramientaProyectoV14=actualizarHerramientaProyectoV14;
window.renderEditorHerramientasProyectoV14=renderEditorHerramientasProyectoV14;
window.guardarPlanHerramientasProyectoV14=guardarPlanHerramientasProyectoV14;
window.abrirAsignacionHerramientasProyectoV14=abrirAsignacionHerramientasProyectoV14;
window.descargarReporteAlcancePdfV14=descargarReporteAlcancePdfV14;
document.getElementById('modal-plan-herramientas-proyecto-v14')?.addEventListener('click',event=>{if(event.target.id==='modal-plan-herramientas-proyecto-v14')cerrarPlanHerramientasProyectoV14()});
})();
(function(){
'use strict';
const BRAND={navy:'FF003763',blue:'FF00416B',red:'FFEA0029',slate:'FF7588A5',light:'FFDBE3EF',border:'FF8AA0BF',white:'FFFFFFFF',soft:'FFF5F8FC'};
const text=value=>String(value??'').trim();
const safeName=value=>text(value).replace(/[^a-z0-9_-]+/gi,'_')||'proyecto';
function withTimeout(promise,ms,message){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message||'La operación tardó demasiado.')),ms))])}
function loadScript(src,test,timeoutMs=8000){return new Promise((resolve,reject)=>{try{if(test())return resolve();[...document.scripts].filter(script=>script.src===src).forEach(script=>script.remove())}catch(_){}const script=document.createElement('script');let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){script.remove();reject(error)}else resolve()};script.src=src;script.async=true;script.onload=()=>test()?finish():finish(new Error(`El recurso cargó, pero no quedó disponible: ${src}`));script.onerror=()=>finish(new Error(`No se pudo cargar ${src}`));const timer=setTimeout(()=>finish(new Error(`Tiempo agotado al cargar ${src}`)),timeoutMs);document.head.appendChild(script)})}
async function ensureExcel(){await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',()=>Boolean(window.ExcelJS),9000)}
async function ensurePdf(){await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>Boolean(window.jspdf?.jsPDF),9000);await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>{try{const Ctor=window.jspdf?.jsPDF;return Boolean(Ctor&&Ctor.API&&typeof Ctor.API.autoTable==='function')}catch(_){return false}},9000)}
async function logoBase64(){try{const response=await withTimeout(fetch('logo-reporte.png',{cache:'force-cache'}),2500,'El logo tardó demasiado.');if(!response.ok)throw new Error();const blob=await response.blob();return await withTimeout(new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)}),2000,'No se pudo preparar el logo.')}catch(_){return''}}
function selectedData(){return typeof datosReporteSeleccionados==='function'?datosReporteSeleccionados():[]}
function selectedColumns(){const preferred=['planeado','entregado','sobrantes'];try{return preferred.filter(column=>reporteColumnasSeleccionadas.has(column))}catch(error){return preferred}}
function labelColumn(column){return column==='planeado'?'Planeado':column==='entregado'?'Entregado':'Sobrantes'}
function columnColor(column){return column==='planeado'?BRAND.blue:column==='entregado'?BRAND.red:BRAND.slate}
function projectValue(...keys){for(const key of keys){const value=proyectoActual?.[key];if(value!==undefined&&value!==null&&text(value)!=='')return text(value)}return'—'}
function borderStyle(){return{top:{style:'thin',color:{argb:BRAND.border}},left:{style:'thin',color:{argb:BRAND.border}},bottom:{style:'thin',color:{argb:BRAND.border}},right:{style:'thin',color:{argb:BRAND.border}}}}
function setCell(cell,{font,fill,alignment,border,numFmt}={}){if(font)cell.font=font;if(fill)cell.fill=fill;if(alignment)cell.alignment=alignment;if(border)cell.border=border;if(numFmt)cell.numFmt=numFmt}
async function exportExcel(){
const data=selectedData();const columns=selectedColumns();
if(!data.length||!columns.length)return alert('Selecciona al menos un material y una columna antes de descargar el reporte.');
const button=[...document.querySelectorAll('button')].find(item=>String(item.getAttribute('onclick')||'').includes('descargarReporteExcel'));
const previous=button?.textContent;if(button){button.disabled=true;button.textContent='Generando Excel…'}
try{
await ensureExcel();
const workbook=new ExcelJS.Workbook();workbook.creator='Skilled Proyectos Industriales';workbook.created=new Date();workbook.modified=new Date();
const sheet=workbook.addWorksheet('Reporte de alcance',{views:[{state:'frozen',ySplit:12,showGridLines:false}]});
const totalColumns=3+columns.length*2;const lastColumn=sheet.getColumn(totalColumns).letter;
sheet.properties.defaultRowHeight=18;sheet.pageSetup={paperSize:1,orientation:totalColumns>7?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.35,bottom:.35,header:.15,footer:.15}};
sheet.mergeCells('A1:C4');const logo=await logoBase64();if(logo){const imageId=workbook.addImage({base64:logo,extension:'png'});sheet.addImage(imageId,{tl:{col:.1,row:.25},ext:{width:250,height:74}})}else{sheet.getCell('A1').value='SKILLED PROYECTOS INDUSTRIALES';setCell(sheet.getCell('A1'),{font:{name:'Arial',size:16,bold:true,color:{argb:BRAND.blue}},alignment:{vertical:'middle',horizontal:'left'}})}
sheet.mergeCells(`D1:${lastColumn}2`);const title=sheet.getCell('D1');title.value='REPORTE DE ALCANCE';setCell(title,{font:{name:'Arial',size:18,bold:true,color:{argb:BRAND.navy}},alignment:{vertical:'middle',horizontal:'right'}});
sheet.mergeCells(`D3:${lastColumn}3`);const projectTitle=sheet.getCell('D3');projectTitle.value=`Proyecto ${projectValue('proyecto','idProyecto')} — ${projectValue('nombreProyecto','nombre_proyecto')}`;setCell(projectTitle,{font:{name:'Arial',size:11,bold:true,color:{argb:BRAND.blue}},alignment:{horizontal:'right'}});
sheet.mergeCells(`D4:${lastColumn}4`);const dateCell=sheet.getCell('D4');dateCell.value=new Date();dateCell.numFmt='dd/mm/yyyy';setCell(dateCell,{font:{name:'Arial',size:9,color:{argb:BRAND.slate}},alignment:{horizontal:'right'}});
for(let c=1;c<=totalColumns;c+=1){sheet.getCell(5,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:BRAND.navy}}}
const meta=[['Proyecto',projectValue('proyecto','idProyecto')],['Nombre',projectValue('nombreProyecto','nombre_proyecto')],['Cliente',projectValue('cliente')],['Orden de compra',projectValue('ordenCompra','orden_compra')],['Planta',projectValue('planta')],['Nave',projectValue('nave')],['Responsable',projectValue('responsableSkilled','responsable_skilled')],['Fecha de asignación',projectValue('fechaAsignacion','fecha_asignacion')],['Fecha de entrega',projectValue('fechaEntrega','fecha_entrega')]];
let row=6;for(const [label,value] of meta){sheet.getCell(row,1).value=label;sheet.mergeCells(row,2,row,totalColumns);sheet.getCell(row,2).value=value;setCell(sheet.getCell(row,1),{font:{name:'Arial',size:9,bold:true,color:{argb:BRAND.navy}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:BRAND.light}},alignment:{vertical:'middle'},border:borderStyle()});for(let c=2;c<=totalColumns;c+=1)setCell(sheet.getCell(row,c),{font:{name:'Arial',size:9,color:{argb:BRAND.navy}},alignment:{vertical:'middle',wrapText:true},border:borderStyle()});row+=1}
row+=1;
const groups=new Map();data.forEach(item=>{const category=text(item.categoria)||'SIN CATEGORÍA';if(!groups.has(category))groups.set(category,[]);groups.get(category).push(item)});
for(const [category,items] of groups){sheet.mergeCells(row,1,row,totalColumns);const categoryCell=sheet.getCell(row,1);categoryCell.value=category.toUpperCase();setCell(categoryCell,{font:{name:'Arial',size:11,bold:true,color:{argb:BRAND.white}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:BRAND.navy}},alignment:{horizontal:'center',vertical:'middle'},border:borderStyle()});sheet.getRow(row).height=23;row+=1;
sheet.mergeCells(row,1,row+1,1);sheet.mergeCells(row,2,row+1,2);sheet.mergeCells(row,3,row+1,3);sheet.getCell(row,1).value='Pos.';sheet.getCell(row,2).value='Código';sheet.getCell(row,3).value='Descripción';let col=4;for(const metric of columns){sheet.mergeCells(row,col,row,col+1);sheet.getCell(row,col).value=labelColumn(metric);sheet.getCell(row+1,col).value='Cantidad';sheet.getCell(row+1,col+1).value='Unidad';col+=2}for(let r=row;r<=row+1;r+=1){for(let c=1;c<=totalColumns;c+=1){const metricIndex=c>=4?Math.floor((c-4)/2):-1;const metric=metricIndex>=0?columns[metricIndex]:null;setCell(sheet.getCell(r,c),{font:{name:'Arial',size:9,bold:true,color:{argb:metric?columnColor(metric):BRAND.navy}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:BRAND.light}},alignment:{horizontal:'center',vertical:'middle',wrapText:true},border:borderStyle()})}}sheet.getRow(row).height=22;sheet.getRow(row+1).height=20;row+=2;
items.forEach((item,index)=>{sheet.getCell(row,1).value=index+1;sheet.getCell(row,2).value=text(item.codigo);sheet.getCell(row,3).value=text(item.descripcion);let c=4;for(const metric of columns){sheet.getCell(row,c).value=Number(item[metric]||0);sheet.getCell(row,c+1).value=text(item.unidad);setCell(sheet.getCell(row,c),{font:{name:'Arial',size:9,bold:true,color:{argb:columnColor(metric)}},alignment:{horizontal:'center',vertical:'middle'},border:borderStyle(),numFmt:'0.00'});setCell(sheet.getCell(row,c+1),{font:{name:'Arial',size:9,color:{argb:columnColor(metric)}},alignment:{horizontal:'center',vertical:'middle'},border:borderStyle()});c+=2}for(let base=1;base<=3;base+=1)setCell(sheet.getCell(row,base),{font:{name:'Arial',size:9,color:{argb:base===3?BRAND.navy:BRAND.slate}},alignment:{horizontal:base===1?'center':'left',vertical:'middle',wrapText:true},border:borderStyle(),fill:index%2?{type:'pattern',pattern:'solid',fgColor:{argb:BRAND.soft}}:undefined});sheet.getRow(row).height=32;row+=1});row+=2}
sheet.getColumn(1).width=7;sheet.getColumn(2).width=22;sheet.getColumn(3).width=52;for(let c=4;c<=totalColumns;c+=2){sheet.getColumn(c).width=13;sheet.getColumn(c+1).width=13}
sheet.headerFooter.oddFooter='&LSkilled Proyectos Industriales&CReporte de alcance&R Página &P de &N';sheet.pageSetup.printArea=`A1:${lastColumn}${Math.max(1,row-1)}`;
const buffer=await workbook.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`Reporte_Alcance_${safeName(projectValue('proyecto','idProyecto'))}.xlsx`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}catch(error){console.error(error);alert(`No se pudo generar el Excel: ${error.message}`)}finally{if(button){button.disabled=false;button.textContent=previous||'Descargar Excel'}}
}
function metricValue(item,metric){const amount=Number(item?.[metric]||0);const unit=text(item?.unidad);return `${Number.isFinite(amount)?amount.toLocaleString('es-MX',{maximumFractionDigits:2}):'0'}${unit?` ${unit}`:''}`}
function rgb(hex){const raw=String(hex||'').replace(/^FF/,'').replace('#','').slice(-6);return[parseInt(raw.slice(0,2),16)||0,parseInt(raw.slice(2,4),16)||0,parseInt(raw.slice(4,6),16)||0]}
function addReportHeader(doc,logo,orientation){
    const pageWidth=doc.internal.pageSize.getWidth();
    const navy=rgb(BRAND.navy),blue=rgb(BRAND.blue),red=rgb(BRAND.red),slate=rgb(BRAND.slate);
    if(logo){try{doc.addImage(logo,'PNG',12,8,42,12,undefined,'FAST')}catch(_){doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...blue);doc.text('SKILLED',12,15)}}else{doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...blue);doc.text('SKILLED PROYECTOS INDUSTRIALES',12,15)}
    doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...navy);doc.text('REPORTE DE ALCANCE',pageWidth-12,13,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...slate);doc.text(`Proyecto ${projectValue('proyecto','idProyecto')} · ${projectValue('nombreProyecto','nombre_proyecto')}`,pageWidth-12,18,{align:'right'});
    doc.setDrawColor(...blue);doc.setLineWidth(.55);doc.line(12,23,pageWidth-12,23);doc.setDrawColor(...red);doc.setLineWidth(.8);doc.line(12,24,pageWidth-12,24);
}
function addReportFooter(doc){
    const pages=doc.getNumberOfPages();const slate=rgb(BRAND.slate),blue=rgb(BRAND.blue);
    for(let page=1;page<=pages;page+=1){doc.setPage(page);const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight();doc.setDrawColor(...blue);doc.setLineWidth(.2);doc.line(12,h-10,w-12,h-10);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...slate);doc.text('Skilled Proyectos Industriales · Reporte de alcance',12,h-6);doc.text(`Página ${page} de ${pages}`,w-12,h-6,{align:'right'})}
}
async function exportPdf(){
    const data=selectedData();const columns=selectedColumns();
    if(!data.length||!columns.length)return alert('Selecciona al menos un material y una columna antes de descargar el reporte.');
    const button=[...document.querySelectorAll('button')].find(item=>String(item.getAttribute('onclick')||'').includes('descargarReporteAlcancePdf'));
    const previous=button?.textContent;if(button){button.disabled=true;button.textContent='Preparando PDF…'}
    try{
        await withTimeout(ensurePdf(),20000,'No se pudo iniciar el generador de PDF. Revisa la conexión y vuelve a intentar.');
        const {jsPDF}=window.jspdf;
        const orientation=columns.length>=3?'landscape':'portrait';
        const doc=new jsPDF({orientation,unit:'mm',format:'letter',compress:true,putOnlyUsedFonts:true});
        if(typeof doc.autoTable!=='function')throw new Error('El módulo de tablas PDF no quedó disponible.');
        const logo=await logoBase64();
        const navy=rgb(BRAND.navy),blue=rgb(BRAND.blue),red=rgb(BRAND.red),slate=rgb(BRAND.slate),light=rgb(BRAND.light),border=rgb(BRAND.border);
        const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
        addReportHeader(doc,logo,orientation);
        let y=31;
        const meta=[
            ['Proyecto',projectValue('proyecto','idProyecto')],['Nombre',projectValue('nombreProyecto','nombre_proyecto')],
            ['Cliente',projectValue('cliente')],['Orden de compra',projectValue('ordenCompra','orden_compra')],
            ['Planta',projectValue('planta')],['Nave',projectValue('nave')],['Responsable',projectValue('responsableSkilled','responsable_skilled')],
            ['Periodo',`${projectValue('fechaAsignacion','fecha_asignacion')} - ${projectValue('fechaEntrega','fecha_entrega')}`]
        ];
        const metaRows=[];for(let i=0;i<meta.length;i+=2){const a=meta[i],b=meta[i+1]||['',''];metaRows.push([a[0],a[1],b[0],b[1]])}
        doc.autoTable({startY:y,margin:{left:12,right:12,top:29,bottom:15},body:metaRows,theme:'grid',styles:{font:'helvetica',fontSize:7.6,cellPadding:1.7,textColor:navy,lineColor:border,lineWidth:.15,valign:'middle'},columnStyles:{0:{fontStyle:'bold',fillColor:light,cellWidth:24},1:{cellWidth:(pageWidth-24-24-24)/2},2:{fontStyle:'bold',fillColor:light,cellWidth:24},3:{cellWidth:'auto'}},didDrawPage:()=>addReportHeader(doc,logo,orientation)});
        y=(doc.lastAutoTable?.finalY||y)+5;
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...slate);
        doc.text(`${data.length} material${data.length===1?'':'es'} · Columnas: ${columns.map(labelColumn).join(', ')} · Generado ${new Date().toLocaleString('es-MX')}`,12,y);
        y+=5;
        const groups=new Map();data.forEach(item=>{const category=text(item.categoria)||'SIN CATEGORÍA';if(!groups.has(category))groups.set(category,[]);groups.get(category).push(item)});
        let categoryIndex=0;
        for(const [category,items] of groups){
            if(y>pageHeight-34){doc.addPage();addReportHeader(doc,logo,orientation);y=31}
            doc.setFillColor(...navy);doc.roundedRect(12,y,pageWidth-24,7,1.2,1.2,'F');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text(`${category.toUpperCase()} · ${items.length} material${items.length===1?'':'es'}`,15,y+4.7);y+=9;
            const head=[['#','Código','Descripción',...columns.map(labelColumn)]];
            const body=items.map((item,index)=>[index+1,text(item.codigo)||'—',text(item.descripcion)||'—',...columns.map(metric=>metricValue(item,metric))]);
            const styles={font:'helvetica',fontSize:orientation==='landscape'?7.2:7,cellPadding:1.55,textColor:navy,lineColor:border,lineWidth:.12,valign:'middle',overflow:'linebreak'};
            const colStyles={0:{halign:'center',cellWidth:8,textColor:slate},1:{cellWidth:orientation==='landscape'?31:27,fontStyle:'bold'},2:{cellWidth:'auto'}};
            columns.forEach((metric,index)=>{const color=rgb(columnColor(metric));colStyles[index+3]={halign:'center',cellWidth:orientation==='landscape'?31:27,textColor:color,fontStyle:'bold'}});
            doc.autoTable({startY:y,head,body,theme:'grid',margin:{left:12,right:12,top:29,bottom:15},styles,columnStyles:colStyles,headStyles:{fillColor:light,textColor:navy,fontStyle:'bold',halign:'center',lineColor:border,lineWidth:.15},alternateRowStyles:{fillColor:[247,249,252]},rowPageBreak:'avoid',showHead:'everyPage',didDrawPage:()=>addReportHeader(doc,logo,orientation)});
            y=(doc.lastAutoTable?.finalY||y)+5;categoryIndex+=1;
        }
        addReportFooter(doc);
        if(button)button.textContent='Descargando…';
        doc.save(`Reporte_Alcance_${safeName(projectValue('proyecto','idProyecto'))}.pdf`);
    }catch(error){console.error('PDF alcance V116',error);alert(`No se pudo generar el PDF: ${error.message||error}`)}finally{if(button){button.disabled=false;button.textContent=previous||'Descargar PDF'}}
}
window.descargarReporteExcel=exportExcel;
window.descargarReporteAlcancePdfV14=exportPdf;
window.descargarReporteAlcancePdfV15=exportPdf;
window.descargarReporteAlcancePdfV16=exportPdf;
})();

(function(){
'use strict';
const done=new Set(['finalizado','finalizada','cerrado','cerrada','completado','completada']);
const original=window.renderDetalle;
function sync(){const button=document.getElementById('btn-devolver-sobrantes');if(!button)return;const project=typeof proyectoActual!=='undefined'?proyectoActual:null;const state=String(project?.estado??'').trim().toLocaleLowerCase('es-MX');const number=String(project?.proyecto??project?.idProyecto??'').trim();const visible=done.has(state)&&number;button.classList.toggle('hidden',!visible);button.href=visible?`AL.devolucion-sobrantes.html?proyecto=${encodeURIComponent(number)}`:'AL.devolucion-sobrantes.html'}
if(typeof original==='function')window.renderDetalle=function(){const result=original.apply(this,arguments);sync();return result};
document.addEventListener('DOMContentLoaded',sync,{once:true});
})();
