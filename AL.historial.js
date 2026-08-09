(function(){
    'use strict';
    let groups=[];
    let shown=[];
    const text=v=>String(v??'').trim();
    const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
    const lower=v=>text(v).toLocaleLowerCase('es-MX');
    const html=v=>typeof escapeHTML==='function'?escapeHTML(v):text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})};
    const config={entrada:{label:'Entrada',color:'emerald',sign:'+'},salida:{label:'Salida',color:'rose',sign:'-'},ajuste:{label:'Ajuste',color:'amber',sign:'±'},traspaso:{label:'Traspaso',color:'blue',sign:'→'},reingreso:{label:'Reingreso',color:'blue',sign:'↩'},prestamo:{label:'Préstamo',color:'violet',sign:'⇄'}};
    async function load(){
        document.getElementById('historial-cargando')?.classList.remove('hidden');
        document.getElementById('historial-lista')?.classList.add('hidden');
        document.getElementById('historial-error')?.classList.add('hidden');
        try{
            groups=await SkilledDB.listMovementGroups();
            render();
        }catch(error){
            document.getElementById('historial-cargando')?.classList.add('hidden');
            const box=document.getElementById('historial-error');
            box?.classList.remove('hidden');
            box?.classList.add('flex');
            console.error(error);
        }
    }
    function matches(group,query){
        if(!query)return true;
        return[
            group.requestId,group.referencia,group.proyecto,group.bodegaOrigen,group.bodegaDestino,group.recibeNombre,group.motivo,
            ...group.productos.flatMap(item=>[item.codigo,item.descripcion,item.producto?.desc])
        ].some(value=>lower(value).includes(query));
    }
    function render(){
        const query=lower(document.getElementById('historial_search')?.value);
        const type=lower(document.getElementById('historial_tipo')?.value);
        const warehouse=lower(document.getElementById('historial_bodega')?.value);
        const filtered=groups.filter(group=>(!type||group.tipo===type)&&(!warehouse||lower(group.bodegaOrigen)===warehouse||lower(group.bodegaDestino)===warehouse)&&matches(group,query));
        shown=filtered;
        const loading=document.getElementById('historial-cargando');
        const empty=document.getElementById('historial-vacio');
        const list=document.getElementById('historial-lista');
        loading?.classList.add('hidden');
        if(!filtered.length){empty?.classList.remove('hidden');empty?.classList.add('flex');list?.classList.add('hidden');return}
        empty?.classList.add('hidden');empty?.classList.remove('flex');list?.classList.remove('hidden');
        list.innerHTML=filtered.map((group,index)=>{
            const cfg=config[group.tipo]||config.entrada;
            const total=group.productos.reduce((sum,item)=>sum+number(item.cantidad),0);
            const ref=group.referencia||group.folioEntrega||group.requestId;
            const detail=group.productos.map(item=>`<div class="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-t border-[#161f38]"><div><p class="text-xs font-semibold text-white">${html(item.descripcion||item.producto?.desc||item.codigo)}</p><p class="text-[9px] text-gray-500 font-mono mt-0.5">${html(item.codigo)}</p><div class="flex flex-wrap gap-1 mt-1.5">${item.alcance&&item.alcance!=='sin_plan'?`<span class="text-[8px] px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-300">${item.alcance==='dentro_plan'?'Dentro del plan':item.alcance==='mixto'?'Plan + extra':'Fuera del plan'}</span>`:''}${item.stockFuente?`<span class="text-[8px] px-1.5 py-0.5 rounded border border-violet-500/20 text-violet-300">${html(item.stockFuente)}</span>`:''}</div></div><div class="text-right"><p class="text-sm font-bold text-${cfg.color}-300">${number(item.cantidad)} ${html(item.unidad||'')}</p></div></div>`).join('');
            const ticket=`<button type="button" onclick="verTicketGrupoV129(${index})" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-950/20 text-[10px] font-semibold text-blue-300 hover:text-white whitespace-nowrap"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18h12v4H6v-4z"/><path d="M6 14H4a2 2 0 01-2-2v-2a2 2 0 012-2h16a2 2 0 012 2v2a2 2 0 01-2 2h-2"/></svg>Ver ticket</button>`;
            return`<div class="bg-[#090d1a]"><button type="button" onclick="toggleGrupoV129(${index})" class="w-full px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 text-left hover:bg-[#0d1425] transition"><div class="w-10 h-10 rounded-xl border border-${cfg.color}-500/30 bg-${cfg.color}-950/20 text-${cfg.color}-300 flex items-center justify-center font-bold">${cfg.sign}</div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="text-xs font-bold text-white">${cfg.label}</span><span class="text-[9px] px-2 py-0.5 rounded-full border border-[#243257] text-gray-400">${group.productos.length} materiales</span><span class="text-[9px] px-2 py-0.5 rounded-full border border-[#243257] text-gray-400">${total} unidades</span></div><p class="text-[10px] text-gray-500 mt-1">${date(group.fecha)} · ${html(ref||'Sin referencia')}</p><p class="text-[10px] text-gray-500 mt-0.5">${group.proyecto?`Proyecto ${html(group.proyecto)} · `:''}${html(group.bodegaOrigen||group.bodegaDestino||'Sin almacén')}</p></div><div class="flex items-center gap-2" onclick="event.stopPropagation()">${ticket}<span class="text-gray-500">⌄</span></div></button><div id="grupo-v129-${index}" class="hidden bg-[#060a14]">${detail}</div></div>`;
        }).join('');
    }
    window.toggleGrupoV129=function(index){document.getElementById(`grupo-v129-${index}`)?.classList.toggle('hidden')};
    window.verTicketGrupoV129=function(index){
        const group=shown[index];
        if(!group||!window.SkilledTickets)return;
        const titles={
            entrada:'Comprobante de entrada de material',
            salida:'Comprobante de salida de material',
            ajuste:'Comprobante de ajuste de inventario',
            traspaso:'Comprobante de traspaso de material',
            reingreso:'Comprobante de reingreso de material',
            prestamo:'Comprobante de préstamo de material'
        };
        SkilledTickets.mostrarListo({
            titulo:titles[group.tipo]||'Comprobante de movimiento de material',
            modalTitulo:'Ticket del movimiento',
            modalDescripcion:'Selecciona el formato para consultar o imprimir este movimiento.',
            desdeHistorial:true,
            tipo:group.tipo,
            folio:group.referencia||group.folioEntrega||group.requestId,
            requestId:group.requestId,
            referencia:group.referencia,
            ordenCompra:group.ordenCompra,
            fechaOrdenCompra:group.fechaOrdenCompra,
            fecha:group.fecha,
            proyecto:group.proyecto,
            bodegaOrigen:group.bodegaOrigen,
            bodegaDestino:group.bodegaDestino,
            ubicacion:group.ubicacion,
            ubicacionOrigen:group.ubicacionOrigen,
            ubicacionDestino:group.ubicacionDestino,
            recibeNombre:group.recibeNombre,
            recibeTipo:group.recibeTipo,
            notas:group.motivo,
            productos:group.productos
        });
    };
    window.reimprimirGrupoV129=window.verTicketGrupoV129;
    window.renderHistorial=render;
    window.cargarHistorial=load;
    setTimeout(load,100);
})();
