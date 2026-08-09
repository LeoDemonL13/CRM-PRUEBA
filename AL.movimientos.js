'use strict';
'use strict';
'use strict';
(function(){
    'use strict';
    let view='pendientes';
    let entrySource='almacen';
    let rendered=[];
    let transferMode='almacen';
    let transferDestinationProject='';
    let systemOrderGroups=[];
    const quantityDrafts=new Map();
    const text=v=>String(v??'').trim();
    const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
    const key=v=>text(v).toLocaleLowerCase('es-MX');
    const html=v=>typeof escapeHTML==='function'?escapeHTML(v):text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const project=()=>text(document.getElementById('proyecto_val')?.value);
    const destinationProject=()=>text(document.getElementById('proyecto_destino_traspaso')?.value||transferDestinationProject);
    const isOutside=line=>Boolean(line?.fueraPlan||line?.fuera_plan);
    const productOf=line=>{
        const base=line?.material||{codigo:line?.codigo,desc:line?.descripcion,descripcion:line?.descripcion,unidad:line?.unidad,categoria:line?.categoria};
        const fresh=(catalogoProductos||[]).find(item=>key(item.codigo)===key(base?.codigo||line?.codigo));
        return fresh?{...base,...fresh,desc:fresh.desc||fresh.descripcion||base?.desc||base?.descripcion,descripcion:fresh.descripcion||fresh.desc||base?.descripcion||base?.desc}:base;
    };
    const warehouse=()=>{
        if(currentType==='salida'||currentType==='traspaso'||(currentType==='ajuste'&&key(typeof stockAdj!=='undefined'?stockAdj:'')==='disminuir'))return text(document.getElementById('bodega_origen_val')?.value||document.getElementById('bodega_destino_val')?.value);
        return text(document.getElementById('bodega_destino_val')?.value);
    };
    const generalStock=(product,name)=>{
        const rows=Array.isArray(product?.almacenes)?product.almacenes:[];
        const row=rows.find(item=>key(item.nombre)===key(name));
        if(row)return number(row.stock);
        const map=product?.stockGeneralPorAlmacen||product?.stock_general_por_almacen||{};
        const pair=Object.entries(map).find(([warehouseName])=>key(warehouseName)===key(name));
        return number(pair?.[1]);
    };
    const lineByCode=code=>(planEntregaProyecto||[]).find(line=>!isOutside(line)&&key(line.codigo)===key(code))||(planEntregaProyecto||[]).find(line=>key(line.codigo)===key(code));
    const projectStockMap=line=>line?.stockProyectoPorAlmacen||line?.stock_proyecto_por_almacen||line?.material?.stockProyectoPorAlmacen||line?.material?.stock_proyecto_por_almacen||{};
    const projectStock=(line,name)=>{
        const pair=Object.entries(projectStockMap(line)).find(([warehouseName])=>key(warehouseName)===key(name));
        return number(pair?.[1]);
    };
    const totalProjectStock=line=>Object.values(projectStockMap(line)).reduce((sum,value)=>sum+number(value),0);
    const deliveredTransferAvailable=line=>Math.max(0,number(line?.disponibleTraspaso??line?.disponible_traspaso??line?.entregadoDisponible??line?.entregado_disponible??(number(line?.entregado)-number(line?.sobrante??line?.cantidadSobrante??line?.cantidad_sobrante))));
    const entryUsesGeneral=()=>currentType==='entrada'&&Boolean(project())&&entrySource==='asignar';
    const entryAddsWarehouse=()=>currentType==='entrada'&&entrySource==='almacen';
    const entryAddsProject=()=>currentType==='entrada'&&Boolean(project())&&entrySource==='proyecto';
    const effectiveProject=()=>entryAddsWarehouse()?'':project();
    const entryRemaining=line=>Math.max(0,number(line?.requerido)-number(line?.ingresado)-lineInList(line?.codigo,'cantidadDentroPlan'));
    const stockParts=(product,line)=>{
        const name=warehouse();
        const general=generalStock(product,name);
        const transferAvailable=project()&&currentType==='traspaso'?deliveredTransferAvailable(line):0;
        const reserved=project()&&currentType!=='traspaso'?projectStock(line,name):0;
        if(!project())return{general,reserved:0,transferAvailable:0,total:general};
        if(currentType==='salida')return{general,reserved,transferAvailable:0,total:general+reserved};
        if(currentType==='traspaso')return{general:0,reserved:transferAvailable,transferAvailable,total:transferAvailable};
        if(currentType==='ajuste')return{general:0,reserved,transferAvailable:0,total:reserved};
        return{general,reserved,transferAvailable:0,total:general+reserved};
    };
    const inList=(code,type=currentType,targetProject=project())=>itemsAgregados.filter(item=>item.tipo===type&&key(item.producto?.codigo)===key(code)&&text(item.proyecto)===text(targetProject)).reduce((sum,item)=>sum+number(item.cantidad),0);
    const lineInList=(code,field,excludeId='',targetProject=project())=>itemsAgregados.filter(item=>item.tipo===currentType&&key(item.producto?.codigo)===key(code)&&text(item.proyecto)===text(targetProject)&&String(item.id)!==String(excludeId)).reduce((sum,item)=>sum+number(item[field]),0);
    function generalWarehouseRows(){
        const name=warehouse();
        if(!name)return[];
        const planMap=new Map((planEntregaProyecto||[]).map(line=>[key(line.codigo),line]));
        return(catalogoProductos||[])
            .filter(product=>generalStock(product,name)>0)
            .map(product=>{
                const existing=planMap.get(key(product.codigo));
                if(existing){
                    const state=key(existing.estadoSolicitud||existing.estado_solicitud);
                    return{
                        ...existing,
                        material:product,
                        descripcion:product.desc||product.descripcion||existing.descripcion||product.codigo,
                        categoria:product.categoria||existing.categoria,
                        unidad:product.unidad||existing.unidad,
                        desdeAlmacenGeneral:true,
                        forzarFueraPlan:state!=='aprobada',
                        lineaProyectoOriginal:existing
                    };
                }
                return{
                    id:`almacen-${product.codigo}`,
                    proyecto:project(),
                    codigo:product.codigo,
                    material:product,
                    descripcion:product.desc||product.descripcion||product.codigo,
                    categoria:product.categoria,
                    unidad:product.unidad,
                    requerido:0,
                    ingresado:0,
                    entregado:0,
                    pendiente:0,
                    cantidadPlaneada:0,
                    cantidadEntregada:0,
                    estadoSolicitud:'aprobada',
                    estado_solicitud:'aprobada',
                    fueraPlan:true,
                    fuera_plan:true,
                    desdeAlmacenGeneral:true,
                    forzarFueraPlan:true
                };
            })
            .sort((a,b)=>text(a.descripcion||a.material?.descripcion).localeCompare(text(b.descripcion||b.material?.descripcion),'es'));
    }
    function tabs(){
        const plan=(planEntregaProyecto||[]).filter(line=>!isOutside(line));
        const outside=(planEntregaProyecto||[]).filter(isOutside);
        const general=generalWarehouseRows().length;
        if(currentType==='salida')return[['pendientes',`Pendientes (${plan.filter(line=>number(line.pendiente)>0).length})`],['completados',`Completados (${plan.filter(line=>number(line.requerido)>0&&number(line.pendiente)<=0).length})`],['fuera',`Fuera del plan (${outside.length})`],['almacen_general',`Almacén general (${general})`],['proyecto',`Proyecto (${plan.length+outside.length})`]];
        if(currentType==='entrada'&&entryUsesGeneral())return[['por_surtir',`Solicitados (${plan.filter(line=>Math.max(0,number(line.requerido)-number(line.ingresado))>0).length})`],['almacen_general',`Disponibles en almacén (${general})`],['proyecto',`Proyecto (${plan.length+outside.length})`]];
        if(currentType==='entrada'&&entryAddsProject())return[['por_surtir',`Por ingresar (${plan.filter(line=>Math.max(0,number(line.requerido)-number(line.ingresado))>0).length})`],['proyecto',`Todos del proyecto (${plan.length})`],['fuera',`Extras exclusivos (${outside.length})`]];
        if(currentType==='entrada')return[];
        if(currentType==='traspaso')return[['proyecto',`Entregados (${plan.filter(line=>deliveredTransferAvailable(line)>0).length+outside.filter(line=>deliveredTransferAvailable(line)>0).length})`],['fuera',`Entregados fuera del plan (${outside.filter(line=>deliveredTransferAvailable(line)>0).length})`]];
        return[['proyecto',`Proyecto (${plan.length+outside.length})`],['fuera',`Fuera del plan (${outside.length})`]];
    }
    function defaultView(){return currentType==='salida'&&project()?'proyecto':currentType==='salida'?'pendientes':currentType==='entrada'&&(entryUsesGeneral()||entryAddsProject())?'por_surtir':'proyecto'}
    function visibleRows(){
        if(view==='almacen_general')return generalWarehouseRows();
        return(planEntregaProyecto||[]).filter(line=>{
            if(view==='pendientes')return!isOutside(line)&&number(line.pendiente)>0;
            if(view==='completados')return!isOutside(line)&&number(line.requerido)>0&&number(line.pendiente)<=0;
            if(view==='por_surtir')return!isOutside(line)&&Math.max(0,number(line.requerido)-number(line.ingresado))>0;
            if(view==='fuera')return isOutside(line)&&(currentType!=='traspaso'||deliveredTransferAvailable(line)>0);
            if(currentType==='traspaso')return deliveredTransferAvailable(line)>0;
            return true;
        });
    }
    function selectedProjectData(){
        const value=project();
        return(proyectosDisponibles||[]).find(item=>text(item.proyecto)===value)||null;
    }
    function ensureProjectInfo(){
        const wrapper=document.getElementById('wrapper-proyecto-movimiento');
        if(!wrapper)return;
        let panel=document.getElementById('informacion-proyecto-movimiento-v1298');
        if(!panel){
            panel=document.createElement('div');
            panel.id='informacion-proyecto-movimiento-v1298';
            panel.className='hidden mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-blue-500/20 bg-blue-950/5 p-4';
            wrapper.appendChild(panel);
        }
        const data=selectedProjectData();
        panel.classList.toggle('hidden',!data);
        if(!data)return;
        panel.innerHTML=`<div><p class="text-[9px] uppercase tracking-widest text-gray-500">Orden de compra del proyecto</p><p class="mt-1 text-xs font-semibold text-blue-200">${html(data.ordenCompra||'Sin orden registrada')}</p></div><div><p class="text-[9px] uppercase tracking-widest text-gray-500">Responsable del proyecto</p><p class="mt-1 text-xs font-semibold text-gray-200">${html(data.responsableSkilled||'Sin responsable registrado')}</p></div>`;
    }
    function setTransferMode(value){
        transferMode=value==='proyecto'?'proyecto':'almacen';
        if(transferMode==='almacen')transferDestinationProject='';
        itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='traspaso');
        renderLista();
        ensureTransferMode();
        updateDocumentVisibility();
        renderPlanEntregaProyecto();
    }
    window.setTransferMode=setTransferMode;
    function setEntrySource(value){
        entrySource=value==='asignar'?'asignar':value==='proyecto'?'proyecto':'almacen';
        if(entrySource==='asignar'){
            const purchase=document.getElementById('orden_compra_val');
            const date=document.getElementById('fecha_orden_compra_val');
            const reference=document.getElementById('referencia_movimiento_val');
            if(purchase)purchase.value='';
            if(date)date.value='';
            if(reference)reference.value='';
        }
        view=defaultView();
        ensureTransferMode();
        updateDocumentVisibility();
        renderPlanEntregaProyecto();
        ensureEntryMode();
    }
    function ensureEntryMode(){
        const wrapper=document.getElementById('wrapper-proyecto-movimiento');
        if(!wrapper)return;
        let box=document.getElementById('modo-entrada-proyecto-v1294');
        if(!box){
            box=document.createElement('div');
            box.id='modo-entrada-proyecto-v1294';
            box.className='hidden rounded-xl border border-[#243257] bg-[#0b1120] p-4';
            wrapper.insertAdjacentElement('afterend',box);
        }
        const visible=currentType==='entrada';
        box.classList.toggle('hidden',!visible);
        if(!visible)return;
        const selected=Boolean(project());
        const warehouseButton=`<button type="button" data-entry-source="almacen" class="rounded-xl border px-4 py-4 text-left transition ${entrySource==='almacen'?'border-emerald-500/50 bg-emerald-950/15 text-emerald-200':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}"><span class="block text-xs font-semibold">Entrada directa al almacén</span><span class="mt-1 block text-[9px] leading-relaxed opacity-80">Aumenta el stock general del almacén destino y no reserva material para ningún proyecto.</span></button>`;
        const projectButton=selected?`<button type="button" data-entry-source="proyecto" class="rounded-xl border px-4 py-4 text-left transition ${entrySource==='proyecto'?'border-violet-500/50 bg-violet-950/15 text-violet-200':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}"><span class="block text-xs font-semibold">Ingreso nuevo reservado para el proyecto</span><span class="mt-1 block text-[9px] leading-relaxed opacity-80">Registra material nuevo y lo deja disponible en la reserva exclusiva de ${html(project())} para darle salida posteriormente.</span></button>`:'';
        const assignButton=selected?`<button type="button" data-entry-source="asignar" class="rounded-xl border px-4 py-4 text-left transition ${entrySource==='asignar'?'border-blue-500/50 bg-blue-950/15 text-blue-200':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}"><span class="block text-xs font-semibold">Apartar desde almacén general</span><span class="mt-1 block text-[9px] leading-relaxed opacity-80">Descuenta stock general y lo mueve a la reserva exclusiva de ${html(project())}.</span></button>`:'';
        const projectNotice=selected&&entrySource==='proyecto'?`<div class="mt-3 rounded-xl border border-violet-500/30 bg-violet-950/15 px-4 py-3"><p class="text-xs font-semibold text-violet-200">Reserva de proyecto activa</p><p class="mt-1 text-[9px] leading-relaxed text-violet-300/80">Al finalizar, los materiales aparecerán en Salida y Préstamo como existencia reservada para ${html(project())}.</p></div>`:'';
        const projectTool=selected?`<button type="button" onclick="mostrarMaterialesProyectoParaEntrada()" class="rounded-lg border border-violet-500/30 bg-violet-950/10 px-3 py-2.5 text-[10px] font-semibold text-violet-200 hover:bg-violet-950/25">Materiales del proyecto</button>`:'';
        const actions=`<div class="mt-4 border-t border-[#1b2642] pt-4"><div class="flex items-start justify-between gap-3 mb-2"><div><p class="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Orden de compra</p><p class="mt-1 text-[9px] text-gray-600">Carga una orden creada en el CRM o importa el PDF emitido por el mismo sistema.</p></div></div><div class="grid grid-cols-1 sm:grid-cols-2 ${selected?'xl:grid-cols-3':'xl:grid-cols-2'} gap-2"><button type="button" onclick="abrirOrdenSistemaMovimiento()" class="rounded-lg border border-cyan-500/30 bg-cyan-950/10 px-3 py-2.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-950/25">Usar orden del sistema</button><button type="button" onclick="window.SkilledPurchaseOrders&&SkilledPurchaseOrders.importar()" class="rounded-lg border border-blue-500/30 bg-blue-950/10 px-3 py-2.5 text-[10px] font-semibold text-blue-200 hover:bg-blue-950/25">Importar PDF de orden</button>${projectTool}</div></div>`;
        box.innerHTML=`<div class="flex items-start justify-between gap-3 mb-3"><div><p class="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Destino de la entrada</p><p class="mt-1 text-[10px] text-gray-500">${selected?'Define si la existencia será general, una entrada nueva reservada o un apartado tomado del almacén general.':'No hay proyecto seleccionado: todo lo registrado ingresará directamente al stock general del almacén.'}</p></div></div><div class="grid grid-cols-1 ${selected?'lg:grid-cols-3':''} gap-3">${warehouseButton}${projectButton}${assignButton}</div>${projectNotice}${actions}`;
        box.querySelectorAll('[data-entry-source]').forEach(button=>button.addEventListener('click',()=>setEntrySource(button.dataset.entrySource)));
    }
    function ensureSystemOrderModal(){
        if(document.getElementById('orden-sistema-movimiento-modal'))return;
        const root=document.createElement('div');
        root.id='orden-sistema-movimiento-modal';
        root.className='hidden fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm p-4 overflow-y-auto';
        root.innerHTML=`<div class="min-h-full flex items-center justify-center"><div class="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl border border-[#243257] bg-[#10172a] shadow-2xl flex flex-col"><div class="flex items-start justify-between border-b border-[#243257] px-5 py-4"><div><h2 class="text-base font-bold text-white">Usar orden creada en el sistema</h2><p class="mt-1 text-[11px] text-gray-500">Selecciona una orden y un almacén para cargar sus materiales pendientes.</p></div><button type="button" data-close-system-order class="w-9 h-9 rounded-lg text-gray-500 hover:bg-[#141d34] hover:text-white text-xl">×</button></div><div class="p-4 border-b border-[#243257]"><div class="relative"><svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input id="buscar-orden-sistema-movimiento" class="w-full rounded-lg border border-[#243257] bg-[#060a14] pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-blue-500" placeholder="Buscar orden, proveedor, almacén o material..."></div></div><div id="lista-ordenes-sistema-movimiento" class="flex-1 overflow-y-auto lista-scroll p-4"><div class="py-12 text-center text-sm text-gray-500">Consultando órdenes...</div></div></div></div>`;
        root.addEventListener('click',event=>{if(event.target===root||event.target.closest('[data-close-system-order]'))cerrarOrdenSistemaMovimiento()});
        document.body.appendChild(root);
        document.getElementById('buscar-orden-sistema-movimiento').addEventListener('input',event=>renderSystemOrders(event.target.value));
    }
    function cerrarOrdenSistemaMovimiento(){document.getElementById('orden-sistema-movimiento-modal')?.classList.add('hidden')}
    function groupSystemPurchaseOrders(requests){
        const map=new Map();
        (Array.isArray(requests)?requests:[]).forEach(request=>{
            const order=text(request.ordenCompra);
            const pending=Math.max(0,number(request.cantidadSolicitada)-number(request.cantidadRecibida));
            if(!order||pending<=0||['cancelada','recibida'].includes(key(request.estado)))return;
            const warehouseName=text(request.almacenNombre)||'Sin almacén';
            const warehouseId=Number(request.almacenId)||0;
            const groupKey=`${key(order)}::${warehouseId||key(warehouseName)}`;
            if(!map.has(groupKey))map.set(groupKey,{ordenCompra:order,fechaOrdenCompra:text(request.fechaOrdenCompra),referencia:text(request.referencia),proveedor:text(request.proveedor),contactoProveedor:text(request.contactoProveedor),almacenNombre:warehouseName,almacenId:warehouseId,pdfUrl:text(request.pdfUrl),items:[]});
            map.get(groupKey).items.push({...request,pendiente:pending});
        });
        return[...map.values()].sort((a,b)=>a.ordenCompra.localeCompare(b.ordenCompra,'es'));
    }
    function renderSystemOrders(query=''){
        const list=document.getElementById('lista-ordenes-sistema-movimiento');
        if(!list)return;
        const search=key(query);
        const filtered=systemOrderGroups.filter(group=>!search||[group.ordenCompra,group.proveedor,group.almacenNombre,...group.items.flatMap(item=>[item.materialCodigo,item.descripcion])].some(value=>key(value).includes(search)));
        if(!filtered.length){list.innerHTML='<div class="py-12 text-center text-sm text-gray-500">No hay órdenes pendientes con ese criterio.</div>';return}
        list.innerHTML=`<div class="space-y-3">${filtered.map(group=>{const index=systemOrderGroups.indexOf(group);const total=group.items.reduce((sum,item)=>sum+number(item.pendiente),0);return`<article class="rounded-xl border border-[#243257] bg-[#090d1a] p-4"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-bold text-white">${html(group.ordenCompra)}</p>${group.pdfUrl?'<span class="rounded-full border border-emerald-500/25 bg-emerald-950/15 px-2 py-1 text-[8px] font-bold text-emerald-300">Con PDF</span>':''}</div><p class="mt-1 text-[10px] text-gray-500">${html(group.proveedor||'Proveedor no asignado')} · ${html(group.almacenNombre)} · ${group.items.length} material${group.items.length===1?'':'es'}</p><div class="mt-3 flex flex-wrap gap-1.5">${group.items.slice(0,5).map(item=>`<span class="rounded border border-[#243257] bg-[#060a14] px-2 py-1 text-[8px] text-gray-400">${html(item.materialCodigo)} · ${number(item.pendiente)} ${html(item.unidad||'')}</span>`).join('')}${group.items.length>5?`<span class="px-2 py-1 text-[8px] text-gray-500">+${group.items.length-5} más</span>`:''}</div></div><div class="flex items-center gap-3 shrink-0"><div class="text-right"><p class="text-[9px] uppercase tracking-wider text-gray-500">Pendiente total</p><p class="mt-1 text-sm font-bold text-blue-300">${total.toLocaleString('es-MX')}</p></div><button type="button" data-load-system-order="${index}" class="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white">Cargar materiales</button></div></div></article>`}).join('')}</div>`;
        list.querySelectorAll('[data-load-system-order]').forEach(button=>button.addEventListener('click',()=>cargarOrdenSistemaMovimiento(Number(button.dataset.loadSystemOrder))));
    }
    window.abrirOrdenSistemaMovimiento=async function(){
        if(currentType!=='entrada')window.cambiarTipo('entrada');
        ensureSystemOrderModal();
        const root=document.getElementById('orden-sistema-movimiento-modal');
        root.classList.remove('hidden');
        document.getElementById('lista-ordenes-sistema-movimiento').innerHTML='<div class="py-12 text-center text-sm text-gray-500">Consultando órdenes...</div>';
        try{systemOrderGroups=groupSystemPurchaseOrders(await SkilledDB.listPurchaseRequests({}));renderSystemOrders(document.getElementById('buscar-orden-sistema-movimiento').value)}catch(error){document.getElementById('lista-ordenes-sistema-movimiento').innerHTML=`<div class="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 text-sm text-rose-200">${html(error.message)}</div>`}
    };
    async function cargarOrdenSistemaMovimiento(index){
        const group=systemOrderGroups[index];
        if(!group)return;
        if(project()){
            const proceed=confirm('Esta orden se generó para stock general. Se quitará el proyecto seleccionado y la entrada se registrará directamente en el almacén. ¿Continuar?');
            if(!proceed)return;
            const select=document.getElementById('proyecto_val');
            if(select)select.value='';
            await window.manejarCambioProyecto?.('');
        }
        if(itemsAgregados.some(item=>item.tipo==='entrada')){
            const replace=confirm('Ya hay materiales en la lista de entrada. ¿Deseas reemplazarlos con los de esta orden?');
            if(!replace)return;
            itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='entrada');
        }
        setEntrySource('almacen');
        const destination=document.getElementById('bodega_destino_val');
        if(destination&&group.almacenNombre){
            destination.value=group.almacenNombre;
            if(!destination.value){const option=[...destination.options].find(item=>key(item.value)===key(group.almacenNombre)||key(item.textContent)===key(group.almacenNombre));if(option)destination.value=option.value}
            await window.manejarCambioBodegaMovimiento?.('destino');
        }
        if(!text(destination?.value))return alert(`La orden corresponde a ${group.almacenNombre}. Selecciona ese almacén como destino y vuelve a cargarla.`);
        const order=document.getElementById('orden_compra_val');
        const date=document.getElementById('fecha_orden_compra_val');
        const reference=document.getElementById('referencia_movimiento_val');
        if(order)order.value=group.ordenCompra;
        if(date)date.value=group.fechaOrdenCompra;
        if(reference)reference.value=group.referencia;
        let added=0;
        const omitted=[];
        for(const request of group.items){
            const product=(catalogoProductos||[]).find(item=>key(item.codigo)===key(request.materialCodigo));
            if(!product){omitted.push(`${request.materialCodigo}: no existe en el catálogo`);continue}
            addItem(product,null,number(request.pendiente));
            const item=[...itemsAgregados].reverse().find(row=>row.tipo==='entrada'&&!row.proyecto&&key(row.producto?.codigo)===key(request.materialCodigo)&&key(row.bodegaDestino)===key(destination.value));
            if(item){
                item.solicitudCompraId=Number(request.id);
                item.solicitud_compra_id=item.solicitudCompraId;
                item.solicitudCompraFolio=text(request.folio);
                item.ordenCompra=group.ordenCompra;
                item.fechaOrdenCompra=text(group.fechaOrdenCompra);
                item.cantidadOrdenPendiente=number(request.pendiente);
                item.cantidad_orden_pendiente=item.cantidadOrdenPendiente;
                item.almacenOrden=text(group.almacenNombre);
                item.almacen_orden=item.almacenOrden;
            }
            added++;
        }
        renderLista();
        actualizarPreviewHeader();
        cerrarOrdenSistemaMovimiento();
        document.getElementById('preview-header')?.scrollIntoView({behavior:'smooth',block:'start'});
        alert(`${added} materiales cargados de ${group.ordenCompra}.${omitted.length?`\n\nNo se cargaron:\n${omitted.join('\n')}`:''}`);
    }

    window.mostrarMaterialesProyectoParaEntrada=function(){
        if(currentType!=='entrada')window.cambiarTipo('entrada');
        if(!project())return alert('Selecciona primero un proyecto.');
        setEntrySource('proyecto');
        view='por_surtir';
        renderPlanEntregaProyecto();
        document.getElementById('panel-materiales-proyecto')?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    window.obtenerDatosOrdenCompraProyecto=function(){
        const data=selectedProjectData();
        if(!data||!project())return null;
        const materiales=(planEntregaProyecto||[]).filter(line=>!isOutside(line)).map(line=>{
            const product=productOf(line);
            const requerido=Math.max(0,number(line.requerido||line.cantidadPlaneada));
            const ingresado=Math.max(0,number(line.ingresado));
            return{
                codigo:text(product.codigo||line.codigo),
                descripcion:text(product.descripcion||product.desc||line.descripcion||line.codigo),
                unidad:text(product.unidad||line.unidad||'PZA'),
                categoria:text(product.categoria||line.categoria),
                cantidadPlaneada:requerido,
                cantidadIngresada:ingresado,
                cantidad:Math.max(0,requerido-ingresado),
                precio:number(line.precioUnitario||product.precio)
            };
        });
        return{
            proyecto:text(data.proyecto||project()),
            nombreProyecto:text(data.nombreProyecto),
            cliente:text(data.cliente),
            responsable:text(data.responsableSkilled),
            ordenCompraProyecto:text(data.ordenCompra),
            materiales
        };
    };

    window.obtenerDatosOrdenCompraMovimiento=function(){
        const selected=selectedProjectData();
        const entryItems=(itemsAgregados||[]).filter(item=>item.tipo==='entrada');
        if(entryItems.length){
            return{
                proyecto:text(entryItems[0].proyecto||project()),
                nombreProyecto:text(selected?.nombreProyecto),
                cliente:text(selected?.cliente),
                responsable:text(selected?.responsableSkilled),
                ordenCompraProyecto:text(document.getElementById('orden_compra_val')?.value||selected?.ordenCompra),
                almacen:text(document.getElementById('bodega_destino_val')?.value),
                materiales:entryItems.map(item=>({codigo:text(item.producto?.codigo),descripcion:text(item.producto?.descripcion||item.producto?.desc),marca:text(item.producto?.marca),categoria:text(item.producto?.categoria),unidad:text(item.producto?.unidad),cantidadPlaneada:number(item.cantidad),cantidad:number(item.cantidad),precio:number(item.producto?.precio),almacen:text(item.bodegaDestino),almacenId:Number(item.producto?.almacenId)||null,solicitudCompraId:Number(item.solicitudCompraId)||null}))
            };
        }
        if(project())return window.obtenerDatosOrdenCompraProyecto?.();
        return null;
    };

    window.agregarOrdenCompraEstandar=async function(payload){
        if(currentType!=='entrada')window.cambiarTipo('entrada');
        const sourcePayload=payload&&typeof payload==='object'?payload:{};
        const rows=Array.isArray(sourcePayload.materiales)?sourcePayload.materiales:[];
        if(!rows.length)return{ok:false,mensaje:'La orden no contiene materiales pendientes para recibir.'};
        let currentProject=project();
        const orderProject=text(sourcePayload.proyecto);
        const generalOrder=key(sourcePayload.destinoTipo)==='almacen_general'||!orderProject;
        if(currentProject&&generalOrder){
            const proceed=confirm(`La orden ${text(sourcePayload.ordenCompra)||''} corresponde a una entrada de almacén general. Se quitará el proyecto ${currentProject} para evitar reservar los materiales por error. ¿Continuar?`);
            if(!proceed)return{ok:false,mensaje:'Importación cancelada.'};
            const projectSelect=document.getElementById('proyecto_val');
            if(projectSelect)projectSelect.value='';
            await window.manejarCambioProyecto?.('');
            currentProject='';
        }else if(currentProject&&orderProject&&key(orderProject)!==key(currentProject)){
            const proceed=confirm(`La orden corresponde al proyecto ${orderProject}, pero está seleccionado ${currentProject}. ¿Deseas cargarla en el proyecto seleccionado?`);
            if(!proceed)return{ok:false,mensaje:'Importación cancelada.'};
        }else if(!currentProject&&orderProject){
            const projectSelect=document.getElementById('proyecto_val');
            const option=projectSelect?[...projectSelect.options].find(item=>key(item.value)===key(orderProject)):null;
            if(option){
                const useProject=confirm(`La orden corresponde al proyecto ${orderProject}. ¿Deseas registrar la entrada como material reservado para ese proyecto?`);
                if(useProject){
                    projectSelect.value=option.value;
                    await window.manejarCambioProyecto?.(option.value);
                    currentProject=project();
                }
            }
        }
        if(itemsAgregados.some(item=>item.tipo==='entrada')){
            const replace=confirm('Ya hay materiales en la lista de entrada. ¿Deseas reemplazarlos con los materiales pendientes de esta orden?');
            if(!replace)return{ok:false,mensaje:'Importación cancelada.'};
            itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='entrada');
            renderLista();
            actualizarPreviewHeader();
        }
        const warehouses=[...new Set(rows.map(row=>text(row.almacen??row.almacenNombre)).filter(Boolean))];
        let destination=text(document.getElementById('bodega_destino_val')?.value);
        if(!currentProject)setEntrySource('almacen');
        else setEntrySource('proyecto');
        if(!destination&&warehouses.length===1){
            const select=document.getElementById('bodega_destino_val');
            if(select){
                const option=[...select.options].find(item=>key(item.value)===key(warehouses[0])||key(item.textContent)===key(warehouses[0]));
                if(option)select.value=option.value;
                await window.manejarCambioBodegaMovimiento?.('destino');
                destination=text(select.value);
            }
        }
        if(!destination){
            return{ok:false,mensaje:warehouses.length>1?'La orden contiene materiales de varios almacenes. Selecciona el almacén destino y vuelve a importar el PDF; se cargarán únicamente los materiales de ese almacén.':'Selecciona el almacén destino antes de importar la orden.'};
        }
        const order=document.getElementById('orden_compra_val');
        const date=document.getElementById('fecha_orden_compra_val');
        const reference=document.getElementById('referencia_movimiento_val');
        if(order)order.value=text(sourcePayload.ordenCompra);
        if(date)date.value=text(sourcePayload.fecha).slice(0,10);
        if(reference)reference.value=text(sourcePayload.referencia);
        let purchaseItems=[];
        if(text(sourcePayload.ordenCompra)&&typeof SkilledDB.listPurchaseOrderItems==='function'){
            try{purchaseItems=await SkilledDB.listPurchaseOrderItems(sourcePayload.ordenCompra)}catch(error){console.warn('No se pudieron consultar las solicitudes asociadas:',error)}
        }
        let added=0;
        const omitted=[];
        for(const row of rows){
            const rowWarehouse=text(row.almacen??row.almacenNombre);
            if(rowWarehouse&&key(rowWarehouse)!==key(destination)){
                omitted.push(`${text(row.codigo)}: corresponde a ${rowWarehouse}`);
                continue;
            }
            const product=(catalogoProductos||[]).find(item=>key(item.codigo)===key(row.codigo));
            if(!product){omitted.push(`${text(row.codigo)}: no existe en el catálogo`);continue}
            const linked=purchaseItems.find(request=>key(request.material?.codigo??request.materialCodigo)===key(row.codigo)&&number(request.pendiente)>0&&(!request.almacenNombre||key(request.almacenNombre)===key(destination)));
            const pending=number(linked?.pendiente??row.cantidadPendiente??row.pendiente??row.cantidad);
            if(pending<=0){omitted.push(`${text(row.codigo)}: ya no tiene cantidad pendiente`);continue}
            const line=currentProject?lineByCode(row.codigo):null;
            addItem(product,line,pending);
            const item=[...itemsAgregados].reverse().find(value=>value.tipo==='entrada'&&key(value.producto?.codigo)===key(row.codigo)&&text(value.proyecto)===text(currentProject?effectiveProject():'')&&key(value.bodegaDestino)===key(destination));
            if(!item){omitted.push(`${text(row.codigo)}: no pudo agregarse a la lista`);continue}
            item.solicitudCompraId=Number(row.solicitudCompraId)||Number(linked?.id)||null;
            item.solicitud_compra_id=item.solicitudCompraId;
            item.solicitudCompraFolio=text(row.folioSolicitud??linked?.folio);
            item.ordenCompra=text(sourcePayload.ordenCompra);
            item.fechaOrdenCompra=text(sourcePayload.fecha).slice(0,10);
            item.cantidadOrdenPendiente=pending;
            item.cantidad_orden_pendiente=pending;
            item.almacenOrden=rowWarehouse||text(linked?.almacenNombre)||destination;
            item.almacen_orden=item.almacenOrden;
            added++;
        }
        renderLista();
        actualizarPreviewHeader();
        renderPlanEntregaProyecto();
        if(added)document.getElementById('preview-header')?.scrollIntoView({behavior:'smooth',block:'start'});
        return{ok:added>0,agregados:added,omitidos,mensaje:added?`Se cargaron ${added} materiales pendientes de la orden ${text(sourcePayload.ordenCompra)||''}.`:'La orden no contiene materiales pendientes utilizables para el almacén seleccionado.'};
    };

    function ensureTabs(){
        const panel=document.getElementById('panel-materiales-proyecto');
        const list=document.getElementById('lista-plan-proyecto');
        if(!panel||!list)return;
        let box=document.getElementById('tabs-materiales-v129');
        document.getElementById('tabs-materiales-v125')?.remove();
        if(!box){box=document.createElement('div');box.id='tabs-materiales-v129';box.className='px-4 py-3 border-b border-[#161f38] flex flex-wrap gap-2';panel.insertBefore(box,list)}
        const defs=tabs();
        if(!defs.some(([id])=>id===view))view=defaultView();
        box.innerHTML=defs.map(([id,label])=>`<button type="button" data-view="${id}" class="px-3 py-2 rounded-lg border text-[10px] font-semibold transition ${view===id?'border-blue-500/50 bg-blue-950/20 text-blue-300':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}">${html(label)}</button>`).join('');
        box.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;renderPlanEntregaProyecto()}));
    }
    function approval(line){
        const state=key(line.estadoSolicitud||line.estado_solicitud||'pendiente');
        if(state==='aprobada')return'<span class="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/20 text-emerald-300">Aprobada</span>';
        if(state==='rechazada')return'<span class="text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-950/20 text-rose-300">Rechazada</span>';
        return'<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">Aún en aprobación</span>';
    }
    function badgeReservado(cantidad,index,etiqueta){
        const valor=number(cantidad);
        if(currentType==='salida'&&valor>0)return`<button type="button" onclick="agregarReservadoMovimientoV129(${index})" title="Agregar toda la cantidad reservada a la lista" class="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-950/20 text-violet-300 hover:bg-violet-900/30 hover:text-white cursor-pointer transition">${html(etiqueta)}: ${valor} · clic para agregar</button>`;
        return`<span class="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-950/20 text-violet-300">${html(etiqueta)}: ${valor}</span>`;
    }
    function quantityDraftKey(line){
        const product=productOf(line);
        return encodeURIComponent([currentType,project(),destinationProject(),entrySource,transferMode,key(product?.codigo||line?.codigo),line?.desdeAlmacenGeneral?'general':'plan',line?.forzarFueraPlan?'forzada':'normal'].join('|'));
    }
    window.guardarCantidadMovimientoV133=function(token,value){
        quantityDrafts.set(text(token),text(value));
    };
    function rowHtml(line,index){
        const product=productOf(line);
        const fromGeneral=Boolean(line.desdeAlmacenGeneral);
        const forcedOutside=Boolean(line.forzarFueraPlan);
        const outside=isOutside(line)||forcedOutside;
        const stocks=stockParts(product,line);
        const completed=!outside&&number(line.requerido)>0&&number(line.pendiente)<=0;
        const state=key(line.estadoSolicitud||line.estado_solicitud);
        const blocked=currentType==='salida'&&!outside&&state!=='aprobada'&&!fromGeneral;
        let badges='';
        if(currentType==='entrada'){
            const falta=Math.max(0,number(line.requerido)-number(line.ingresado));
            const estadoEntrada=outside?'Extra exclusivo':falta>0?`Falta ingresar: ${falta}`:'Requerimiento surtido';
            const modo=entryUsesGeneral()?'Asignación desde stock general':entryAddsProject()?'Ingreso nuevo exclusivo para el proyecto':'Entrada nueva al almacén';
            badges=`${outside?'<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">Fuera del plan</span>':`<span class="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-950/20 text-blue-300">Requeridos: ${number(line.requerido)}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-[#243257] bg-[#141d34] text-gray-300">Ingresados: ${number(line.ingresado)}</span>`}<span class="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-950/20 text-emerald-300">${estadoEntrada}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-950/20 text-violet-300">Reservado para este proyecto: ${stocks.reserved}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-950/20 text-blue-300">General en ${html(warehouse()||'almacén')}: ${stocks.general}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-[#243257] bg-[#141d34] text-gray-300">${modo}</span>`;
        }else if(currentType==='salida'){
            if(outside){
                const projectEntry=stocks.reserved>0?badgeReservado(stocks.reserved,index,'Entrada no solicitada del proyecto'):'<span class="text-[9px] px-1.5 py-0.5 rounded border border-[#243257] bg-[#141d34] text-gray-400">Sin entrada no solicitada para este proyecto</span>';
                const generalEntry=`<span class="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-950/20 text-emerald-300">Disponible en almacén: ${stocks.general}</span>`;
                const source=stocks.reserved>0&&stocks.general>0?'Se usará primero la entrada del proyecto':stocks.reserved>0?'Disponible solo para este proyecto':stocks.general>0?'Se tomará del stock general del almacén':'Sin existencia utilizable';
                const waitingNotice=forcedOutside?'<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">La solicitud sigue en espera; esta salida se registrará fuera del plan</span>':'';
                badges=`<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">Fuera del plan</span>${waitingNotice}${projectEntry}${generalEntry}<span class="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-950/20 text-blue-300">Total utilizable: ${stocks.total}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-[#243257] bg-[#0d1425] text-gray-400">${source}</span>`;
            }else{
                badges=`<span class="text-[9px] px-1.5 py-0.5 rounded border border-rose-500/20 bg-rose-950/20 text-rose-300">${completed?'Completo':`Pendiente: ${number(line.pendiente)}`}</span>${approval(line)}${badgeReservado(stocks.reserved,index,'Reservado para este proyecto')}<span class="text-[9px] px-1.5 py-0.5 rounded border border-[#243257] bg-[#141d34] text-gray-300">General del almacén: ${stocks.general}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-950/20 text-blue-300">Disponible: ${stocks.total}</span>`;
            }
        }else{
            badges=currentType==='traspaso'
                ?`${outside?'<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">Fuera del plan</span>':approval(line)}<span class="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-950/20 text-emerald-300">Entregado: ${number(line.entregado)}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/25 bg-amber-950/20 text-amber-300">Sobrante ya registrado: ${number(line.sobrante??line.cantidadSobrante)}</span><span class="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/25 bg-violet-950/20 text-violet-300">Disponible para traspasar: ${stocks.transferAvailable}</span>`
                :`${outside?'<span class="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300">Fuera del plan</span>':approval(line)}<span class="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-950/20 text-violet-300">Reservado para el proyecto: ${stocks.reserved}</span>`;
        }
        const noStock=(currentType==='salida'||currentType==='traspaso'||(currentType==='ajuste'&&key(typeof stockAdj!=='undefined'?stockAdj:'')==='disminuir'))&&stocks.total<=0;
        const noGeneralForEntry=entryUsesGeneral()&&stocks.general<=0;
        const disabled=blocked||(!outside&&state==='rechazada'&&!fromGeneral)||noGeneralForEntry;
        let label=completed&&currentType==='salida'?'<span class="text-[9px] text-emerald-300 whitespace-nowrap">Extra fuera del plan</span>':'';
        if(currentType==='entrada'&&!outside&&Math.max(0,number(line.requerido)-number(line.ingresado))<=0)label='<span class="text-[9px] text-amber-300 whitespace-nowrap">Agregar extra exclusivo</span>';
        if(currentType==='entrada'&&entryUsesGeneral())label='<span class="text-[9px] text-blue-300 whitespace-nowrap">Reservar para el proyecto</span>';
        if(currentType==='entrada'&&entryAddsProject())label='<span class="text-[9px] text-violet-300 whitespace-nowrap">Ingreso exclusivo para el proyecto</span>';
        if(blocked)label='<span class="text-[9px] text-amber-300 whitespace-nowrap">Aún en aprobación</span>';
        const disponibilidad=currentType==='salida'
            ?blocked
                ?'<span class="block mt-1 text-[8px] text-amber-300">No se puede dar salida hasta que la solicitud sea aprobada.</span>'
                :`<span class="block mt-1 text-[8px] ${stocks.total>0?'text-blue-300':'text-rose-400'}">${stocks.total>0?`Puedes capturar hasta ${stocks.total} entre reserva y almacén general`:'Puedes escribir la cantidad; al agregar se volverá a consultar la existencia'}</span>`
            :'';
        const avisoAprobacion=blocked?'<div class="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[9px] leading-relaxed text-amber-200"><strong>Aún en aprobación.</strong> Este material no puede añadirse a una salida del plan hasta que la solicitud sea aprobada en Solicitudes de material.</div>':'';
        const draftToken=quantityDraftKey(line);
        const draftValue=disabled?0:(quantityDrafts.has(draftToken)?quantityDrafts.get(draftToken):1);
        const control=`<div class="lg:w-64">${label}<div class="flex items-center gap-2 mt-1"><input id="v129-qty-${index}" data-v129-qty="1" data-qty-token="${draftToken}" oninput="guardarCantidadMovimientoV133(this.dataset.qtyToken,this.value)" type="number" min="0" step="0.01" inputmode="decimal" value="${html(draftValue)}" ${disabled?'disabled':''} class="min-w-0 flex-1 bg-[#060a14] border ${blocked?'border-amber-500/25':'border-[#243257]'} rounded-lg px-3 py-2 text-xs text-center text-white"><button type="button" onclick="agregarLineaMovimientoV129(${index})" ${disabled?'disabled':''} class="w-10 h-9 rounded-lg border ${disabled?'border-[#243257] text-gray-600 cursor-not-allowed':'border-blue-500/30 bg-blue-950/10 text-blue-300 hover:text-white'} text-lg font-bold">+</button></div>${disponibilidad}</div>`;
        return`<div class="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3"><div class="flex items-center gap-3 min-w-0 flex-1">${typeof imagenProductoHTML==='function'?imagenProductoHTML(product,'w-10 h-10'):''}<div class="min-w-0 flex-1"><div class="flex items-center gap-2"><p class="text-xs font-semibold text-white truncate">${html(product.desc||product.descripcion||product.codigo)}</p>${outside?'<span class="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-[8px] text-amber-300 uppercase">Fuera del plan</span>':''}</div><p class="text-[9px] text-gray-500 font-mono mt-0.5">${html(product.codigo)} · ${html(product.unidad||'')}</p><div class="flex flex-wrap gap-1.5 mt-1.5">${badges}</div>${avisoAprobacion}</div></div>${control}</div>`;
    }
    window.renderPlanEntregaProyecto=function(){
        const panel=document.getElementById('panel-materiales-proyecto');
        const list=document.getElementById('lista-plan-proyecto');
        const summary=document.getElementById('resumen-plan-proyecto');
        if(!panel||!list||!summary)return;
        const selected=project();
        ensureEntryMode();
        const hidePanel=!selected||(currentType==='entrada'&&entryAddsWarehouse());
        panel.classList.toggle('hidden',hidePanel);
        ensureTabs();
        ensureProjectInfo();
        ensureTransferMode();
        if(hidePanel){
            summary.textContent=currentType==='entrada'&&entryAddsWarehouse()?'La entrada se registrará en el stock general del almacén y no quedará reservada para el proyecto seleccionado.':'Selecciona un proyecto para consultar sus materiales.';
            list.innerHTML='';
            return;
        }
        if(typeof cargandoPlanEntrega!=='undefined'&&cargandoPlanEntrega){summary.textContent='Consultando materiales y existencias del proyecto...';list.innerHTML='<div class="px-4 py-8 text-center text-xs text-gray-500">Cargando materiales...</div>';return}
        rendered=visibleRows();
        const plan=(planEntregaProyecto||[]).filter(line=>!isOutside(line));
        const outside=(planEntregaProyecto||[]).filter(isOutside);
        const pending=plan.reduce((sum,line)=>sum+number(line.pendiente),0);
        const pendingEntry=plan.reduce((sum,line)=>sum+Math.max(0,number(line.requerido)-number(line.ingresado)),0);
        const deliveredAvailable=(planEntregaProyecto||[]).reduce((sum,line)=>sum+deliveredTransferAvailable(line),0);
        const leftovers=(planEntregaProyecto||[]).reduce((sum,line)=>sum+number(line.sobrante??line.cantidadSobrante??line.cantidad_sobrante),0);
        summary.textContent=currentType==='entrada'
            ?`${plan.length} en el plan · ${outside.length} extras exclusivos · ${pendingEntry} faltan por ingresar`
            :currentType==='traspaso'
                ?`${deliveredAvailable} unidades entregadas disponibles para traspaso · ${leftovers} unidades ya registradas como sobrante`
                :`${plan.length} en el plan · ${outside.length} fuera del plan · ${pending} pendientes por entregar`;
        const empty=currentType==='entrada'&&view==='fuera'
            ?'Todavía no hay ingresos extra exclusivos para este proyecto. Puedes buscarlos en el catálogo y agregarlos.'
            :currentType==='traspaso'
                ?'No hay materiales entregados disponibles para registrar como sobrante o transferir.'
                :view==='fuera'
                    ?'No hay entradas no solicitadas reservadas para este proyecto. Usa el buscador para consultar materiales disponibles en el stock general del almacén.'
                    :'No hay materiales en este filtro.';
        list.innerHTML=rendered.length?rendered.map(rowHtml).join(''):`<div class="px-4 py-8 text-center text-xs text-gray-500">${empty}</div>`;
    };
    function classify(line,quantity,code,excludeId='',targetProject=effectiveProject()){
        if(!targetProject)return{cantidadDentroPlan:0,cantidadFueraPlan:0,alcance:'sin_plan'};
        if(!line||isOutside(line)||line.forzarFueraPlan)return{cantidadDentroPlan:0,cantidadFueraPlan:quantity,alcance:'fuera_plan'};
        let remaining=0;
        if(currentType==='entrada')remaining=Math.max(0,number(line.requerido)-number(line.ingresado)-lineInList(code,'cantidadDentroPlan',excludeId,targetProject));
        else if(currentType==='salida')remaining=Math.max(0,number(line.pendiente)-lineInList(code,'cantidadDentroPlan',excludeId,targetProject));
        else remaining=quantity;
        const inside=Math.min(quantity,remaining);
        const outside=Math.max(0,quantity-inside);
        return{cantidadDentroPlan:inside,cantidadFueraPlan:outside,alcance:inside>0&&outside>0?'mixto':inside>0?'dentro_plan':'fuera_plan'};
    }
    function addItem(product,line,quantity){
        const isProjectTransfer=currentType==='traspaso'&&Boolean(project());
        const origin=isProjectTransfer?'':text(document.getElementById('bodega_origen_val')?.value);
        const destination=isProjectTransfer&&transferMode==='proyecto'?'':text(document.getElementById('bodega_destino_val')?.value);
        const targetProject=currentType==='entrada'?effectiveProject():project();
        const targetDestinationProject=isProjectTransfer&&transferMode==='proyecto'?destinationProject():'';
        if(currentType==='salida'&&!origin)return alert('Selecciona la bodega origen.');
        if(currentType==='traspaso'&&!isProjectTransfer&&!origin)return alert('Selecciona la bodega origen.');
        if((currentType==='entrada'||currentType==='ajuste'||(currentType==='traspaso'&&!isProjectTransfer))&&!destination)return alert('Selecciona la bodega destino.');
        if(isProjectTransfer&&transferMode==='almacen'&&!destination)return alert('Selecciona el almacén donde quedarán los materiales.');
        if(isProjectTransfer&&transferMode==='proyecto'&&!targetDestinationProject)return alert('Selecciona el proyecto de destino.');
        if(targetDestinationProject&&targetDestinationProject===project())return alert('El proyecto de destino debe ser diferente al proyecto de origen.');
        const state=key(line?.estadoSolicitud||line?.estado_solicitud);
        const fromGeneral=Boolean(line?.desdeAlmacenGeneral);
        const forcedOutside=Boolean(line?.forzarFueraPlan);
        if(currentType==='salida'&&line&&!isOutside(line)&&!forcedOutside&&state!=='aprobada'&&!fromGeneral)return alert('La solicitud de este material todavía está en espera y debe aprobarse antes de entregarlo.');
        const stocks=stockParts(product,line);
        const fromGeneralEntry=entryUsesGeneral();
        const consumes=currentType==='salida'||currentType==='traspaso'||(currentType==='ajuste'&&key(typeof stockAdj!=='undefined'?stockAdj:'')==='disminuir');
        const already=itemsAgregados.filter(item=>item.tipo===currentType&&key(item.producto?.codigo)===key(product.codigo)&&text(item.proyecto)===text(targetProject)&&text(item.proyectoDestino)===text(targetDestinationProject)).reduce((sum,item)=>sum+number(item.cantidad),0);
        const alreadyGeneralEntry=itemsAgregados.filter(item=>item.tipo==='entrada'&&Boolean(item.tomarDelAlmacen)&&text(item.proyecto)===text(targetProject)&&key(item.producto?.codigo)===key(product.codigo)&&text(item.bodegaDestino)===destination).reduce((sum,item)=>sum+number(item.cantidad),0);
        if(consumes&&quantity+already>stocks.total)return alert(`Solo hay ${Math.max(0,stocks.total-already)} disponibles.`);
        if(fromGeneralEntry&&quantity+alreadyGeneralEntry>stocks.general)return alert(`Solo hay ${Math.max(0,stocks.general-alreadyGeneralEntry)} disponibles en el stock general de ${destination}.`);
        const existing=itemsAgregados.find(item=>item.tipo===currentType&&text(item.proyecto)===text(targetProject)&&text(item.proyectoDestino)===text(targetDestinationProject)&&key(item.producto?.codigo)===key(product.codigo)&&text(item.bodegaOrigen)===origin&&text(item.bodegaDestino)===destination&&Boolean(item.tomarDelAlmacen)===fromGeneralEntry);
        const total=(existing?number(existing.cantidad):0)+quantity;
        const scope=classify(line,total,product.codigo,existing?.id||'',targetProject);
        const salidaProyecto=currentType==='salida'&&Boolean(targetProject);
        const proyectoUsado=salidaProyecto&&!fromGeneral?Math.min(total,stocks.reserved):0;
        const generalUsado=currentType==='salida'?Math.max(0,total-proyectoUsado):0;
        const sourceData={
            stockFuente:currentType==='salida'?(proyectoUsado>0&&generalUsado>0?'mixto':proyectoUsado>0?'reserva_proyecto':'almacen_general'):(isProjectTransfer?'entregado_proyecto':''),
            stock_fuente:currentType==='salida'?(proyectoUsado>0&&generalUsado>0?'mixto':proyectoUsado>0?'reserva_proyecto':'almacen_general'):(isProjectTransfer?'entregado_proyecto':''),
            cantidadStockProyecto:isProjectTransfer?0:proyectoUsado,
            cantidad_stock_proyecto:isProjectTransfer?0:proyectoUsado,
            cantidadStockGeneral:isProjectTransfer?0:generalUsado,
            cantidad_stock_general:isProjectTransfer?0:generalUsado
        };
        if(existing){existing.cantidad=total;Object.assign(existing,scope,sourceData)}
        else itemsAgregados.push({
            id:Date.now()+Math.random().toString(36).slice(2,7),
            tipo:currentType,
            ajusteAccion:currentType==='ajuste'?(typeof stockAdj!=='undefined'?stockAdj:null):null,
            producto:{...product,_planEntrega:line&&!isOutside(line)&&!line.forzarFueraPlan?line:null,_fueraPlanPermitido:true},
            cantidad:quantity,
            proyecto:targetProject,
            proyectoDestino:targetDestinationProject,
            proyecto_destino:targetDestinationProject,
            ubicacion:typeof ubicacionMovimientoTexto==='function'?ubicacionMovimientoTexto():'',
            ubicacionOrigen:isProjectTransfer?'':text(document.getElementById('ubicacion_origen_val')?.value),
            ubicacionDestino:isProjectTransfer?'':text(document.getElementById('ubicacion_destino_val')?.value),
            ordenCompra:currentType==='entrada'&&(entryAddsWarehouse()||entryAddsProject())?text(document.getElementById('orden_compra_val')?.value):'',
            bodegaOrigen:origin,
            bodegaDestino:destination,
            recibeNombre:text(document.getElementById('recibe_nombre_val')?.value),
            recibeTipo:'persona',
            traspasoModo:currentType==='traspaso'?transferMode:'',
            traspaso_modo:currentType==='traspaso'?transferMode:'',
            ubicacionPendiente:isProjectTransfer&&transferMode==='almacen',
            ...sourceData,
            esNoListado:false,
            es_no_listado:false,
            tomarDelAlmacen:fromGeneralEntry,
            tomar_del_almacen:fromGeneralEntry,
            origenEntrada:fromGeneralEntry?'almacen_general_a_proyecto':entryAddsProject()?'ingreso_nuevo_exclusivo_proyecto':'ingreso_nuevo_almacen',
            desdeAlmacenGeneral:currentType==='salida'&&Boolean(line?.desdeAlmacenGeneral),
            forzarFueraPlan:currentType==='salida'&&Boolean(line?.forzarFueraPlan),
            ...classify(line,quantity,product.codigo,'',targetProject)
        });
        renderLista();
        actualizarPreviewHeader();
        renderPlanEntregaProyecto();
    }
    window.agregarProducto=function(){
        if(!productoSeleccionado)return alert('Primero busca y selecciona un producto.');
        const quantity=number(document.getElementById('cantidad_val')?.value);
        if(quantity<=0)return alert('La cantidad debe ser mayor a cero.');
        const line=productoSeleccionado._lineaMovimiento||lineByCode(productoSeleccionado.codigo);
        addItem(productoSeleccionado,line,quantity);
        if(typeof quitarProducto==='function')quitarProducto();
        const input=document.getElementById('cantidad_val');
        if(input)input.value='0';
    };
    window.agregarLineaMovimientoV129=async function(index){
        const original=rendered[index];
        if(!original)return;
        const code=text(original.codigo||original.material?.codigo);
        const quantityInput=document.getElementById(`v129-qty-${index}`);
        const quantity=number(quantityInput?.value);
        if(quantity<=0)return alert('Escribe una cantidad mayor a cero.');
        const draftToken=text(quantityInput?.dataset?.qtyToken);
        if(currentType==='salida'&&project()&&typeof window.recargarPlanEntregaProyecto==='function'){
            try{
                await window.recargarPlanEntregaProyecto();
            }catch(error){}
        }
        const refreshed=lineByCode(code);
        const line=original.desdeAlmacenGeneral
            ?{...(refreshed||original),material:productOf(original),desdeAlmacenGeneral:true,forzarFueraPlan:Boolean(original.forzarFueraPlan),lineaProyectoOriginal:refreshed||original.lineaProyectoOriginal||null}
            :(refreshed||original);
        const product=productOf(line);
        const stocks=stockParts(product,line);
        const used=inList(product.codigo);
        const available=Math.max(0,stocks.total-used);
        if(currentType==='salida'&&quantity>available){
            return alert(available>0?`Solo hay ${available} disponibles entre la reserva del proyecto y el almacén general.`:'No hay existencia disponible para este material en la bodega seleccionada.');
        }
        if(draftToken)quantityDrafts.set(draftToken,'0');
        addItem(product,line,quantity);
    };
    window.agregarLineaMovimientoV125=window.agregarLineaMovimientoV129;
    window.agregarReservadoMovimientoV129=async function(index){
        const original=rendered[index];
        if(!original||currentType!=='salida')return;
        const code=text(original.codigo||original.material?.codigo);
        if(project()&&typeof window.recargarPlanEntregaProyecto==='function'){
            try{
                await window.recargarPlanEntregaProyecto();
            }catch(error){}
        }
        const line=lineByCode(code)||original;
        const estado=key(line.estadoSolicitud||line.estado_solicitud);
        if(!isOutside(line)&&estado!=='aprobada')return alert('La solicitud debe estar aprobada antes de surtir el material.');
        const product=productOf(line);
        const stocks=stockParts(product,line);
        const origin=text(document.getElementById('bodega_origen_val')?.value);
        if(!origin)return alert('Selecciona la bodega origen.');
        const agregado=itemsAgregados.filter(item=>item.tipo==='salida'&&text(item.proyecto)===project()&&key(item.producto?.codigo)===key(product.codigo)&&text(item.bodegaOrigen)===origin).reduce((sum,item)=>sum+number(item.cantidad),0);
        const cantidad=Math.max(0,stocks.reserved-agregado);
        if(cantidad<=0)return alert('Toda la cantidad reservada ya está agregada a la lista o la reserva ya no tiene existencia.');
        addItem(product,line,cantidad);
        const input=document.getElementById(`v129-qty-${index}`);
        if(input)input.value='0';
    };
    window.actualizarCantidadItemV129=function(id,value){
        const item=itemsAgregados.find(row=>String(row.id)===String(id));
        if(!item)return;
        const quantity=number(value);
        if(quantity<=0){eliminarItem(id);return}
        const orderPending=number(item.cantidadOrdenPendiente??item.cantidad_orden_pendiente);
        if(item.solicitudCompraId&&orderPending>0&&quantity>orderPending){
            alert(`La orden solo tiene ${orderPending} ${item.producto?.unidad||''} pendientes para este material.`);
            renderLista();
            return;
        }
        const baseLine=lineByCode(item.producto?.codigo);
        const line=item.desdeAlmacenGeneral
            ?{...(baseLine||{}),material:item.producto,desdeAlmacenGeneral:true,forzarFueraPlan:Boolean(item.forzarFueraPlan)}
            :baseLine;
        const product=item.producto;
        const old=item.cantidad;
        item.cantidad=0;
        const stocks=stockParts(product,line);
        const consumes=item.tipo==='salida'||item.tipo==='traspaso'||(item.tipo==='ajuste'&&key(item.ajusteAccion)==='disminuir');
        const fromGeneralEntry=item.tipo==='entrada'&&Boolean(item.tomarDelAlmacen);
        const others=inList(product.codigo,item.tipo);
        const otherGeneralEntries=itemsAgregados.filter(row=>row.tipo==='entrada'&&Boolean(row.tomarDelAlmacen)&&String(row.id)!==String(item.id)&&text(row.proyecto)===text(item.proyecto)&&key(row.producto?.codigo)===key(product.codigo)&&text(row.bodegaDestino)===text(item.bodegaDestino)).reduce((sum,row)=>sum+number(row.cantidad),0);
        if(consumes&&quantity+others>stocks.total){item.cantidad=old;alert(`Solo hay ${Math.max(0,stocks.total-others)} disponibles.`);renderLista();return}
        if(fromGeneralEntry&&quantity+otherGeneralEntries>stocks.general){item.cantidad=old;alert(`Solo hay ${Math.max(0,stocks.general-otherGeneralEntries)} disponibles en el stock general.`);renderLista();return}
        item.cantidad=quantity;
        if(item.tipo==='traspaso'&&item.proyecto&&(item.traspasoModo||item.traspaso_modo)){
            item.stockFuente='entregado_proyecto';
            item.stock_fuente='entregado_proyecto';
            item.cantidadStockProyecto=0;
            item.cantidad_stock_proyecto=0;
            item.cantidadStockGeneral=0;
            item.cantidad_stock_general=0;
        }else if(item.tipo==='salida'){
            const fromGeneral=Boolean(item.desdeAlmacenGeneral);
            const projectUsed=item.proyecto&&!fromGeneral?Math.min(quantity,stocks.reserved):0;
            const generalUsed=Math.max(0,quantity-projectUsed);
            item.cantidadStockProyecto=projectUsed;
            item.cantidad_stock_proyecto=projectUsed;
            item.cantidadStockGeneral=generalUsed;
            item.cantidad_stock_general=generalUsed;
            item.stockFuente=projectUsed>0&&generalUsed>0?'mixto':projectUsed>0?'reserva_proyecto':'almacen_general';
            item.stock_fuente=item.stockFuente;
        }
        Object.assign(item,classify(line,quantity,product.codigo,item.id));
        actualizarPreviewHeader();
        renderPlanEntregaProyecto();
    };
    window.renderLista=function(){
        const empty=document.getElementById('lista-vacia');
        const list=document.getElementById('lista-productos');
        if(!itemsAgregados.length){empty.classList.remove('hidden');list.classList.add('hidden');list.innerHTML='';return}
        empty.classList.add('hidden');list.classList.remove('hidden');
        list.innerHTML=itemsAgregados.map(item=>{
            const config=configTipos[item.tipo];
            const sourceLabel=item.tipo==='salida'?(item.stockFuente==='mixto'?'Reserva + almacén general':item.stockFuente==='reserva_proyecto'?'Reserva del proyecto':item.stockFuente==='almacen_general'?'Almacén general':''):'';
            const pendingOrder=number(item.cantidadOrdenPendiente??item.cantidad_orden_pendiente);
            const tags=[item.proyecto,item.ubicacion,item.ordenCompra,item.solicitudCompraFolio?`Solicitud ${item.solicitudCompraFolio}`:'',item.solicitudCompraId&&pendingOrder>0?`Pendiente OC: ${pendingOrder} ${item.producto?.unidad||''}`:'',item.tomarDelAlmacen?'Apartado desde almacén general':'',sourceLabel,item.tipo==='entrada'&&item.origenEntrada==='ingreso_nuevo_exclusivo_proyecto'?'Ingreso reservado para el proyecto':'',item.tipo==='entrada'&&!item.tomarDelAlmacen&&item.origenEntrada!=='ingreso_nuevo_exclusivo_proyecto'?'Ingreso nuevo al almacén':'',item.alcance==='fuera_plan'?'Fuera del plan':item.alcance==='mixto'?'Plan + extra':''].filter(Boolean);
            return`<div class="fila-nueva px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-[#0d1425] transition"><div class="min-w-0 flex items-start gap-3">${imagenProductoHTML(item.producto)}<div class="min-w-0"><div class="flex items-center gap-2 text-${config.color}-400">${config.icon}<p class="text-xs font-semibold text-white truncate">${html(item.producto.desc||item.producto.descripcion)}</p></div><p class="text-[10px] text-gray-500 font-mono mt-0.5">${html(item.producto.codigo)}</p>${tags.length?`<div class="flex flex-wrap gap-1 mt-1.5">${tags.map(tag=>`<span class="text-[9px] text-gray-400 bg-[#141d34] border border-[#232f4e] px-1.5 py-0.5 rounded">${html(tag)}</span>`).join('')}</div>`:''}</div></div><div class="flex items-center gap-2 shrink-0"><input type="number" min="0.01" step="0.01" value="${number(item.cantidad)}" onchange="actualizarCantidadItemV129('${item.id}',this.value)" class="w-24 bg-[#060a14] border border-${config.color}-500/30 rounded-lg px-2 py-1.5 text-xs text-center text-${config.color}-300"><span class="text-[9px] text-gray-500">${html(item.producto.unidad||'pz')}</span><button type="button" onclick="eliminarItem('${item.id}')" class="text-gray-600 hover:text-rose-400 transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg></button></div></div>`;
        }).join('');
    };
    window.validarDisponibilidad=function(product,quantity=0,show=true){
        const line=lineByCode(product?.codigo);
        const stocks=stockParts(product,line);
        const consumes=currentType==='salida'||currentType==='traspaso'||(currentType==='ajuste'&&key(typeof stockAdj!=='undefined'?stockAdj:'')==='disminuir');
        if(entryUsesGeneral()){
            const used=itemsAgregados.filter(item=>item.tipo==='entrada'&&Boolean(item.tomarDelAlmacen)&&text(item.proyecto)===project()&&key(item.producto?.codigo)===key(product.codigo)&&text(item.bodegaDestino)===warehouse()).reduce((sum,item)=>sum+number(item.cantidad),0);
            const available=Math.max(0,stocks.general-used);
            if(number(quantity)>available||available<=0){if(show)alert(available<=0?'Este material no tiene stock general disponible en el almacén seleccionado.':`Solo hay ${available} disponibles en el stock general.`);return false}
            return true;
        }
        if(!consumes)return true;
        const available=Math.max(0,stocks.total-inList(product.codigo));
        if(number(quantity)>available||available<=0){if(show)alert(available<=0?'Este material no tiene existencia disponible.':`Solo hay ${available} disponibles.`);return false}
        return true;
    };
    window.seleccionarProductoProyecto=function(encoded,fromGeneral=false){
        const code=decodeURIComponent(text(encoded));
        const original=(planEntregaProyecto||[]).find(row=>key(row.codigo)===key(code)&&!isOutside(row))||(planEntregaProyecto||[]).find(row=>key(row.codigo)===key(code));
        const product=original?productOf(original):(catalogoProductos||[]).find(row=>key(row.codigo)===key(code));
        if(!product)return;
        const state=key(original?.estadoSolicitud||original?.estado_solicitud);
        const line=fromGeneral
            ?{...(original||{}),codigo:product.codigo,material:product,descripcion:product.desc||product.descripcion,unidad:product.unidad,desdeAlmacenGeneral:true,forzarFueraPlan:!original||state!=='aprobada'}
            :original;
        productoSeleccionado={...product,_planEntrega:line&&!isOutside(line)&&!line?.forzarFueraPlan?line:null,_lineaMovimiento:line,_fueraPlanPermitido:true};
        mostrarProductoSeleccionado(productoSeleccionado);
        document.getElementById('cantidad_val').value='1';
    };
    window.buscarProducto=function(query){
        const dropdown=document.getElementById('producto_dropdown');
        const empty=document.getElementById('producto-sin-resultados');
        const q=key(query);
        if(!q){dropdown.classList.add('hidden');empty.classList.add('hidden');return}
        const byCode=new Map();
        (planEntregaProyecto||[]).forEach(line=>{const product=productOf(line);byCode.set(key(product.codigo),{product,line})});
        (catalogoProductos||[]).forEach(product=>{if(!byCode.has(key(product.codigo)))byCode.set(key(product.codigo),{product,line:null})});
        const results=[...byCode.values()].filter(row=>SkilledDB.matchesMaterial(row.product,q)).slice(0,40);
        if(!results.length){dropdown.classList.add('hidden');empty.textContent='No se encontraron materiales con ese criterio.';empty.classList.remove('hidden');return}
        empty.classList.add('hidden');
        dropdown.innerHTML=results.map(row=>{
            const line=row.line;
            const stocks=stockParts(row.product,line);
            const consumes=currentType==='salida'||currentType==='traspaso'||(currentType==='ajuste'&&key(typeof stockAdj!=='undefined'?stockAdj:'')==='disminuir');
            const state=key(line?.estadoSolicitud||line?.estado_solicitud);
            const canUseGeneral=currentType==='salida'&&project()&&stocks.general>0;
            const blockedByApproval=currentType==='salida'&&line&&!isOutside(line)&&state!=='aprobada'&&!canUseGeneral;
            const disabled=((consumes&&stocks.total<=0)||(entryUsesGeneral()&&stocks.general<=0)||blockedByApproval);
            const useGeneral=canUseGeneral&&(!line||state!=='aprobada');
            const detail=currentType==='entrada'&&project()
                ?`${line&&!isOutside(line)?'Solicitado por el proyecto':'Disponible para asignar'} · Reservado: ${stocks.reserved} · General: ${stocks.general}`
                :blockedByApproval?`Aún en aprobación · No se puede surtir como parte del plan`
                :useGeneral?`Disponible en almacén general · Se registrará fuera del plan · ${stocks.general}`
                :line&&isOutside(line)?`Fuera del plan · Entrada proyecto: ${stocks.reserved} · Almacén: ${stocks.general}`:line?'Dentro del plan':project()?`Fuera del plan · Sin entrada del proyecto · Almacén: ${stocks.general}`:'Catálogo';
            return`<button type="button" data-code="${encodeURIComponent(row.product.codigo)}" data-general="${useGeneral?'1':'0'}" ${disabled?'disabled':''} class="v129-search w-full text-left px-3 py-2.5 transition flex items-center gap-3 ${disabled?'opacity-45 cursor-not-allowed bg-rose-950/10':'hover:bg-[#161f38]'}">${typeof imagenProductoHTML==='function'?imagenProductoHTML(row.product):''}<div class="min-w-0 flex-1"><span class="text-xs text-gray-200 truncate block font-semibold">${html(row.product.desc||row.product.descripcion)}</span><span class="text-[9px] text-gray-500">${html(row.product.codigo)} · ${html(detail)}</span></div>${consumes?`<span class="text-[9px] ${disabled?'text-rose-400':'text-gray-500'}">${disabled?'AGOTADO':stocks.total}</span>`:''}</button>`;
        }).join('');
        dropdown.querySelectorAll('.v129-search:not([disabled])').forEach(button=>button.addEventListener('click',()=>seleccionarProductoProyecto(button.dataset.code,button.dataset.general==='1')));
        dropdown.classList.remove('hidden');
    };
    let lastScan='';
    let lastScanAt=0;
    window.procesarCodigoEscaneado=function(value,source){
        const now=Date.now();
        if(text(value)===lastScan&&now-lastScanAt<1100)return;
        lastScan=text(value);
        lastScanAt=now;
        const reading=typeof extraerCodigoMaterial==='function'?extraerCodigoMaterial(value):{tipo:'material',valor:value};
        if(reading.tipo==='categoria'){document.getElementById('producto_search').value=reading.valor;buscarProducto(reading.valor);return}
        const product=(catalogoProductos||[]).find(item=>key(item.codigo)===key(reading.valor));
        if(!product){document.getElementById('scanner-resultado').innerHTML=`<span class="text-rose-400 font-semibold">No encontrado:</span> ${html(reading.valor)}`;if(typeof sonarEscaneo==='function')sonarEscaneo(false);return}
        const line=lineByCode(product.codigo);
        if(!validarDisponibilidad(product,1,false)){document.getElementById('scanner-resultado').innerHTML=`<span class="text-rose-400 font-semibold">Sin existencia:</span> ${html(product.codigo)}`;if(typeof sonarEscaneo==='function')sonarEscaneo(false);return}
        addItem(product,line,1);
        document.getElementById('scanner-resultado').innerHTML=`<span class="text-emerald-400 font-semibold">Agregado desde ${html(source)}:</span> ${html(product.codigo)}. Puedes editar la cantidad en la lista.`;
        if(typeof sonarEscaneo==='function')sonarEscaneo(true);
    };
    window.validarListaAntesDeGuardar=async function(){
        const materials=await SkilledDB.listMaterials();
        const materialMap=new Map(materials.map(item=>[key(item.codigo),item]));
        let latestPlan=[];
        if(project())latestPlan=await SkilledDB.listProjectMovementPlan(project(),{includeOutsidePlan:true});
        const lineMap=new Map(latestPlan.map(line=>[key(line.codigo),line]));
        const used=new Map();
        for(const item of itemsAgregados){
            const consumes=item.tipo==='salida'||item.tipo==='traspaso'||(item.tipo==='ajuste'&&key(item.ajusteAccion)==='disminuir');
            const fromGeneralEntry=item.tipo==='entrada'&&Boolean(item.tomarDelAlmacen);
            if(!consumes&&!fromGeneralEntry)continue;
            const material=materialMap.get(key(item.producto?.codigo))||item.producto;
            const line=lineMap.get(key(item.producto?.codigo));
            const name=item.tipo==='ajuste'?text(item.bodegaDestino||item.bodegaOrigen):text(item.bodegaOrigen);
            const general=generalStock(material,name);
            const projectTransfer=item.tipo==='traspaso'&&Boolean(project())&&Boolean(item.traspasoModo||item.traspaso_modo);
            const reserved=project()?projectStock(line,name):0;
            const deliveredAvailable=projectTransfer?deliveredTransferAvailable(line):0;
            const total=fromGeneralEntry?general:projectTransfer?deliveredAvailable:project()&&item.tipo==='salida'?general+reserved:project()?reserved:general;
            const token=`${item.tipo}|${project()}|${text(item.proyectoDestino||item.proyecto_destino)}|${key(item.producto?.codigo)}|${key(name)}|${projectTransfer?'entregado-proyecto':fromGeneralEntry?'general-entry':''}`;
            const qty=(used.get(token)||0)+number(item.cantidad);
            used.set(token,qty);
            if(qty>total)throw new Error(projectTransfer?`El proyecto solo tiene ${total} unidades entregadas disponibles de ${item.producto.codigo} para registrar como sobrante.`:`Stock insuficiente de ${item.producto.codigo} en ${name}. Disponible: ${total}.`);
        }
        return true;
    };
    window.cargarPlanEntregaProyecto=async function(value){
        planEntregaProyecto=[];
        cargandoPlanEntrega=true;
        renderPlanEntregaProyecto();
        if(!text(value)){
            cargandoPlanEntrega=false;
            renderPlanEntregaProyecto();
            return;
        }
        try{
            planEntregaProyecto=await SkilledDB.listProjectMovementPlan(text(value),{includeOutsidePlan:true});
        }catch(error){
            planEntregaProyecto=[];
            alert(`No se pudieron cargar los materiales del proyecto: ${error.message}`);
        }finally{
            cargandoPlanEntrega=false;
            renderPlanEntregaProyecto();
        }
    };
    function ensureTransferMode(){
        const wrapper=document.getElementById('wrapper-proyecto-movimiento');
        if(!wrapper)return;
        let box=document.getElementById('modo-traspaso-proyecto-v12117');
        if(!box){
            box=document.createElement('div');
            box.id='modo-traspaso-proyecto-v12117';
            box.className='hidden rounded-xl border border-[#243257] bg-[#0b1120] p-4 mt-3';
            wrapper.insertAdjacentElement('afterend',box);
        }
        const visible=currentType==='traspaso'&&Boolean(project());
        box.classList.toggle('hidden',!visible);
        if(!visible)return;
        const options=(proyectosDisponibles||[]).filter(item=>text(item.proyecto)!==project()).map(item=>`<option value="${html(item.proyecto)}" ${text(item.proyecto)===transferDestinationProject?'selected':''}>${html(item.proyecto)} — ${html(item.nombreProyecto||'Sin nombre')}</option>`).join('');
        box.innerHTML=`<div><p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Destino de los sobrantes entregados</p><p class="mt-1 text-[11px] text-gray-400">Solo se pueden mover materiales que ya fueron entregados al proyecto. Cada cantidad transferida quedará registrada como sobrante del proyecto de origen.</p></div><div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"><button type="button" onclick="window.setTransferMode('almacen')" class="rounded-xl border px-4 py-3 text-left ${transferMode==='almacen'?'border-amber-500/50 bg-amber-950/15 text-amber-200':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}"><span class="block text-xs font-semibold">Regresar sobrante al almacén</span><span class="mt-1 block text-[9px] leading-relaxed opacity-80">Devuelve material ya entregado al stock general. La ubicación específica se marcará como pendiente.</span></button><button type="button" onclick="window.setTransferMode('proyecto')" class="rounded-xl border px-4 py-3 text-left ${transferMode==='proyecto'?'border-violet-500/50 bg-violet-950/15 text-violet-200':'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}"><span class="block text-xs font-semibold">Enviar sobrante a otro proyecto</span><span class="mt-1 block text-[9px] leading-relaxed opacity-80">El material se registrará como sobrante del origen y como entregado en el proyecto destino.</span></button></div>${transferMode==='proyecto'?`<label class="block mt-4 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Proyecto de destino *<select id="proyecto_destino_traspaso" class="mt-2 w-full bg-[#060a14] text-xs text-gray-300 rounded-lg px-4 py-3 border border-violet-500/30 focus:outline-none focus:border-violet-400"><option value="">Selecciona el proyecto de destino...</option>${options}</select></label>`:`<div class="mt-4 rounded-lg border border-amber-500/20 bg-amber-950/10 px-3 py-2 text-[10px] text-amber-300">Al finalizar se registrará el sobrante y se generará una notificación para asignar estante o ubicación específica dentro del almacén.</div>`}`;
        document.getElementById('proyecto_destino_traspaso')?.addEventListener('change',event=>{transferDestinationProject=text(event.target.value);itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='traspaso');renderLista();renderPlanEntregaProyecto()});
    }
    function updateDocumentVisibility(){
        const isEntry=currentType==='entrada';
        const showPurchase=isEntry&&(entryAddsWarehouse()||entryAddsProject());
        const docs=document.getElementById('documentos-movimiento-v125');
        if(docs)docs.classList.toggle('hidden',!showPurchase);
        const orderInput=document.getElementById('orden_compra_val');
        const order=orderInput?.parentElement?.parentElement;
        if(orderInput){orderInput.required=showPurchase;orderInput.placeholder=showPurchase?'Número de orden de compra *':'Ej. OC-4567';}
        if(order)order.classList.toggle('hidden',!showPurchase);
        const reader=document.querySelector('[id*="lector-orden"], [data-lector-orden]');
        if(reader&&reader!==document.getElementById('orden_compra_val'))reader.classList.toggle('hidden',!showPurchase);
        if(!showPurchase){
            const date=document.getElementById('fecha_orden_compra_val');
            const purchase=document.getElementById('orden_compra_val');
            if(date)date.value='';
            if(purchase)purchase.value='';
        }
        if(!isEntry){
            const reference=document.getElementById('referencia_movimiento_val');
            if(reference)reference.value='';
        }
        const help=document.getElementById('proyecto-ayuda');
        if(help){
            if(!project())help.textContent=isEntry?'La entrada añadirá materiales al stock general del almacén y requerirá orden de compra.':'Sin proyecto, el movimiento afectará el stock general disponible para todos los proyectos.';
            else if(isEntry)help.textContent=entryUsesGeneral()?'Se tomará stock general del almacén seleccionado y quedará reservado exclusivamente para el proyecto.':entryAddsProject()?'La orden de compra ingresará material nuevo reservado únicamente para este proyecto.':'La entrada se añadirá al stock general del almacén mediante una orden de compra; el proyecto seleccionado será solo informativo.';
            else if(currentType==='traspaso'&&project())help.textContent=transferMode==='proyecto'?'Elige materiales ya entregados al proyecto de origen. La cantidad enviada se registrará como sobrante y como entrega del proyecto destino.':'Elige materiales ya entregados al proyecto. La cantidad devuelta se registrará como sobrante y regresará al stock general del almacén.'; else help.textContent='Se mostrará el stock reservado de este proyecto y el stock general del almacén. Nunca se utilizará la reserva de otro proyecto.';
        }
        const projectTransfer=currentType==='traspaso'&&Boolean(project());
        const originWrapper=document.getElementById('wrapper-bodega-origen');
        const originLocation=document.getElementById('wrapper-ubicacion-origen');
        const destinationWrapper=document.getElementById('wrapper-bodega-destino');
        const destinationLocation=document.getElementById('wrapper-ubicacion-destino');
        if(projectTransfer){
            originWrapper?.classList.add('hidden');
            originLocation?.classList.add('hidden');
            destinationWrapper?.classList.toggle('hidden',transferMode==='proyecto');
            destinationLocation?.classList.add('hidden');
            const label=destinationWrapper?.querySelector('label');
            if(label)label.textContent='Almacén donde quedarán los materiales *';
        }
        ensureProjectInfo();
    }
    const previousType=window.cambiarTipo;
    window.cambiarTipo=function(type){
        const result=previousType(type);
        view=defaultView();
        ensureTransferMode();
        updateDocumentVisibility();
        const selected=project();
        if(selected)Promise.resolve(cargarPlanEntregaProyecto(selected));
        else setTimeout(renderPlanEntregaProyecto,0);
        return result;
    };
    const previousWarehouseChange=window.manejarCambioBodegaMovimiento;
    window.manejarCambioBodegaMovimiento=async function(side){
        const result=await Promise.resolve(previousWarehouseChange(side));
        renderPlanEntregaProyecto();
        return result;
    };
    const previousProject=window.manejarCambioProyecto;
    window.manejarCambioProyecto=async function(value){
        const purchase=document.getElementById('orden_compra_val');
        const oldProjectOrder=selectedProjectData()?.ordenCompra||'';
        const result=await Promise.resolve(previousProject(value));
        if(purchase&&text(purchase.value)===text(oldProjectOrder))purchase.value='';
        if(currentType==='entrada')entrySource=text(value)?'proyecto':'almacen';
        transferDestinationProject='';
        view=defaultView();
        ensureProjectInfo();
        updateDocumentVisibility();
        await cargarPlanEntregaProyecto(value);
        return result;
    };
    document.getElementById('movimientoForm')?.addEventListener('submit',event=>{
        const assign=currentType==='entrada'&&Boolean(project())&&entrySource==='asignar';
        const addWarehouse=currentType==='entrada'&&entrySource==='almacen';
        const addProject=currentType==='entrada'&&Boolean(project())&&entrySource==='proyecto';
        const order=text(document.getElementById('orden_compra_val')?.value);
        if(currentType==='traspaso'&&project()&&transferMode==='proyecto'&&!destinationProject()){
            event.preventDefault();
            event.stopImmediatePropagation();
            alert('Selecciona el proyecto de destino.');
            document.getElementById('proyecto_destino_traspaso')?.focus();
            return;
        }
        if((addWarehouse||addProject)&&!order){
            event.preventDefault();
            event.stopImmediatePropagation();
            alert(addProject?'Para ingresar material nuevo exclusivo al proyecto debes indicar la orden de compra.':'Para añadir material nuevo al almacén debes ingresar el número de orden de compra.');
            document.getElementById('orden_compra_val')?.focus();
            return;
        }
        itemsAgregados=itemsAgregados.map(item=>{
            if(item.tipo!=='entrada')return{
                ...item,
                proyectoDestino:item.tipo==='traspaso'&&transferMode==='proyecto'?destinationProject():text(item.proyectoDestino),
                proyecto_destino:item.tipo==='traspaso'&&transferMode==='proyecto'?destinationProject():text(item.proyectoDestino),
                traspasoModo:item.tipo==='traspaso'?transferMode:text(item.traspasoModo),
                traspaso_modo:item.tipo==='traspaso'?transferMode:text(item.traspasoModo),
                stockFuente:item.tipo==='traspaso'&&project()?'entregado_proyecto':text(item.stockFuente),
                stock_fuente:item.tipo==='traspaso'&&project()?'entregado_proyecto':text(item.stock_fuente),
                cantidadStockProyecto:item.tipo==='traspaso'&&project()?0:number(item.cantidadStockProyecto),
                cantidad_stock_proyecto:item.tipo==='traspaso'&&project()?0:number(item.cantidad_stock_proyecto),
                cantidadStockGeneral:item.tipo==='traspaso'&&project()?0:number(item.cantidadStockGeneral),
                cantidad_stock_general:item.tipo==='traspaso'&&project()?0:number(item.cantidad_stock_general),
                cantidadDentroPlan:number(item.cantidadDentroPlan),
                cantidadFueraPlan:number(item.cantidadFueraPlan),
                alcance:text(item.alcance)||'sin_plan'
            };
            return{
                ...item,
                proyecto:(assign||addProject)?project():'',
                tomarDelAlmacen:assign,
                tomar_del_almacen:assign,
                origenEntrada:assign?'almacen_general_a_proyecto':addProject?'ingreso_nuevo_exclusivo_proyecto':'ingreso_nuevo_almacen',
                fechaOrdenCompra:(addWarehouse||addProject)?text(document.getElementById('fecha_orden_compra_val')?.value):'',
                ordenCompra:(addWarehouse||addProject)?order:'',
                referencia:(addWarehouse||addProject)?text(document.getElementById('referencia_movimiento_val')?.value):'',
                cantidadDentroPlan:(assign||addProject)?number(item.cantidadDentroPlan):0,
                cantidadFueraPlan:(assign||addProject)?number(item.cantidadFueraPlan):0,
                alcance:(assign||addProject)?(text(item.alcance)||'fuera_plan'):'sin_plan'
            };
        });
    },true);
    ensureProjectInfo();
    ensureTransferMode();
    updateDocumentVisibility();
    setTimeout(()=>{renderLista();renderPlanEntregaProyecto();ensureProjectInfo()},50);
})();
(function(){
    'use strict';
    const t=v=>String(v??'').trim();
    const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
    const esc=v=>t(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const normalizeDate=value=>{
        const raw=t(value);
        if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
        const m=raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
        if(!m)return'';
        let year=m[3];if(year.length===2)year=`20${year}`;
        return`${year}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    };
    const encodePayload=obj=>{
        const bytes=new TextEncoder().encode(JSON.stringify(obj));
        let binary='';
        bytes.forEach(byte=>binary+=String.fromCharCode(byte));
        return btoa(binary);
    };
    const decodePayload=value=>{
        const binary=atob(value);
        const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    };
    const LOGO_URL='logo-reporte.png';let logoPromise=null;function loadLogo(){if(logoPromise)return logoPromise;logoPromise=fetch(LOGO_URL,{mode:'cors'}).then(r=>{if(!r.ok)throw new Error('No se pudo cargar el logo');return r.blob()}).then(blob=>new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob)})).catch(()=>null);return logoPromise;}const priorityLabel=value=>({critica:'Crítica',urgente:'Urgente',alta:'Alta',media:'Media',normal:'Normal',baja:'Baja',programada:'Programada',sin_urgencia:'Sin urgencia',inmediata:'Inmediata'})[t(value)]||t(value)||'Normal';
    function ensureModal(){
        if(document.getElementById('oc-modal-v12115'))return;
        const root=document.createElement('div');
        root.id='oc-modal-v12115';
        root.className='hidden fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm p-4 overflow-y-auto';
        root.innerHTML=`<div class="min-h-full flex items-center justify-center"><div class="w-full max-w-5xl rounded-2xl border border-[#243257] bg-[#0b1120] shadow-2xl"><div class="flex items-center justify-between border-b border-[#243257] px-5 py-4"><div><h2 id="oc-modal-title" class="text-base font-bold text-white">Orden de compra</h2><p id="oc-modal-subtitle" class="mt-1 text-[10px] text-gray-500"></p></div><button type="button" data-oc-close class="text-gray-500 hover:text-white text-xl">×</button></div><div id="oc-modal-body" class="p-5"></div></div></div>`;
        root.addEventListener('click',event=>{if(event.target===root||event.target.closest('[data-oc-close]'))closeModal()});
        document.body.appendChild(root);
        const input=document.createElement('input');
        input.id='oc-file-v12115';input.type='file';input.accept='application/pdf,.pdf';input.className='hidden';
        input.addEventListener('change',handleFile);
        document.body.appendChild(input);
    }
    function openModal(title,subtitle,body){
        ensureModal();
        document.getElementById('oc-modal-title').textContent=title;
        document.getElementById('oc-modal-subtitle').textContent=subtitle||'';
        document.getElementById('oc-modal-body').innerHTML=body;
        document.getElementById('oc-modal-v12115').classList.remove('hidden');
    }
    function closeModal(){document.getElementById('oc-modal-v12115')?.classList.add('hidden')}
    async function extractText(file){
        if(!window.pdfjsLib)throw new Error('No se cargó la biblioteca PDF.js.');
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        const pages=[];
        for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
            const page=await pdf.getPage(pageNumber);
            const content=await page.getTextContent();
            pages.push(content.items.map(item=>t(item.str)).filter(Boolean).join(' '));
        }
        return pages.join('\n');
    }
    function parseStandard(text){
        const match=text.match(/SKILLED_OC_JSON_BEGIN\s+([A-Za-z0-9+/=\s]+?)\s+SKILLED_OC_JSON_END/i);
        if(!match)return null;
        return decodePayload(match[1].replace(/\s+/g,''));
    }
    function parseFallback(text){
        const order=(text.match(/(?:ORDEN\s+DE\s+COMPRA|OC)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .\/-]{2,40})/i)||[])[1]||'';
        const ref=(text.match(/(?:REFERENCIA|FOLIO|REF\.)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .\/-]{1,40})/i)||[])[1]||'';
        const date=(text.match(/(?:FECHA)\s*[:#-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i)||[])[1]||'';
        if(!order&&!ref&&!date)return null;
        return{version:0,ordenCompra:t(order),fecha:normalizeDate(date),referencia:t(ref),proyecto:'',materiales:[]};
    }
    async function handleFile(event){
        const file=event.target.files?.[0];event.target.value='';
        if(!file)return;
        openModal('Leyendo orden de compra','Extrayendo los datos y materiales del PDF.','<div class="py-12 text-center text-sm text-gray-400">Procesando PDF...</div>');
        try{
            const text=await extractText(file);
            const payload=parseStandard(text)||parseFallback(text);
            if(!payload)throw new Error('El PDF no contiene el formato de orden de compra del CRM ni datos básicos reconocibles.');
            if(!Array.isArray(payload.materiales)||!payload.materiales.length){
                const order=document.getElementById('orden_compra_val');
                const date=document.getElementById('fecha_orden_compra_val');
                const ref=document.getElementById('referencia_movimiento_val');
                if(order)order.value=t(payload.ordenCompra);
                if(date)date.value=normalizeDate(payload.fecha);
                if(ref)ref.value=t(payload.referencia);
                openModal('Datos leídos','El PDF no incluye materiales estructurados. Se llenaron los campos disponibles.',`<div class="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-sm text-amber-200"><p><b>Orden:</b> ${esc(payload.ordenCompra||'No encontrada')}</p><p class="mt-2"><b>Fecha:</b> ${esc(payload.fecha||'No encontrada')}</p><p class="mt-2"><b>Referencia:</b> ${esc(payload.referencia||'No encontrada')}</p><p class="mt-4 text-[10px] text-amber-300">Los materiales deberán añadirse manualmente porque este PDF no fue generado con el formato estructurado del CRM.</p></div><div class="mt-4 text-right"><button data-oc-close class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Aceptar</button></div>`);
                return;
            }
            payload.fecha=normalizeDate(payload.fecha);
            const result=await window.agregarOrdenCompraEstandar(payload);
            const omitted=(result.omitidos||[]).map(row=>`<li>${esc(row)}</li>`).join('');
            openModal(result.ok?'Orden importada':'No se pudo importar','Resultado de la lectura del PDF.',`<div class="rounded-xl border ${result.ok?'border-emerald-500/30 bg-emerald-950/15 text-emerald-200':'border-rose-500/30 bg-rose-950/15 text-rose-200'} p-4 text-sm">${esc(result.mensaje||'')} ${omitted?`<ul class="mt-3 list-disc pl-5 text-[10px] text-amber-200">${omitted}</ul>`:''}</div><div class="mt-4 text-right"><button data-oc-close class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Aceptar</button></div>`);
        }catch(error){
            openModal('No se pudo leer la orden','Revisa el archivo seleccionado.',`<div class="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 text-sm text-rose-200">${esc(error.message)}</div><div class="mt-4 text-right"><button data-oc-close class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Aceptar</button></div>`);
        }
    }
    function generateForm(){
        const data=window.obtenerDatosOrdenCompraProyecto?.();
        if(!data){alert('Selecciona primero un proyecto.');return}
        const rows=data.materiales.map((item,index)=>`<tr class="border-t border-[#243257]"><td class="px-3 py-2 text-[10px] font-mono text-blue-300">${esc(item.codigo)}</td><td class="px-3 py-2 text-xs text-gray-200">${esc(item.descripcion)}</td><td class="px-3 py-2 text-[10px] text-gray-400">${esc(item.unidad)}</td><td class="px-3 py-2 text-center text-[10px] text-gray-500">${item.cantidadPlaneada}</td><td class="px-3 py-2"><input data-oc-qty="${index}" type="number" min="0" step="0.01" value="${item.cantidad}" class="w-24 rounded-lg border border-[#243257] bg-[#060a14] px-2 py-2 text-center text-xs text-white"></td></tr>`).join('');
        const today=new Date().toISOString().slice(0,10);
        openModal('Generar PDF de orden de compra','El PDF incluirá el logo institucional, más opciones de prioridad y un bloque estructurado que el importador del CRM podrá leer automáticamente.',`<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><label class="text-[10px] text-gray-500">ORDEN DE COMPRA<input id="oc-number" value="${esc(data.ordenCompraProyecto||'')}" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></label><label class="text-[10px] text-gray-500">FECHA<input id="oc-date" type="date" value="${today}" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></label><label class="text-[10px] text-gray-500">PRIORIDAD<select id="oc-priority" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"><option value="inmediata">Inmediata</option><option value="critica">Crítica</option><option value="urgente">Urgente</option><option value="alta">Alta</option><option value="media">Media</option><option value="normal" selected>Normal</option><option value="baja">Baja</option><option value="programada">Programada</option><option value="sin_urgencia">Sin urgencia</option></select></label><label class="text-[10px] text-gray-500">N. O CÓDIGO DE REFERENCIA<input id="oc-reference" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></label><label class="text-[10px] text-gray-500">PROVEEDOR<input id="oc-provider" placeholder="Opcional" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></label><label class="text-[10px] text-gray-500">SOLICITADO POR<input id="oc-requested-by" placeholder="Nombre de quien solicita" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></label></div><div class="mt-4 overflow-x-auto rounded-xl border border-[#243257]"><table class="w-full min-w-[700px]"><thead class="bg-[#10182a] text-[9px] uppercase tracking-wider text-gray-500"><tr><th class="px-3 py-3 text-left">Código</th><th class="px-3 py-3 text-left">Material</th><th class="px-3 py-3 text-left">Unidad</th><th class="px-3 py-3 text-center">Planeado</th><th class="px-3 py-3 text-left">Cantidad OC</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">El proyecto no tiene materiales.</td></tr>'}</tbody></table></div><label class="mt-4 block text-[10px] text-gray-500">NOTAS<textarea id="oc-notes" rows="3" class="mt-1 w-full rounded-lg border border-[#243257] bg-[#060a14] px-3 py-2.5 text-xs text-white"></textarea></label><div class="mt-5 flex justify-end gap-2"><button data-oc-close class="rounded-lg border border-[#243257] px-4 py-2.5 text-xs font-semibold text-gray-300">Cancelar</button><button id="oc-generate-pdf" class="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500">Descargar PDF</button></div>`);
        document.getElementById('oc-generate-pdf').addEventListener('click',()=>createPdf(data));
    }
    async function createPdf(data){
        const number=t(document.getElementById('oc-number')?.value);
        const date=normalizeDate(document.getElementById('oc-date')?.value);
        const reference=t(document.getElementById('oc-reference')?.value);
        const provider=t(document.getElementById('oc-provider')?.value);
        const requestedBy=t(document.getElementById('oc-requested-by')?.value);
        const priority=t(document.getElementById('oc-priority')?.value||'normal');
        const notes=t(document.getElementById('oc-notes')?.value);
        if(!number)return alert('Escribe el número de orden de compra.');
        const materials=data.materiales.map((item,index)=>({...item,cantidad:n(document.querySelector(`[data-oc-qty="${index}"]`)?.value)})).filter(item=>item.cantidad>0);
        if(!materials.length)return alert('Indica al menos una cantidad mayor a cero.');
        if(!window.jspdf?.jsPDF)return alert('No se cargó la biblioteca para generar PDF.');
        const payload={version:1,sistema:'SKILLED_CRM',tipo:'ORDEN_COMPRA',ordenCompra:number,fecha:date,referencia:reference,proyecto:data.proyecto,nombreProyecto:data.nombreProyecto,cliente:data.cliente,responsable:data.responsable,proveedor:provider,prioridad:priority,solicitadoPor:requestedBy,notas,materiales:materials.map(item=>({codigo:item.codigo,descripcion:item.descripcion,unidad:item.unidad,categoria:item.categoria,cantidad:item.cantidad,precio:item.precio}))};
        const {jsPDF}=window.jspdf;
        const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
        const logo=await loadLogo();
        if(logo){try{doc.addImage(logo,'PNG',15,10,48,16.85)}catch(error){}}
        doc.setTextColor(0,65,107);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('ORDEN DE COMPRA',200,17,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(78,104,126);doc.text('DOCUMENTO DE ABASTECIMIENTO',200,11,{align:'right'});
        doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`OC: ${number}`,200,23,{align:'right'});
        doc.setDrawColor(0,65,107);doc.setLineWidth(.55);doc.line(15,29,200,29);
        const info=[['Proyecto',`${data.proyecto} - ${data.nombreProyecto||''}`],['Cliente',data.cliente||''],['Responsable',data.responsable||''],['Fecha',date||''],['Referencia',reference||''],['Proveedor',provider||''],['Prioridad',priorityLabel(priority)],['Solicitado por',requestedBy||'']];
        let y=34;doc.setFontSize(8);
        info.forEach(([label,value],i)=>{const col=i%2,row=Math.floor(i/2);const x=15+col*94;const yy=y+row*11;doc.setFont('helvetica','bold');doc.text(label.toUpperCase(),x,yy);doc.setFont('helvetica','normal');doc.text(t(value)||'-',x,yy+4,{maxWidth:86});});
        const body=materials.map((item,index)=>[index+1,item.codigo,item.descripcion,item.cantidad,item.unidad,item.precio?`$${Number(item.precio).toFixed(2)}`:'']);
        doc.autoTable({startY:84,head:[['Pos.','Código','Descripción','Cantidad','Unidad','Precio']],body,styles:{fontSize:7,cellPadding:2,textColor:[15,40,65],lineColor:[160,180,198],lineWidth:.1},headStyles:{fillColor:[220,232,243],textColor:[0,65,107],fontStyle:'bold'},columnStyles:{0:{cellWidth:10,halign:'center'},1:{cellWidth:31},2:{cellWidth:87},3:{cellWidth:22,halign:'right'},4:{cellWidth:20},5:{cellWidth:22,halign:'right'}}});
        let fy=doc.lastAutoTable.finalY+8;if(notes){doc.setFont('helvetica','bold');doc.text('NOTAS',15,fy);doc.setFont('helvetica','normal');doc.text(notes,15,fy+5,{maxWidth:185});fy+=15}
        doc.setDrawColor(160,180,198);doc.line(15,fy+13,80,fy+13);doc.line(125,fy+13,190,fy+13);doc.setFontSize(7);doc.text('Elaboró',47.5,fy+17,{align:'center'});doc.text('Autorizó',157.5,fy+17,{align:'center'});
        const encoded=encodePayload(payload);const chunks=encoded.match(/.{1,90}/g)||[];
        doc.addPage();doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('DATOS DE IMPORTACION CRM',15,18);doc.setFont('courier','normal');doc.setFontSize(5);doc.text('SKILLED_OC_JSON_BEGIN',15,25);let my=29;chunks.forEach(chunk=>{doc.text(chunk,15,my);my+=3;if(my>265){doc.addPage();my=15}});doc.text('SKILLED_OC_JSON_END',15,my+1);
        doc.save(`OC_${number.replace(/[^A-Za-z0-9_-]+/g,'_')}.pdf`);closeModal();
    }
    window.SkilledPurchaseOrders=Object.freeze({
        importar(){ensureModal();document.getElementById('oc-file-v12115').click()},
        generar:generateForm
    });
    ensureModal();
})();
(function(){
    'use strict';

    const text=value=>String(value??'').trim();
    const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
    const key=value=>text(value).toLocaleLowerCase('es-MX');
    const html=value=>typeof escapeHTML==='function'?escapeHTML(value):text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const form=document.getElementById('movimientoForm');
    if(!form||typeof configTipos==='undefined'||typeof iconosMovimiento==='undefined')return;

    let loanRows=[];
    let saving=false;
    let loanDestination='';
    let loanDestinationType='proyecto';
    let loanWarehouse='';

    iconosMovimiento.prestamo='<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M8 7h10a3 3 0 010 6h-2"/><path d="M16 10l-3 3 3 3"/><path d="M16 17H6a3 3 0 010-6h2"/><path d="M8 14l3-3-3-3"/></svg>';
    configTipos.prestamo={color:'violet',borderColor:'border-violet-500/50',shadowColor:'rgba(139,92,246,0.08)',btnBg:'bg-violet-950/10',text:'Registrar préstamo',placeholder:'Ej. Préstamo temporal de material reservado al proyecto 26041',title:'Préstamo',icon:iconosMovimiento.prestamo};

    function sourceProject(){return text(document.getElementById('proyecto_val')?.value)}
    function destinationProject(){return text(document.getElementById('proyecto_destino_prestamo')?.value||loanDestination)}
    function destinationWarehouse(){return text(document.getElementById('almacen_destino_prestamo')?.value||loanWarehouse)}
    function projectStockMap(line){return line?.stockProyectoPorAlmacen||line?.stock_proyecto_por_almacen||line?.material?.stockProyectoPorAlmacen||line?.material?.stock_proyecto_por_almacen||{}}
    function reservedTotal(line){return Object.values(projectStockMap(line)).reduce((sum,value)=>sum+number(value),0)}
    function productOf(line){
        const base=line?.material||{};
        const fresh=(catalogoProductos||[]).find(item=>key(item.codigo)===key(line?.codigo||base.codigo));
        const product=fresh?{...base,...fresh}:base;
        return{
            ...product,
            codigo:text(line?.codigo||product.codigo),
            desc:text(product.desc||product.descripcion||line?.descripcion||line?.codigo),
            descripcion:text(product.descripcion||product.desc||line?.descripcion||line?.codigo),
            unidad:text(line?.unidad||product.unidad),
            categoria:text(product.categoria||line?.categoria)
        };
    }
    function loanAlreadyAdded(code,excludeId=''){
        return(itemsAgregados||[]).filter(item=>item.tipo==='prestamo'&&String(item.id)!==String(excludeId)&&key(item.producto?.codigo)===key(code)&&text(item.proyecto)===sourceProject()).reduce((sum,item)=>sum+number(item.cantidad),0);
    }
    function availableForLoan(line,excludeId=''){
        return Math.max(0,reservedTotal(line)-loanAlreadyAdded(line?.codigo,excludeId));
    }
    function projectLabel(project){
        const row=(proyectosDisponibles||[]).find(item=>text(item.proyecto)===text(project));
        return row?.nombreProyecto?`${text(project)} — ${text(row.nombreProyecto)}`:text(project);
    }
    function movementError(error){
        return[error?.message,error?.details,error?.hint].map(text).filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join('\n')||'Ocurrió un error desconocido.';
    }
    function assignSectionIds(){
        const product=document.getElementById('producto-buscador-wrap')?.parentElement;
        const quantity=document.getElementById('cantidad_val')?.parentElement?.parentElement;
        const order=document.getElementById('orden_compra_val')?.parentElement?.parentElement;
        if(product&&!product.id)product.id='seccion-producto-movimiento-v12137';
        if(quantity&&!quantity.id)quantity.id='seccion-cantidad-movimiento-v12137';
        if(order&&!order.id)order.id='seccion-orden-movimiento-v12137';
    }
    function insertLoanButton(){
        if(document.getElementById('btn-prestamo'))return;
        const transfer=document.getElementById('btn-traspaso');
        const grid=transfer?.parentElement;
        if(!transfer||!grid)return;
        grid.className='grid grid-cols-2 md:grid-cols-5 gap-2.5';
        const button=document.createElement('button');
        button.type='button';
        button.id='btn-prestamo';
        button.className='flex items-center justify-between px-3 py-3.5 rounded-lg border bg-[#060a14] border-[#161f38] text-gray-400 text-xs font-semibold hover:border-violet-500/30 hover:text-violet-400 transition-all';
        button.innerHTML=`<span class="flex items-center gap-2">${iconosMovimiento.prestamo}<span>Préstamo</span></span><span class="text-[11px] text-gray-600">⇄</span>`;
        button.addEventListener('click',()=>window.cambiarTipo('prestamo'));
        transfer.insertAdjacentElement('afterend',button);
    }
    function ensureLoanPanel(){
        if(document.getElementById('panel-prestamo-v12141'))return;
        const projectWrapper=document.getElementById('wrapper-proyecto-movimiento');
        if(!projectWrapper)return;
        const panel=document.createElement('section');
        panel.id='panel-prestamo-v12141';
        panel.className='hidden rounded-xl border border-violet-500/25 bg-violet-950/5 p-4';
        panel.innerHTML=`<div class="flex items-start gap-3"><div class="w-10 h-10 rounded-xl border border-violet-500/30 bg-violet-950/20 text-violet-300 flex items-center justify-center shrink-0">${iconosMovimiento.prestamo}</div><div><p class="text-xs font-semibold text-white">Préstamo de material reservado</p><p class="mt-1 text-[10px] leading-relaxed text-gray-500">Solo muestra existencia apartada para el proyecto de origen. El préstamo puede enviarse al almacén general o a otro proyecto.</p></div></div><div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"><button type="button" data-loan-destination="proyecto" class="loan-destination rounded-xl border px-4 py-3 text-left"><span class="block text-xs font-semibold">Prestar a otro proyecto</span><span class="mt-1 block text-[9px] opacity-80">Mueve la reserva al proyecto destino sin afectar el stock general.</span></button><button type="button" data-loan-destination="almacen" class="loan-destination rounded-xl border px-4 py-3 text-left"><span class="block text-xs font-semibold">Prestar al almacén general</span><span class="mt-1 block text-[9px] opacity-80">Libera temporalmente la reserva al almacén seleccionado y conserva el registro del préstamo.</span></button></div><label id="prestamo-proyecto-wrap" class="block mt-4 text-[10px] uppercase tracking-widest font-bold text-gray-500">Proyecto que recibe el préstamo *<select id="proyecto_destino_prestamo" class="mt-2 w-full rounded-lg border border-violet-500/30 bg-[#060a14] px-4 py-3 text-xs text-gray-200 outline-none focus:border-violet-400"><option value="">Selecciona el proyecto de destino...</option></select></label><label id="prestamo-almacen-wrap" class="hidden mt-4 text-[10px] uppercase tracking-widest font-bold text-gray-500">Almacén que recibe el préstamo *<select id="almacen_destino_prestamo" class="mt-2 w-full rounded-lg border border-amber-500/30 bg-[#060a14] px-4 py-3 text-xs text-gray-200 outline-none focus:border-amber-400"><option value="">Selecciona el almacén de destino...</option></select></label><div id="prestamo-destino-aviso" class="mt-3 rounded-lg border border-violet-500/20 bg-violet-950/10 px-3 py-2 text-[10px] text-violet-200"></div>`;
        projectWrapper.insertAdjacentElement('afterend',panel);
        panel.querySelectorAll('[data-loan-destination]').forEach(button=>button.addEventListener('click',()=>setLoanDestinationType(button.dataset.loanDestination)));
        panel.querySelector('#proyecto_destino_prestamo').addEventListener('change',event=>{
            const next=text(event.target.value);
            const currentItems=(itemsAgregados||[]).filter(item=>item.tipo==='prestamo');
            if(currentItems.length&&loanDestination&&next!==loanDestination){
                if(!confirm('Cambiar el proyecto de destino eliminará los materiales agregados al préstamo. ¿Continuar?')){event.target.value=loanDestination;return}
                itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='prestamo');renderLista();actualizarPreviewHeader();
            }
            loanDestination=next;
            itemsAgregados=(itemsAgregados||[]).map(item=>item.tipo==='prestamo'?{...item,destinoTipo:'proyecto',proyectoDestino:next,proyecto_destino:next,bodegaDestino:next?`Proyecto ${next}`:'',ubicacion:next?`Destino: Proyecto ${next}`:''}:item);
            renderLista();renderPlanEntregaProyecto();
        });
        panel.querySelector('#almacen_destino_prestamo').addEventListener('change',event=>{
            const next=text(event.target.value);
            const currentItems=(itemsAgregados||[]).filter(item=>item.tipo==='prestamo');
            if(currentItems.length&&loanWarehouse&&next!==loanWarehouse){
                if(!confirm('Cambiar el almacén de destino eliminará los materiales agregados al préstamo. ¿Continuar?')){event.target.value=loanWarehouse;return}
                itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='prestamo');renderLista();actualizarPreviewHeader();
            }
            loanWarehouse=next;
            itemsAgregados=(itemsAgregados||[]).map(item=>item.tipo==='prestamo'?{...item,destinoTipo:'almacen',proyectoDestino:'',proyecto_destino:'',bodegaDestino:next,ubicacion:next?`Destino: ${next}`:''}:item);
            renderLista();renderPlanEntregaProyecto();
        });
        setLoanDestinationType('proyecto',false);
    }

    function setLoanDestinationType(type,clearItems=true){
        const next=type==='almacen'?'almacen':'proyecto';
        if(clearItems&&loanDestinationType!==next&&(itemsAgregados||[]).some(item=>item.tipo==='prestamo')){
            if(!confirm('Cambiar el tipo de destino eliminará los materiales agregados al préstamo. ¿Continuar?'))return;
            itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='prestamo');renderLista();actualizarPreviewHeader();
        }
        loanDestinationType=next;
        document.querySelectorAll('.loan-destination').forEach(button=>{
            const active=button.dataset.loanDestination===next;
            button.className=`loan-destination rounded-xl border px-4 py-3 text-left transition ${active?(next==='proyecto'?'border-violet-500/50 bg-violet-950/15 text-violet-200':'border-amber-500/50 bg-amber-950/15 text-amber-200'):'border-[#243257] bg-[#060a14] text-gray-400 hover:text-white'}`;
        });
        document.getElementById('prestamo-proyecto-wrap')?.classList.toggle('hidden',next!=='proyecto');
        document.getElementById('prestamo-almacen-wrap')?.classList.toggle('hidden',next!=='almacen');
        const notice=document.getElementById('prestamo-destino-aviso');
        if(notice){notice.className=`mt-3 rounded-lg border px-3 py-2 text-[10px] ${next==='proyecto'?'border-violet-500/20 bg-violet-950/10 text-violet-200':'border-amber-500/20 bg-amber-950/10 text-amber-200'}`;notice.textContent=next==='proyecto'?'La reserva se descontará del proyecto origen y se sumará al proyecto destino, conservando el almacén de procedencia.':'La reserva se descontará del proyecto origen y se sumará al stock general del almacén seleccionado. El préstamo quedará trazable en historial.'}
        populateLoanDestinations();populateLoanWarehouses();
    }

    function populateLoanDestinations(){
        const select=document.getElementById('proyecto_destino_prestamo');
        if(!select)return;
        const source=sourceProject();
        const selected=text(select.value||loanDestination);
        select.innerHTML='<option value="">Selecciona el proyecto de destino...</option>'+(proyectosDisponibles||[]).filter(item=>item.proyecto&&text(item.proyecto)!==source).map(item=>`<option value="${html(item.proyecto)}">${html(item.proyecto)}${item.nombreProyecto?' — '+html(item.nombreProyecto):''}</option>`).join('');
        if(selected&&selected!==source&&[...select.options].some(option=>option.value===selected))select.value=selected;
        loanDestination=text(select.value);
    }
    function populateLoanWarehouses(){
        const select=document.getElementById('almacen_destino_prestamo');
        if(!select)return;
        const selected=text(select.value||loanWarehouse);
        const rows=Array.isArray(typeof almacenesDisponibles!=='undefined'?almacenesDisponibles:window.almacenesDisponibles)?(typeof almacenesDisponibles!=='undefined'?almacenesDisponibles:window.almacenesDisponibles):[];
        select.innerHTML='<option value="">Selecciona el almacén de destino...</option>'+rows.filter(item=>text(item?.nombre||item)).map(item=>{const name=text(item?.nombre||item);return `<option value="${html(name)}">${html(name)}</option>`}).join('');
        if(selected&&[...select.options].some(option=>option.value===selected))select.value=selected;
        loanWarehouse=text(select.value);
    }
    function genericSections(){
        return[
            document.getElementById('seccion-producto-movimiento-v12137'),
            document.getElementById('seccion-cantidad-movimiento-v12137'),
            document.getElementById('seccion-orden-movimiento-v12137'),
            document.getElementById('btn-agregar')
        ].filter(Boolean);
    }
    function restoreGenericSections(){genericSections().forEach(node=>node.classList.remove('hidden'))}
    function hideDynamicPanelsForLoan(){
        ['modo-entrada-proyecto-v1294','modo-traspaso-proyecto-v1294','informacion-proyecto-movimiento-v1298','documentos-movimiento-v125','seccion-ajuste-stock','grid-bodegas','wrapper-recibe'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
        genericSections().forEach(node=>node.classList.add('hidden'));
    }
    function updateLoanButtonState(){
        const inactive={entrada:'hover:border-emerald-500/30 hover:text-emerald-400',salida:'hover:border-rose-500/30 hover:text-rose-400',ajuste:'hover:border-amber-500/30 hover:text-amber-400',traspaso:'hover:border-blue-500/30 hover:text-blue-400'};
        ['entrada','salida','ajuste','traspaso'].forEach(type=>{
            const button=document.getElementById(`btn-${type}`);
            if(button&&currentType==='prestamo')button.className=`flex items-center justify-between px-3 py-3.5 rounded-lg border bg-[#060a14] border-[#161f38] text-gray-400 text-xs font-semibold transition-all ${inactive[type]}`;
        });
        const loanButton=document.getElementById('btn-prestamo');
        if(loanButton)loanButton.className=currentType==='prestamo'?'flex items-center justify-between px-3 py-3.5 rounded-lg border text-xs font-semibold transition-all text-violet-300 border-violet-500/50 bg-violet-950/10 shadow-[0_0_12px_rgba(139,92,246,0.08)]':'flex items-center justify-between px-3 py-3.5 rounded-lg border bg-[#060a14] border-[#161f38] text-gray-400 text-xs font-semibold hover:border-violet-500/30 hover:text-violet-400 transition-all';
    }
    function setSubmitAppearance(){
        const button=document.getElementById('btn-submit');
        if(!button)return;
        const config=configTipos[currentType]||configTipos.entrada;
        button.className=`px-5 py-2.5 rounded-lg bg-${config.color}-600 hover:bg-${config.color}-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg`;
        button.innerHTML=`<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg> ${config.text}`;
    }
    function applyLoanView(){
        const panel=document.getElementById('panel-prestamo-v12141');
        panel?.classList.remove('hidden');
        hideDynamicPanelsForLoan();
        const label=document.getElementById('proyecto-label');
        const help=document.getElementById('proyecto-ayuda');
        if(label)label.textContent='Proyecto que presta el material *';
        if(help)help.textContent='Solo se mostrarán materiales con existencia reservada para este proyecto.';
        const productInput=document.getElementById('producto_search');
        if(productInput){productInput.disabled=true;productInput.placeholder='Selecciona materiales desde la reserva del proyecto...'}
        document.getElementById('tipo_movimiento_val').value='prestamo';
        document.getElementById('motivo_val').placeholder=configTipos.prestamo.placeholder;
        document.getElementById('motivo-obligatorio')?.classList.remove('hidden');
        populateLoanDestinations();
        populateLoanWarehouses();
        setLoanDestinationType(loanDestinationType,false);
        updateLoanButtonState();
        setSubmitAppearance();
        renderPlanEntregaProyecto();
        actualizarPreviewHeader();
    }
    function leaveLoanView(){
        document.getElementById('panel-prestamo-v12141')?.classList.add('hidden');
        restoreGenericSections();
        const movementPanel=document.getElementById('panel-materiales-proyecto');
        movementPanel?.classList.remove('border-violet-500/20','bg-violet-950/5');
        movementPanel?.classList.add('border-rose-500/20','bg-rose-950/5');
        const title=movementPanel?.querySelector('p.text-violet-300');
        if(title){title.textContent='Materiales del proyecto';title.className='text-[10px] font-bold uppercase tracking-widest text-rose-300'}
        const label=document.getElementById('proyecto-label');
        if(label)label.textContent='Proyecto (opcional)';
        document.getElementById('motivo-obligatorio')?.classList.add('hidden');
    }
    function renderLoanRows(){
        const panel=document.getElementById('panel-materiales-proyecto');
        const list=document.getElementById('lista-plan-proyecto');
        const summary=document.getElementById('resumen-plan-proyecto');
        if(!panel||!list||!summary)return;
        const source=sourceProject();
        panel.classList.toggle('hidden',!source);
        const title=panel.querySelector('p.text-rose-300');
        if(title){title.textContent='Material reservado disponible para préstamo';title.className='text-[10px] font-bold uppercase tracking-widest text-violet-300'}
        panel.classList.remove('border-rose-500/20','bg-rose-950/5');
        panel.classList.add('border-violet-500/20','bg-violet-950/5');
        if(!source){
            summary.textContent='Selecciona el proyecto que prestará el material.';
            list.innerHTML='<div class="px-4 py-10 text-center text-xs text-gray-500">Selecciona un proyecto de origen para consultar su reserva.</div>';
            return;
        }
        if(typeof cargandoPlanEntrega!=='undefined'&&cargandoPlanEntrega){
            summary.textContent='Consultando existencias reservadas del proyecto...';
            list.innerHTML='<div class="px-4 py-10 text-center text-xs text-gray-500">Cargando reserva...</div>';
            return;
        }
        loanRows=(planEntregaProyecto||[]).filter(line=>reservedTotal(line)>0).sort((a,b)=>text(productOf(a).desc).localeCompare(text(productOf(b).desc),'es'));
        const total=loanRows.reduce((sum,line)=>sum+reservedTotal(line),0);
        summary.textContent=`${loanRows.length} materiales reservados · ${total.toLocaleString('es-MX')} unidades disponibles`;
        if(!loanRows.length){
            list.innerHTML='<div class="px-4 py-10 text-center"><p class="text-xs font-semibold text-gray-300">Este proyecto no tiene material reservado disponible.</p><p class="mt-1 text-[10px] text-gray-600">Los materiales ya entregados se administran desde Traspaso como sobrantes.</p></div>';
            return;
        }
        list.innerHTML=loanRows.map((line,index)=>{
            const product=productOf(line);
            const map=projectStockMap(line);
            const available=availableForLoan(line);
            const warehouseTags=Object.entries(map).filter(([,stock])=>number(stock)>0).map(([warehouseName,stock])=>`<span class="text-[9px] rounded border border-[#243257] bg-[#141d34] px-1.5 py-0.5 text-gray-300">${html(warehouseName)}: ${number(stock)}</span>`).join('');
            return`<div class="px-4 py-3 flex flex-col xl:flex-row xl:items-center gap-3"><div class="flex items-start gap-3 min-w-0 flex-1">${typeof imagenProductoHTML==='function'?imagenProductoHTML(product,'w-10 h-10'):''}<div class="min-w-0 flex-1"><p class="text-xs font-semibold text-white truncate">${html(product.desc||product.descripcion||product.codigo)}</p><p class="mt-0.5 text-[9px] font-mono text-violet-300">${html(product.codigo)} · ${html(product.unidad||'')}</p><div class="mt-1.5 flex flex-wrap gap-1.5"><span class="text-[9px] rounded border border-violet-500/30 bg-violet-950/15 px-1.5 py-0.5 text-violet-200">Reserva disponible: ${available}</span>${warehouseTags}</div></div></div><div class="flex items-center gap-2 xl:w-52"><input id="prestamo-cantidad-${index}" type="number" min="0.01" max="${available}" step="0.01" value="${available>0?Math.min(1,available):0}" ${available<=0?'disabled':''} class="min-w-0 flex-1 rounded-lg border border-violet-500/30 bg-[#060a14] px-3 py-2 text-center text-xs text-white outline-none focus:border-violet-400 disabled:opacity-40"><button type="button" onclick="agregarPrestamoMaterialV12137(${index})" ${available<=0?'disabled':''} class="w-10 h-9 rounded-lg border border-violet-500/35 bg-violet-950/15 text-lg font-bold text-violet-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">+</button></div></div>`;
        }).join('');
    }
    window.agregarPrestamoMaterialV12137=function(index){
        const source=sourceProject();
        const destinationType=loanDestinationType;
        const destinationProjectValue=destinationProject();
        const destinationWarehouseValue=destinationWarehouse();
        if(!source)return alert('Selecciona el proyecto que prestará el material.');
        if(destinationType==='proyecto'){
            if(!destinationProjectValue)return alert('Selecciona el proyecto que recibirá el préstamo.');
            if(source===destinationProjectValue)return alert('El proyecto de destino debe ser diferente al proyecto de origen.');
        }else if(!destinationWarehouseValue)return alert('Selecciona el almacén general que recibirá el préstamo.');
        const line=loanRows[index];
        if(!line)return;
        const product=productOf(line);
        const quantity=number(document.getElementById(`prestamo-cantidad-${index}`)?.value);
        const available=availableForLoan(line);
        if(quantity<=0)return alert('Escribe una cantidad mayor a cero.');
        if(quantity>available)return alert(`Solo hay ${available} reservados disponibles para prestar.`);
        const destinationKey=destinationType==='proyecto'?destinationProjectValue:destinationWarehouseValue;
        const existing=(itemsAgregados||[]).find(item=>item.tipo==='prestamo'&&text(item.proyecto)===source&&text(item.destinoTipo||item.destino_tipo||'proyecto')===destinationType&&text(destinationType==='proyecto'?item.proyectoDestino:item.bodegaDestino)===destinationKey&&key(item.producto?.codigo)===key(product.codigo));
        if(existing)existing.cantidad=number(existing.cantidad)+quantity;
        else itemsAgregados.push({
            id:Date.now()+Math.random().toString(36).slice(2,7),
            tipo:'prestamo',
            producto:{...product,_lineaMovimiento:line},
            cantidad:quantity,
            proyecto:source,
            destinoTipo:destinationType,
            destino_tipo:destinationType,
            proyectoDestino:destinationType==='proyecto'?destinationProjectValue:'',
            proyecto_destino:destinationType==='proyecto'?destinationProjectValue:'',
            ubicacion:destinationType==='proyecto'?`Destino: Proyecto ${destinationProjectValue}`:`Destino: ${destinationWarehouseValue}`,
            bodegaOrigen:`Reserva del proyecto ${source}`,
            bodegaDestino:destinationType==='proyecto'?`Proyecto ${destinationProjectValue}`:destinationWarehouseValue,
            stockFuente:'reserva_proyecto',
            stock_fuente:'reserva_proyecto',
            cantidadStockProyecto:quantity,
            cantidad_stock_proyecto:quantity,
            cantidadStockGeneral:0,
            cantidad_stock_general:0,
            alcance:'sin_plan',
            esNoListado:false,
            es_no_listado:false
        });
        renderLista();
        actualizarPreviewHeader();
        renderPlanEntregaProyecto();
    };

    const previousUpdateQuantity=window.actualizarCantidadItemV129;
    window.actualizarCantidadItemV129=function(id,value){
        const item=(itemsAgregados||[]).find(row=>String(row.id)===String(id));
        if(item?.tipo!=='prestamo')return previousUpdateQuantity?.(id,value);
        const quantity=number(value);
        if(quantity<=0){eliminarItem(id);return}
        const line=(planEntregaProyecto||[]).find(row=>key(row.codigo)===key(item.producto?.codigo));
        const maximum=line?availableForLoan(line,id):number(item.cantidad);
        if(quantity>maximum){alert(`Solo hay ${maximum} reservados disponibles para este préstamo.`);renderLista();return}
        item.cantidad=quantity;
        item.cantidadStockProyecto=quantity;
        item.cantidad_stock_proyecto=quantity;
        actualizarPreviewHeader();
        renderPlanEntregaProyecto();
    };

    const previousRenderPlan=window.renderPlanEntregaProyecto;
    window.renderPlanEntregaProyecto=function(){
        if(currentType==='prestamo')return renderLoanRows();
        return previousRenderPlan?.();
    };

    const previousChangeType=window.cambiarTipo;
    window.cambiarTipo=function(type){
        if(type!=='prestamo'){
            const wasLoan=currentType==='prestamo';
            if(wasLoan){
                itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='prestamo');
                loanDestination='';
                loanWarehouse='';
                loanDestinationType='proyecto';
                leaveLoanView();
            }
            const result=previousChangeType(type);
            updateLoanButtonState();
            setTimeout(()=>{updateLoanButtonState();setSubmitAppearance()},0);
            return result;
        }
        if(currentType!=='prestamo'&&itemsAgregados.length){
            if(!confirm('Cambiar a Préstamo eliminará la lista actual de movimientos. ¿Continuar?'))return;
            itemsAgregados=[];
            renderLista();
        }
        currentType='prestamo';
        productoSeleccionado=null;
        stockAdj='Aumentar';
        document.getElementById('tipo_movimiento_val').value='prestamo';
        applyLoanView();
        const source=sourceProject();
        if(source)Promise.resolve(cargarPlanEntregaProyecto(source)).then(()=>renderLoanRows());
        else{planEntregaProyecto=[];renderLoanRows()}
    };

    const previousChangeProject=window.manejarCambioProyecto;
    window.manejarCambioProyecto=async function(value){
        if(currentType!=='prestamo')return previousChangeProject(value);
        if(itemsAgregados.some(item=>item.tipo==='prestamo')){
            if(!confirm('Cambiar el proyecto de origen eliminará los materiales agregados al préstamo. ¿Continuar?')){
                document.getElementById('proyecto_val').value=proyectoAnterior;
                return;
            }
            itemsAgregados=itemsAgregados.filter(item=>item.tipo!=='prestamo');
            renderLista();
            actualizarPreviewHeader();
        }
        proyectoAnterior=text(value);
        loanDestination='';
        loanWarehouse='';
        populateLoanDestinations();
        populateLoanWarehouses();
        planEntregaProyecto=[];
        cargandoPlanEntrega=true;
        renderLoanRows();
        if(value){
            try{planEntregaProyecto=await SkilledDB.listProjectMovementPlan(value,{includeOutsidePlan:true})}
            catch(error){
                console.error(error);
                document.getElementById('lista-plan-proyecto').innerHTML=`<div class="px-4 py-10 text-center text-xs text-rose-400">${html(movementError(error))}</div>`;
            }
        }
        cargandoPlanEntrega=false;
        renderLoanRows();
    };

    async function validateStandardMovement(){
        if(!itemsAgregados.length)throw new Error('Agrega al menos un material a la lista.');
        const origin=text(document.getElementById('bodega_origen_val')?.value);
        const destination=text(document.getElementById('bodega_destino_val')?.value);
        const reason=text(document.getElementById('motivo_val')?.value);
        const receiver=text(document.getElementById('recibe_nombre_val')?.value);
        if(currentType==='salida'&&!origin)throw new Error('Selecciona la bodega de origen.');
        if(currentType==='salida'&&!receiver)throw new Error('Escribe el nombre de quien recibe el material.');
        if(currentType==='entrada'&&!destination)throw new Error('Selecciona la bodega de destino.');
        if(currentType==='entrada'){
            const purchase=text(document.getElementById('orden_compra_val')?.value);
            for(const item of itemsAgregados.filter(row=>row.tipo==='entrada'&&Number(row.solicitudCompraId||0)>0)){
                const pending=number(item.cantidadOrdenPendiente??item.cantidad_orden_pendiente);
                if(pending>0&&number(item.cantidad)>pending)throw new Error(`La cantidad de ${item.producto?.codigo||''} excede lo pendiente de la orden (${pending} ${item.producto?.unidad||''}).`);
                const orderWarehouse=text(item.almacenOrden??item.almacen_orden);
                if(orderWarehouse&&key(orderWarehouse)!==key(destination))throw new Error(`El material ${item.producto?.codigo||''} pertenece al almacén ${orderWarehouse}, no a ${destination}.`);
                if(item.ordenCompra&&purchase&&key(item.ordenCompra)!==key(purchase))throw new Error(`El material ${item.producto?.codigo||''} está vinculado a la orden ${item.ordenCompra}.`);
            }
        }
        if(currentType==='ajuste'&&!destination&&!origin)throw new Error('Selecciona el almacén donde se aplicará el ajuste.');
        if(currentType==='ajuste'&&!reason)throw new Error('Describe el motivo del ajuste para conservar la trazabilidad.');
        if(currentType==='traspaso'){
            const projectTransfer=Boolean(sourceProject()&&itemsAgregados.some(item=>item.tipo==='traspaso'&&(item.traspasoModo||item.traspaso_modo)));
            if(!projectTransfer){
                if(!origin||!destination)throw new Error('Selecciona la bodega de origen y la bodega de destino.');
                if(key(origin)===key(destination))throw new Error('La bodega de origen y destino deben ser diferentes.');
            }
        }
    }
    function normalizedStandardItems(){
        const source=sourceProject();
        const origin=text(document.getElementById('bodega_origen_val')?.value);
        const destination=text(document.getElementById('bodega_destino_val')?.value);
        const receiver=text(document.getElementById('recibe_nombre_val')?.value);
        const purchase=text(document.getElementById('orden_compra_val')?.value);
        const purchaseDate=text(document.getElementById('fecha_orden_compra_val')?.value);
        const reference=text(document.getElementById('referencia_movimiento_val')?.value);
        return(itemsAgregados||[]).map(item=>{
            const projectTransfer=item.tipo==='traspaso'&&item.proyecto&&(item.traspasoModo||item.traspaso_modo);
            const product=item.producto||{};
            return{
                ...item,
                codigo:text(item.codigo||product.codigo),
                descripcion:text(item.descripcion||product.descripcion||product.desc),
                unidad:text(item.unidad||product.unidad),
                categoria:text(item.categoria||product.categoria),
                precio:number(item.precio??item.precio_unitario??product.precio),
                proyecto:text(item.proyecto||source),
                ubicacion:projectTransfer?'':text(item.ubicacion||ubicacionMovimientoTexto()),
                ubicacionOrigen:projectTransfer?'':text(item.ubicacionOrigen||document.getElementById('ubicacion_origen_val')?.value),
                ubicacionDestino:projectTransfer?'':text(item.ubicacionDestino||document.getElementById('ubicacion_destino_val')?.value),
                ordenCompra:text(item.ordenCompra||purchase),
                fechaOrdenCompra:text(item.fechaOrdenCompra||purchaseDate),
                fecha_orden_compra:text(item.fecha_orden_compra||purchaseDate),
                referencia:text(item.referencia||reference),
                bodegaOrigen:projectTransfer?'':text(item.bodegaOrigen||origin),
                bodegaDestino:projectTransfer&&text(item.traspasoModo||item.traspaso_modo)==='proyecto'?'':text(item.bodegaDestino||destination),
                recibeNombre:text(item.recibeNombre||receiver),
                recibeTipo:text(item.recibeTipo||'persona'),
                esNoListado:Boolean(item.esNoListado??item.es_no_listado??product.esNoListado??product.es_no_listado),
                es_no_listado:Boolean(item.esNoListado??item.es_no_listado??product.esNoListado??product.es_no_listado)
            };
        });
    }
    async function saveMovement(){
        if(saving)return;
        saving=true;
        const button=document.getElementById('btn-submit');
        const type=currentType;
        const source=sourceProject();
        const destinationLoan=destinationProject();
        const destinationLoanWarehouse=destinationWarehouse();
        const destinationLoanType=loanDestinationType;
        const requestId=typeof crearRequestId==='function'?crearRequestId():(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const reason=text(document.getElementById('motivo_val')?.value);
        const date=new Date().toISOString();
        if(button){button.disabled=true;button.textContent='Guardando movimiento...'}
        try{
            let result;
            let products;
            let ticketOrigin=text(document.getElementById('bodega_origen_val')?.value);
            let ticketDestination=text(document.getElementById('bodega_destino_val')?.value);
            if(type==='prestamo'){
                if(!source)throw new Error('Selecciona el proyecto que prestará el material.');
                if(destinationLoanType==='proyecto'){
                    if(!destinationLoan)throw new Error('Selecciona el proyecto que recibirá el préstamo.');
                    if(source===destinationLoan)throw new Error('El proyecto de destino debe ser diferente al proyecto de origen.');
                }else if(!destinationLoanWarehouse)throw new Error('Selecciona el almacén general que recibirá el préstamo.');
                products=(itemsAgregados||[]).filter(item=>item.tipo==='prestamo');
                if(!products.length)throw new Error('Agrega al menos un material reservado al préstamo.');
                if(!reason)throw new Error('Escribe el motivo o la finalidad del préstamo.');
                result=await SkilledDB.loanProjectMaterials({requestId,proyectoOrigen:source,destinoTipo:destinationLoanType,proyectoDestino:destinationLoanType==='proyecto'?destinationLoan:'',almacenDestino:destinationLoanType==='almacen'?destinationLoanWarehouse:'',motivo:reason,productos:products});
                ticketOrigin=`Reserva del proyecto ${source}`;
                ticketDestination=destinationLoanType==='proyecto'?`Proyecto ${destinationLoan}`:destinationLoanWarehouse;
            }else{
                await validateStandardMovement();
                products=normalizedStandardItems();
                const transferItem=type==='traspaso'?products.find(item=>item.tipo==='traspaso'&&(item.traspasoModo||item.traspaso_modo)):null;
                const projectTransfer=Boolean(source&&transferItem);
                if(projectTransfer){
                    const mode=text(transferItem.traspasoModo||transferItem.traspaso_modo);
                    const destinationProjectValue=text(transferItem.proyectoDestino||transferItem.proyecto_destino);
                    if(mode==='proyecto'&&!destinationProjectValue)throw new Error('Selecciona el proyecto de destino.');
                    if(mode==='almacen'&&!ticketDestination)throw new Error('Selecciona el almacén donde quedará el sobrante.');
                    result=await SkilledDB.transferProjectMaterials({requestId,proyectoOrigen:source,modo:mode,proyectoDestino:destinationProjectValue,almacenDestino:ticketDestination,motivo:reason,productos});
                    ticketOrigin=`Proyecto ${source}`;
                    ticketDestination=mode==='proyecto'?`Proyecto ${destinationProjectValue}`:ticketDestination;
                }else{
                    result=await SkilledDB.registerMovement({requestId,tipo_movimiento:type,motivo:reason,fecha:date,fechaOrdenCompra:text(document.getElementById('fecha_orden_compra_val')?.value),referencia:text(document.getElementById('referencia_movimiento_val')?.value),productos:products});
                }
            }
            const ticketProducts=products.map(item=>({...item,producto:{...item.producto,unidad:item.producto?.unidad||item.unidad||''}}));
            if(window.SkilledTickets){
                const titles={entrada:'Comprobante de entrada de material',salida:'Comprobante de salida de material',ajuste:'Comprobante de ajuste de material',traspaso:'Comprobante de traspaso de material',prestamo:'Comprobante de préstamo de material'};
                SkilledTickets.mostrarListo({titulo:titles[type]||'Comprobante de movimiento de material',folio:text(document.getElementById('referencia_movimiento_val')?.value)||result?.requestId||requestId,requestId:result?.requestId||requestId,referencia:text(document.getElementById('referencia_movimiento_val')?.value),fecha:date,proyecto:source,proyectoDestino:type==='prestamo'&&destinationLoanType==='proyecto'?destinationLoan:text(products[0]?.proyectoDestino||products[0]?.proyecto_destino),bodegaOrigen:ticketOrigin,bodegaDestino:ticketDestination,ubicacion:type==='prestamo'?'':text(typeof ubicacionMovimientoTexto==='function'?ubicacionMovimientoTexto():''),recibeNombre:text(document.getElementById('recibe_nombre_val')?.value),recibeTipo:text(document.getElementById('recibe_nombre_val')?.value)?'persona':'',notas:reason,productos:ticketProducts});
            }else alert(`Movimiento guardado correctamente. Registros creados: ${number(result?.registrados)||products.length}.`);
            const savedSource=source;
            const savedDestination=destinationLoan;
            const savedWarehouse=destinationLoanWarehouse;
            const savedDestinationType=destinationLoanType;
            itemsAgregados=[];
            renderLista();
            actualizarPreviewHeader();
            if(typeof cargarCatalogo==='function')await cargarCatalogo();
            if(type==='prestamo'){
                document.getElementById('motivo_val').value='';
                document.getElementById('proyecto_val').value=savedSource;
                loanDestinationType=savedDestinationType;
                loanDestination=savedDestination;
                loanWarehouse=savedWarehouse;
                await window.manejarCambioProyecto(savedSource);
                setLoanDestinationType(savedDestinationType,false);
                populateLoanDestinations();
                populateLoanWarehouses();
                const projectSelect=document.getElementById('proyecto_destino_prestamo');
                const warehouseSelect=document.getElementById('almacen_destino_prestamo');
                if(projectSelect&&savedDestinationType==='proyecto')projectSelect.value=savedDestination;
                if(warehouseSelect&&savedDestinationType==='almacen')warehouseSelect.value=savedWarehouse;
                loanDestination=savedDestination;
                loanWarehouse=savedWarehouse;
                const destinationText=savedDestinationType==='proyecto'?`proyecto ${savedDestination}`:`almacén ${savedWarehouse}`;
                const pendingLocation=savedDestinationType==='almacen'?' Se generó una notificación para asignar ubicación específica en el almacén.':'';
                setTimeout(()=>alert(`El material reservado fue prestado desde el proyecto ${savedSource} al ${destinationText}.${pendingLocation}`),120);
            }else{
                const savedType=type;
                form.reset();
                if(document.getElementById('cantidad_val'))document.getElementById('cantidad_val').value='0';
                window.cambiarTipo(savedType);
                if(document.getElementById('proyecto_val'))document.getElementById('proyecto_val').value=savedSource;
                if(savedSource)await window.manejarCambioProyecto(savedSource);
            }
        }catch(error){
            console.error('Error al registrar movimiento:',error);
            alert(`No se pudo guardar el movimiento:\n${movementError(error)}`);
        }finally{
            saving=false;
            if(button){button.disabled=false;setSubmitAppearance()}
        }
    }

    window.addEventListener('submit',event=>{
        if(event.target!==form)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        saveMovement();
    },true);

    assignSectionIds();
    insertLoanButton();
    ensureLoanPanel();
    updateLoanButtonState();
})();
(function(){
'use strict';
const text=value=>String(value??'').trim();
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
function reservedTotal(line){
 const map=line?.stockProyectoPorAlmacen||line?.stock_proyecto_por_almacen||line?.material?.stockProyectoPorAlmacen||line?.material?.stock_proyecto_por_almacen||{};
 const values=Object.values(map).map(number);
 if(values.length)return values.reduce((sum,value)=>sum+value,0);
 return number(line?.reservado??line?.stockReservado??line?.stock_reservado);
}
function normalizePlan(){
 if(typeof planEntregaProyecto==='undefined'||!Array.isArray(planEntregaProyecto))return;
 planEntregaProyecto=planEntregaProyecto.map(line=>{
  const reserved=reservedTotal(line);
  const required=number(line?.requerido??line?.cantidadPlaneada??line?.cantidad_planeada);
  const delivered=number(line?.entregado??line?.cantidadEntregada??line?.cantidad_entregada);
  const entered=number(line?.ingresado??line?.cantidadIngresada??line?.cantidad_ingresada);
  const outside=Boolean(line?.fueraPlan||line?.fuera_plan);
  return{
   ...line,
   requerido:required,
   cantidadPlaneada:required,
   cantidad_planeada:required,
   entregado:delivered,
   cantidadEntregada:delivered,
   cantidad_entregada:delivered,
   ingresado:entered,
   reservado:reserved,
   stockReservado:reserved,
   stock_reservado:reserved,
   solicitado:required,
   fueraPlan:outside,
   fuera_plan:outside,
   pendiente:Math.max(0,required-delivered)
  };
 });
}
function addLegend(){
 const panel=document.getElementById('panel-materiales-proyecto');
 if(!panel||document.getElementById('movimiento-control-legend-v12151'))return;
 const legend=document.createElement('div');
 legend.id='movimiento-control-legend-v12151';
 legend.className='border-b border-[#243257] bg-[#090f20] px-4 py-3';
 legend.innerHTML='<div class="flex flex-wrap items-center gap-2 text-[9px]"><span class="font-bold uppercase tracking-wider text-gray-500">Control de existencia</span><span class="rounded-full border border-blue-500/25 bg-blue-950/15 px-2 py-1 text-blue-300">Solicitado: plan del proyecto</span><span class="rounded-full border border-violet-500/25 bg-violet-950/15 px-2 py-1 text-violet-300">Reservado: apartado sin entregar</span><span class="rounded-full border border-emerald-500/25 bg-emerald-950/15 px-2 py-1 text-emerald-300">Entregado: salida física al proyecto</span><span class="rounded-full border border-amber-500/25 bg-amber-950/15 px-2 py-1 text-amber-300">Fuera del plan: adicional</span><span class="rounded-full border border-[#243257] bg-[#10172a] px-2 py-1 text-gray-300">General: disponible en almacén</span></div>';
 const list=document.getElementById('lista-plan-proyecto');
 if(list)list.insertAdjacentElement('beforebegin',legend);else panel.prepend(legend);
}
function renderAfterNormalize(){
 normalizePlan();
 addLegend();
 if(typeof window.renderPlanEntregaProyecto==='function')window.renderPlanEntregaProyecto();
}
const previousLoad=window.cargarPlanEntregaProyecto;
if(typeof previousLoad==='function'){
 window.cargarPlanEntregaProyecto=async function(...args){
  const result=await previousLoad.apply(this,args);
  normalizePlan();
  return result;
 };
}
const previousProjectChange=window.manejarCambioProyecto;
if(typeof previousProjectChange==='function'){
 window.manejarCambioProyecto=async function(value){
  const result=await previousProjectChange.call(this,value);
  normalizePlan();
  if(typeof currentType!=='undefined'&&currentType==='salida'&&text(value)){
   const projectTab=document.querySelector('[data-v129-view="proyecto"],button[onclick*="cambiarVistaMaterialesV129(\'proyecto\')"]');
   projectTab?.click();
  }else if(typeof window.renderPlanEntregaProyecto==='function')window.renderPlanEntregaProyecto();
  return result;
 };
}
const previousRender=window.renderPlanEntregaProyecto;
if(typeof previousRender==='function'){
 window.renderPlanEntregaProyecto=function(){normalizePlan();addLegend();return previousRender.apply(this,arguments)};
}
window.addEventListener('skilled:movement-saved',renderAfterNormalize);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderAfterNormalize,300),{once:true});else setTimeout(renderAfterNormalize,300);
})();
(function(){
'use strict';
const params=new URLSearchParams(location.search);const type=String(params.get('tipo')||'').toLowerCase();const order=String(params.get('oc')||'').trim();const warehouse=String(params.get('almacen')||'').trim();if(!type&&!order&&!warehouse)return;let attempts=0;function apply(){attempts+=1;const orderInput=document.getElementById('orden_compra_val');const warehouseSelect=document.getElementById('bodega_destino_val');if(type==='entrada'&&typeof window.cambiarTipo==='function')window.cambiarTipo('entrada');if(orderInput)orderInput.value=order;if(warehouse&&warehouseSelect){const exists=[...warehouseSelect.options].some(option=>option.value===warehouse);if(exists){warehouseSelect.value=warehouse;if(typeof window.manejarCambioBodegaMovimiento==='function')Promise.resolve(window.manejarCambioBodegaMovimiento('destino')).catch(()=>{})}}const ready=(!order||Boolean(orderInput))&&(!warehouse||Boolean(warehouseSelect&&[...warehouseSelect.options].some(option=>option.value===warehouse)));if(!ready&&attempts<40)setTimeout(apply,150)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,250),{once:true});else setTimeout(apply,250);
})();
