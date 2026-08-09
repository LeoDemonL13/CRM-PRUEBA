(function(){
    'use strict';
    const text=value=>String(value??'').trim();
    const lower=value=>text(value).toLocaleLowerCase('es-MX');
    const html=value=>text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    let scanner=null;
    let active=false;
    let last='';
    let lastAt=0;
    let currentTicket=null;

    function parse(value){
        const raw=text(value);
        if(!raw)return{type:'empty',value:''};
        try{
            const data=JSON.parse(raw);
            const type=lower(data.tipo||data.type||data.entidad||data.entity);
            const id=text(data.valor||data.value||data.codigo||data.code||data.id||data.folio);
            if(type&&id)return{type,value:id,raw};
        }catch(error){}
        const match=raw.match(/^SKILLED\|([^|]+)\|(.+)$/i);
        if(match)return{type:lower(match[1]),value:text(match[2]),raw};
        if(/^MAT:/i.test(raw))return{type:'material',value:raw.slice(4).trim(),raw};
        if(/^CAT:/i.test(raw))return{type:'categoria',value:raw.slice(4).trim(),raw};
        return{type:'auto',value:raw,raw};
    }

    function setStatus(message,type='info'){
        const node=document.getElementById('scanner-status');
        const colors={info:'text-gray-400',ok:'text-emerald-400',error:'text-rose-400',warn:'text-amber-400'};
        node.className=`text-xs ${colors[type]||colors.info}`;
        node.textContent=message;
    }

    function card(title,subtitle,body,actions=''){
        document.getElementById('scanner-result').innerHTML=`<div class="rounded-2xl border border-[#243257] bg-[#0d1425] overflow-hidden"><div class="px-5 py-4 border-b border-[#243257]"><p class="text-sm font-bold text-white">${html(title)}</p><p class="mt-1 text-[11px] text-gray-500">${html(subtitle)}</p></div><div class="p-5">${body}</div>${actions?`<div class="px-5 py-4 border-t border-[#243257] flex flex-wrap justify-end gap-2">${actions}</div>`:''}</div>`;
    }

    async function queryTicket(value){
        const fields=['request_id','referencia','folio_entrega'];
        for(const field of fields){
            const {data,error}=await SkilledDB.client.from('movimientos').select('*').eq(field,value).order('fecha',{ascending:true});
            if(error)throw error;
            if(data?.length)return data;
        }
        return[];
    }

    async function showTicket(value){
        const rows=await queryTicket(value);
        if(!rows.length)return false;
        const first=rows[0];
        currentTicket={
            titulo:`Comprobante de ${text(first.tipo)||'movimiento'} de material`,
            modalTitulo:'Ticket encontrado',
            modalDescripcion:'Selecciona el formato para consultarlo o imprimirlo.',
            desdeHistorial:true,
            tipo:first.tipo,
            folio:first.referencia||first.folio_entrega||first.request_id,
            requestId:first.request_id,
            referencia:first.referencia,
            ordenCompra:first.orden_compra,
            fechaOrdenCompra:first.fecha_orden_compra,
            fecha:first.fecha,
            proyecto:first.proyecto,
            bodegaOrigen:first.bodega_origen,
            bodegaDestino:first.bodega_destino,
            ubicacion:first.ubicacion,
            ubicacionOrigen:first.ubicacion_origen,
            ubicacionDestino:first.ubicacion_destino,
            recibeNombre:first.recibe_nombre,
            recibeTipo:first.recibe_tipo,
            notas:first.motivo,
            productos:rows.map(row=>({producto:{codigo:row.material_codigo||row.codigo_manual,descripcion:row.descripcion,desc:row.descripcion,unidad:row.unidad},cantidad:Number(row.cantidad)||0}))
        };
        const products=rows.map(row=>`<tr class="border-b border-[#1b2642]"><td class="py-2 pr-3 font-mono text-[10px] text-blue-300">${html(row.material_codigo||row.codigo_manual)}</td><td class="py-2 pr-3 text-xs text-gray-200">${html(row.descripcion)}</td><td class="py-2 text-right text-xs font-bold">${html(row.cantidad)} ${html(row.unidad)}</td></tr>`).join('');
        const body=`<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Tipo</p><p class="mt-1 text-xs font-bold text-white">${html(first.tipo)}</p></div><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Proyecto</p><p class="mt-1 text-xs font-bold text-white">${html(first.proyecto||'Sin proyecto')}</p></div><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Fecha</p><p class="mt-1 text-xs font-bold text-white">${html(new Date(first.fecha).toLocaleString('es-MX'))}</p></div></div><div class="overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-[9px] uppercase text-gray-500 border-b border-[#243257]"><th class="pb-2">Código</th><th class="pb-2">Material</th><th class="pb-2 text-right">Cantidad</th></tr></thead><tbody>${products}</tbody></table></div>`;
        const actions=`<button type="button" onclick="imprimirTicketEscaneado('carta')" class="px-4 py-2.5 rounded-lg border border-[#243257] bg-[#10172a] text-xs font-semibold text-gray-200">Tamaño carta</button><button type="button" onclick="imprimirTicketEscaneado('58mm')" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Ticket 58 mm</button>`;
        card('Movimiento encontrado',first.referencia||first.folio_entrega||first.request_id,body,actions);
        return true;
    }

    async function showMaterial(value){
        const {data,error}=await SkilledDB.client.from('materiales').select('*').eq('codigo',value).maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const materials=await SkilledDB.listMaterials();
        const material=materials.find(item=>lower(item.codigo)===lower(value))||data;
        const warehouses=(material.almacenes||[]).map(row=>`<div class="flex justify-between gap-3 py-2 border-b border-[#1b2642]"><span class="text-xs text-gray-300">${html(row.nombre)}</span><span class="text-xs font-bold ${Number(row.stock)>0?'text-emerald-300':'text-rose-300'}">${html(row.stock)} ${html(material.unidad)}</span></div>`).join('');
        const body=`<div class="flex items-start gap-4"><div class="w-20 h-20 rounded-xl bg-white border border-[#243257] overflow-hidden flex items-center justify-center">${material.imagen?`<img src="${html(material.imagen)}" class="w-full h-full object-contain">`:'<span class="text-gray-600 text-3xl">□</span>'}</div><div class="min-w-0"><p class="font-mono text-xs text-blue-300">${html(material.codigo)}</p><p class="mt-1 text-base font-bold text-white">${html(material.descripcion||material.desc)}</p><p class="mt-1 text-xs text-gray-500">${html(material.categoria)} · ${html(material.unidad)}</p><p class="mt-3 text-sm font-bold text-emerald-300">Stock total: ${html(material.stock)} ${html(material.unidad)}</p></div></div><div class="mt-5">${warehouses||'<p class="text-xs text-gray-500">Sin existencias por almacén.</p>'}</div>`;
        card('Material encontrado',material.codigo,body,`<a href="AL.catalogo.html?buscar=${encodeURIComponent(material.codigo)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir catálogo</a>`);
        return true;
    }

    async function showLocation(value){
        let query=SkilledDB.client.from('ubicaciones_almacen').select('*');
        if(/^\d+$/.test(value))query=query.eq('id',Number(value));
        else query=query.eq('codigo',value);
        const {data,error}=await query.maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const warehouses=await SkilledDB.listWarehouses();
        const warehouse=warehouses.find(row=>Number(row.id)===Number(data.almacen_id));
        const body=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div class="rounded-xl border border-[#243257] bg-[#060a14] p-4"><p class="text-[9px] uppercase text-gray-500">Ubicación</p><p class="mt-1 text-base font-bold text-white">${html(data.nombre)}</p><p class="mt-1 font-mono text-xs text-blue-300">${html(data.codigo||data.id)}</p></div><div class="rounded-xl border border-[#243257] bg-[#060a14] p-4"><p class="text-[9px] uppercase text-gray-500">Almacén</p><p class="mt-1 text-base font-bold text-white">${html(warehouse?.nombre||'Sin almacén')}</p><p class="mt-1 text-xs text-gray-500">${html(data.tipo)} · Consecutivos 1–${html(data.columnas)}</p></div></div>${data.nota?`<p class="mt-4 text-xs text-gray-300">${html(data.nota)}</p>`:''}`;
        card('Ubicación encontrada',data.codigo||String(data.id),body,`<a href="AL.almacenes.html" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir almacenes</a>`);
        return true;
    }

    async function showProject(value){
        const projects=await SkilledDB.listProjects();
        const project=projects.find(row=>lower(row.proyecto)===lower(value));
        if(!project)return false;
        const body=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${[['Nombre',project.nombre],['Cliente',project.cliente],['Orden de compra',project.ordenCompra],['Responsable',project.responsableSkilled],['Planta',project.planta],['Nave',project.nave]].map(([label,val])=>`<div class="rounded-xl border border-[#243257] bg-[#060a14] p-3"><p class="text-[9px] uppercase text-gray-500">${html(label)}</p><p class="mt-1 text-xs font-bold text-white">${html(val||'—')}</p></div>`).join('')}</div>`;
        card('Proyecto encontrado',project.proyecto,body,`<a href="AL.proyectos.html?proyecto=${encodeURIComponent(project.proyecto)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir proyecto</a>`);
        return true;
    }

    async function showCategory(value){
        const {data,error}=await SkilledDB.client.from('categorias_materiales').select('*').ilike('nombre',value).maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const materials=await SkilledDB.listMaterials();
        const count=materials.filter(row=>lower(row.categoria)===lower(data.nombre)).length;
        const body=`<div class="flex items-start gap-4"><div class="w-28 h-20 rounded-xl bg-white border border-[#243257] overflow-hidden flex items-center justify-center">${data.imagen_url?`<img src="${html(data.imagen_url)}" class="w-full h-full object-cover">`:'<span class="text-gray-600 text-3xl">□</span>'}</div><div><p class="text-lg font-bold text-white">${html(data.nombre)}</p><p class="mt-1 text-xs text-gray-500">${html(data.descripcion||'Sin descripción')}</p><p class="mt-3 text-sm font-bold text-blue-300">${count} materiales</p></div></div>`;
        card('Categoría encontrada',data.nombre,body,`<a href="AL.catalogo.html?categoria=${encodeURIComponent(data.nombre)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir categoría</a>`);
        return true;
    }

    async function resolve(value){
        const now=Date.now();
        if(text(value)===last&&now-lastAt<1000)return;
        last=text(value);
        lastAt=now;
        const parsed=parse(value);
        if(parsed.type==='empty')return;
        setStatus('Consultando Supabase…');
        document.getElementById('scanner-code').value=parsed.raw;
        try{
            let found=false;
            if(['ticket','movimiento','entrada','salida','ajuste','traspaso','reingreso'].includes(parsed.type))found=await showTicket(parsed.value);
            else if(['material','producto'].includes(parsed.type))found=await showMaterial(parsed.value);
            else if(['ubicacion','ubicación','location'].includes(parsed.type))found=await showLocation(parsed.value);
            else if(['proyecto','project'].includes(parsed.type))found=await showProject(parsed.value);
            else if(['categoria','categoría','category'].includes(parsed.type))found=await showCategory(parsed.value);
            else{
                found=await showTicket(parsed.value);
                if(!found)found=await showMaterial(parsed.value);
                if(!found)found=await showLocation(parsed.value);
                if(!found)found=await showProject(parsed.value);
                if(!found)found=await showCategory(parsed.value);
            }
            if(!found){
                currentTicket=null;
                card('Código no encontrado',parsed.value,'<p class="text-sm text-gray-400">No coincide con un ticket, material, ubicación, proyecto o categoría registrada.</p>');
                setStatus('No se encontró información para el código leído.','error');
                return;
            }
            setStatus('Código leído correctamente.','ok');
        }catch(error){
            currentTicket=null;
            card('Error al consultar',parsed.value,`<p class="text-sm text-rose-300">${html(error.message||error)}</p>`);
            setStatus('Ocurrió un error durante la consulta.','error');
        }
    }

    window.imprimirTicketEscaneado=function(format){
        if(!currentTicket||!window.SkilledTickets)return;
        SkilledTickets.imprimir(currentTicket,format);
    };

    window.iniciarScannerUniversal=async function(){
        if(active)return;
        if(!window.isSecureContext&&!['localhost','127.0.0.1'].includes(location.hostname)){
            setStatus('La cámara requiere HTTPS. Usa el lector físico mientras publicas el CRM.','warn');
            return;
        }
        if(typeof Html5Qrcode!=='function'){
            setStatus('No se cargó la librería de escaneo.','error');
            return;
        }
        try{
            scanner=scanner||new Html5Qrcode('universal-reader');
            await scanner.start({facingMode:'environment'},{fps:12,qrbox:(w,h)=>({width:Math.min(w*.82,360),height:Math.min(h*.52,240)}),aspectRatio:1.333},code=>resolve(code),()=>{});
            active=true;
            document.getElementById('btn-start-scanner').textContent='Cámara activa';
            setStatus('Cámara activa. Centra el código dentro del recuadro.','ok');
        }catch(error){
            setStatus(`No se pudo abrir la cámara: ${error.message||error}`,'error');
        }
    };

    window.detenerScannerUniversal=async function(){
        if(scanner&&active){
            try{await scanner.stop()}catch(error){}
        }
        active=false;
        document.getElementById('btn-start-scanner').textContent='Iniciar cámara';
        setStatus('Cámara detenida.');
    };

    window.procesarScannerManual=function(event){
        if(event&&event.key!=='Enter')return;
        event?.preventDefault();
        const input=document.getElementById('scanner-code');
        const value=text(input.value);
        if(value)resolve(value);
    };

    window.addEventListener('beforeunload',()=>{if(scanner&&active)scanner.stop().catch(()=>{})});
    const params=new URLSearchParams(location.search);
    if(params.get('codigo'))setTimeout(()=>resolve(params.get('codigo')),400);
})();