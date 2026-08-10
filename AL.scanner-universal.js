(function(){
    'use strict';
    const text=value=>String(value??'').trim();
    const lower=value=>text(value).toLocaleLowerCase('es-MX');
    const html=value=>text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    const $=id=>document.getElementById(id);
    let scanner=null;
    let active=false;
    let last='';
    let lastAt=0;
    let currentTicket=null;
    let recent=[];
    let scannerLibraryPromise=null;
    let warehouseCache={at:0,rows:[]};
    let wedgeBuffer='';
    let wedgeLastAt=0;

    function loadScannerLibrary(){
        if(typeof Html5Qrcode==='function')return Promise.resolve(true);
        if(scannerLibraryPromise)return scannerLibraryPromise;
        scannerLibraryPromise=new Promise((resolve,reject)=>{
            const existing=document.querySelector('script[data-html5-qrcode]');
            if(existing){existing.addEventListener('load',()=>resolve(typeof Html5Qrcode==='function'),{once:true});existing.addEventListener('error',()=>reject(new Error('No se pudo cargar el lector de cámara.')),{once:true});return}
            const script=document.createElement('script');
            script.src='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.async=true;
            script.dataset.html5Qrcode='1';
            script.onload=()=>typeof Html5Qrcode==='function'?resolve(true):reject(new Error('El lector de cámara no quedó disponible.'));
            script.onerror=()=>reject(new Error('No se pudo descargar el lector de cámara. Puedes usar el lector USB.'));
            document.head.appendChild(script);
        });
        return scannerLibraryPromise;
    }

    async function cachedWarehouses(){
        if(warehouseCache.rows.length&&Date.now()-warehouseCache.at<120000)return warehouseCache.rows;
        const rows=await SkilledDB.listWarehouses();
        warehouseCache={at:Date.now(),rows:Array.isArray(rows)?rows:[]};
        return warehouseCache.rows;
    }

    function parse(value){
        const raw=text(value);
        if(!raw)return{type:'empty',value:'',raw:''};
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
        if(/^(POS|UBI):/i.test(raw))return{type:'posicion',value:raw.replace(/^(POS|UBI):/i,'').trim(),raw};
        if(/^PROY:/i.test(raw))return{type:'proyecto',value:raw.slice(5).trim(),raw};
        if(/^(TKT|TICKET):/i.test(raw))return{type:'ticket',value:raw.replace(/^(TKT|TICKET):/i,'').trim(),raw};
        if(/^(0[1-9]|1[0-9]|20)-([1-9]\d*)-([A-Z])([1-9]\d*)$/i.test(raw))return{type:'posicion',value:raw.toUpperCase(),raw};
        return{type:'auto',value:raw,raw};
    }

    function setStatus(message,type='info'){
        const node=$('scanner-status');
        const dot=$('scanner-status-dot');
        const stateDot=$('scanner-state-dot');
        const mode=$('scanner-mode-state');
        const colors={info:'text-gray-400',ok:'text-emerald-400',error:'text-rose-400',warn:'text-amber-400'};
        const dots={info:'bg-gray-500',ok:'bg-emerald-400',error:'bg-rose-400',warn:'bg-amber-400'};
        if(node){node.className=`text-xs leading-relaxed ${colors[type]||colors.info}`;node.textContent=message}
        if(dot)dot.className=`mt-1 w-2 h-2 rounded-full shrink-0 ${dots[type]||dots.info}`;
        if(stateDot)stateDot.className=`w-2 h-2 rounded-full ${active?'bg-emerald-400':dots[type]||dots.info}`;
        if(mode)mode.textContent=active?'Cámara activa':type==='error'?'Revisar':type==='warn'?'Atención':'En espera';
    }

    function setCameraState(isActive){
        active=Boolean(isActive);
        const start=$('btn-start-scanner');
        const stop=$('btn-stop-scanner');
        const idle=$('scanner-idle');
        if(start){start.disabled=active;start.textContent=active?'Cámara activa':'Iniciar cámara'}
        if(stop)stop.disabled=!active;
        if(idle)idle.classList.toggle('hidden',active);
        const stateDot=$('scanner-state-dot');
        const mode=$('scanner-mode-state');
        if(stateDot)stateDot.className=`w-2 h-2 rounded-full ${active?'bg-emerald-400':'bg-gray-500'}`;
        if(mode)mode.textContent=active?'Cámara activa':'En espera';
    }

    function card(title,subtitle,body,actions=''){
        const target=$('scanner-result');
        if(!target)return;
        target.className='min-h-[455px] p-5 block';
        target.innerHTML=`<div class="rounded-2xl border border-[#243257] bg-[#0d1425] overflow-hidden"><div class="px-5 py-4 border-b border-[#243257] flex items-start justify-between gap-4"><div><p class="text-sm font-bold text-white">${html(title)}</p><p class="mt-1 text-[11px] text-gray-500 break-all">${html(subtitle)}</p></div><span class="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[9px] font-bold text-emerald-300"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>LEÍDO</span></div><div class="p-5">${body}</div>${actions?`<div class="px-5 py-4 border-t border-[#243257] flex flex-wrap justify-end gap-2">${actions}</div>`:''}</div>`;
    }

    function renderHistory(){
        const target=$('scanner-history');
        if(!target)return;
        if(!recent.length){
            target.innerHTML='<p class="py-5 text-center text-xs text-gray-600">Todavía no hay lecturas recientes.</p>';
            return;
        }
        target.innerHTML=`<div class="space-y-2">${recent.map((item,index)=>`<button type="button" onclick="consultarScannerReciente(${index})" class="w-full text-left rounded-xl border border-[#1d2949] bg-[#0a1122] px-3.5 py-3 hover:border-blue-500/40 hover:bg-[#0d1629] transition"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded-md border border-[#243257] text-[8px] font-bold uppercase tracking-wide text-blue-300">${html(item.kind)}</span><span class="text-[9px] text-gray-600">${html(item.time)}</span></div><p class="mt-2 font-mono text-[10px] text-gray-300 truncate">${html(item.raw)}</p></div><svg class="w-4 h-4 text-gray-600 shrink-0 mt-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></button>`).join('')}</div>`;
    }

    function remember(raw,kind){
        const code=text(raw);
        if(!code)return;
        recent=recent.filter(item=>item.raw!==code);
        recent.unshift({raw:code,kind:kind||'Código',time:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})});
        recent=recent.slice(0,8);
        renderHistory();
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
        const body=`<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Tipo</p><p class="mt-1 text-xs font-bold text-white">${html(first.tipo)}</p></div><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Proyecto</p><p class="mt-1 text-xs font-bold text-white">${html(first.proyecto||'Sin proyecto')}</p></div><div class="rounded-xl bg-[#060a14] border border-[#1b2642] p-3"><p class="text-[9px] uppercase text-gray-500">Fecha</p><p class="mt-1 text-xs font-bold text-white">${html(first.fecha?new Date(first.fecha).toLocaleString('es-MX'):'—')}</p></div></div><div class="overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-[9px] uppercase text-gray-500 border-b border-[#243257]"><th class="pb-2">Código</th><th class="pb-2">Material</th><th class="pb-2 text-right">Cantidad</th></tr></thead><tbody>${products}</tbody></table></div>`;
        const actions=`<button type="button" onclick="imprimirTicketEscaneado('carta')" class="px-4 py-2.5 rounded-lg border border-[#243257] bg-[#10172a] text-xs font-semibold text-gray-200">Tamaño carta</button><button type="button" onclick="imprimirTicketEscaneado('58mm')" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Ticket 58 mm</button>`;
        card('Movimiento encontrado',first.referencia||first.folio_entrega||first.request_id,body,actions);
        return true;
    }

    async function showMaterial(value){
        const code=text(value);
        const [{data,error},{data:inventory,error:inventoryError},warehouses]=await Promise.all([
            SkilledDB.client.from('materiales').select('*').eq('codigo',code).maybeSingle(),
            SkilledDB.client.from('existencias_almacen').select('almacen_id,stock,ubicacion,stock_minimo,stock_medio,stock_maximo').eq('material_codigo',code),
            cachedWarehouses()
        ]);
        if(error)throw error;
        if(inventoryError)throw inventoryError;
        if(!data)return false;
        const warehouseById=new Map(warehouses.map(row=>[Number(row.id),row]));
        const rows=(inventory||[]).map(row=>({nombre:warehouseById.get(Number(row.almacen_id))?.nombre||`Almacén ${row.almacen_id}`,stock:Number(row.stock)||0,ubicacion:text(row.ubicacion)}));
        const total=rows.reduce((sum,row)=>sum+row.stock,0);
        const unit=text(data.unidad)||'unidades';
        const description=text(data.descripcion||data.desc||data.codigo);
        const image=text(data.imagen_url||data.imagen);
        const warehouseRows=rows.map(row=>`<div class="flex items-center justify-between gap-3 py-2.5 border-b border-[#1b2642]"><div class="min-w-0"><span class="text-xs text-gray-300">${html(row.nombre)}</span>${row.ubicacion?`<p class="mt-1 font-mono text-[9px] text-blue-300">${html(row.ubicacion)}</p>`:''}</div><span class="text-xs font-bold whitespace-nowrap ${row.stock>0?'text-emerald-300':'text-rose-300'}">${row.stock.toLocaleString('es-MX')} ${html(unit)}</span></div>`).join('');
        const body=`<div class="flex items-start gap-4"><div class="w-20 h-20 rounded-xl bg-white border border-[#243257] overflow-hidden flex items-center justify-center shrink-0">${image?`<img src="${html(image)}" loading="lazy" decoding="async" class="w-full h-full object-contain">`:'<span class="text-gray-600 text-3xl">□</span>'}</div><div class="min-w-0"><p class="font-mono text-xs text-blue-300 break-all">${html(data.codigo)}</p><p class="mt-1 text-base font-bold text-white">${html(description)}</p><p class="mt-1 text-xs text-gray-500">${html(data.categoria)} · ${html(unit)}</p><p class="mt-3 text-sm font-bold text-emerald-300">Stock total: ${total.toLocaleString('es-MX')} ${html(unit)}</p></div></div><div class="mt-5">${warehouseRows||'<p class="text-xs text-gray-500">Sin existencias por almacén.</p>'}</div>`;
        card('Material encontrado',data.codigo,body,`<a href="AL.catalogo.html?buscar=${encodeURIComponent(data.codigo)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir catálogo</a>`);
        return true;
    }

    async function showLocation(value){
        const raw=text(value).toUpperCase();
        const positionMatch=raw.match(/^(0[1-9]|1[0-9]|20)-([1-9]\d*)-([A-Z])([1-9]\d*)$/);
        const baseCode=positionMatch?`${positionMatch[1]}-${Number(positionMatch[2])}-${positionMatch[3]}`:raw;
        let query=SkilledDB.client.from('ubicaciones_almacen').select('*');
        if(/^\d+$/.test(raw))query=query.eq('id',Number(raw));
        else query=query.eq('codigo',baseCode);
        const {data,error}=await query.maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const warehouses=await cachedWarehouses();
        const warehouse=warehouses.find(row=>Number(row.id)===Number(data.almacen_id));
        let materials=[];
        if(positionMatch){
            const {data:inventory,error:inventoryError}=await SkilledDB.client.from('existencias_almacen').select('material_codigo,stock,ubicacion').eq('almacen_id',Number(data.almacen_id)).eq('ubicacion',raw);
            if(inventoryError)throw inventoryError;
            const codes=(inventory||[]).map(row=>text(row.material_codigo)).filter(Boolean);
            let materialRows=[];
            if(codes.length){
                const result=await SkilledDB.client.from('materiales').select('codigo,descripcion,unidad').in('codigo',codes);
                if(result.error)throw result.error;
                materialRows=result.data||[];
            }
            const byCode=new Map(materialRows.map(row=>[lower(row.codigo),row]));
            materials=(inventory||[]).map(row=>{const material=byCode.get(lower(row.material_codigo))||{};return{codigo:text(row.material_codigo),descripcion:text(material.descripcion||row.material_codigo),unidad:text(material.unidad),stock:Number(row.stock)||0}}).sort((a,b)=>a.descripcion.localeCompare(b.descripcion,'es'));
        }
        const filled=Math.min(materials.length,7);
        const materialRows=positionMatch?(materials.length?`<div class="mt-4 rounded-xl border border-[#243257] overflow-hidden"><div class="px-4 py-3 border-b border-[#243257] flex items-center justify-between gap-3"><div><p class="text-xs font-bold text-white">Contenido del cajón</p><p class="mt-1 text-[9px] text-gray-500">${materials.length===1?'1 tipo de material':`${materials.length} tipos de material`} en esta posición.</p></div><span class="text-[9px] font-bold ${filled>=7?'text-amber-300':'text-blue-300'}">${filled}/7 tipos</span></div><div class="divide-y divide-[#1b2642]">${materials.map((item,index)=>`<div class="px-4 py-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="flex items-center gap-2"><span class="w-5 h-5 rounded-md bg-[#111b31] border border-[#243257] text-[8px] text-gray-400 flex items-center justify-center shrink-0">${index+1}</span><p class="font-mono text-[9px] text-blue-300 truncate">${html(item.codigo)}</p></div><p class="mt-1.5 text-xs font-semibold text-white">${html(item.descripcion||item.codigo)}</p></div><span class="text-[9px] text-gray-400 whitespace-nowrap">${item.stock.toLocaleString('es-MX')} ${html(item.unidad||'')}</span></div></div>`).join('')}</div></div>`:`<div class="mt-4 rounded-xl border border-dashed border-[#243257] p-6 text-center"><p class="text-xs font-semibold text-gray-400">Cajón disponible</p><p class="mt-1 text-[10px] text-gray-600">No hay materiales asignados a esta posición.</p></div>`):'';
        const shownCode=positionMatch?raw:(data.codigo||data.id);
        const body=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div class="rounded-xl border border-[#243257] bg-[#060a14] p-4"><p class="text-[9px] uppercase text-gray-500">${positionMatch?'Posición':'Ubicación'}</p><p class="mt-1 text-base font-bold text-white">${html(positionMatch?`Cajón ${shownCode}`:data.nombre)}</p><p class="mt-1 font-mono text-xs text-blue-300">${html(shownCode)}</p></div><div class="rounded-xl border border-[#243257] bg-[#060a14] p-4"><p class="text-[9px] uppercase text-gray-500">Almacén</p><p class="mt-1 text-base font-bold text-white">${html(warehouse?.nombre||'Sin almacén')}</p><p class="mt-1 text-xs text-gray-500">${positionMatch?`${materials.length} tipo${materials.length===1?'':'s'} de material`:`${html(data.tipo)} · Posiciones 1–${html(data.columnas)}`}</p></div></div>${materialRows}${data.nota?`<p class="mt-4 text-xs text-gray-300">${html(data.nota)}</p>`:''}`;
        card(positionMatch?'Posición encontrada':'Ubicación encontrada',shownCode,body,`<a href="AL.almacenes.html" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir almacenes</a>`);
        return true;
    }

    async function showProject(value){
        const {data,error}=await SkilledDB.client.from('proyectos').select('*').eq('numero_proyecto',text(value)).maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const project={proyecto:text(data.numero_proyecto),nombre:text(data.nombre_proyecto),cliente:text(data.cliente),ordenCompra:text(data.orden_compra),responsableSkilled:text(data.responsable_skilled),planta:text(data.planta),nave:text(data.nave)};
        const body=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${[['Nombre',project.nombre],['Cliente',project.cliente],['Orden de compra',project.ordenCompra],['Responsable',project.responsableSkilled],['Planta',project.planta],['Nave',project.nave]].map(([label,val])=>`<div class="rounded-xl border border-[#243257] bg-[#060a14] p-3"><p class="text-[9px] uppercase text-gray-500">${html(label)}</p><p class="mt-1 text-xs font-bold text-white">${html(val||'—')}</p></div>`).join('')}</div>`;
        card('Proyecto encontrado',project.proyecto,body,`<a href="AL.proyectos.html?proyecto=${encodeURIComponent(project.proyecto)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir proyecto</a>`);
        return true;
    }

    async function showCategory(value){
        const {data,error}=await SkilledDB.client.from('categorias_materiales').select('*').ilike('nombre',value).maybeSingle();
        if(error)throw error;
        if(!data)return false;
        const countResult=await SkilledDB.client.from('materiales').select('codigo',{count:'exact',head:true}).eq('categoria',data.nombre);
        if(countResult.error)throw countResult.error;
        const count=Number(countResult.count)||0;
        const body=`<div class="flex items-start gap-4"><div class="w-28 h-20 rounded-xl bg-white border border-[#243257] overflow-hidden flex items-center justify-center shrink-0">${data.imagen_url?`<img src="${html(data.imagen_url)}" loading="lazy" decoding="async" class="w-full h-full object-cover">`:'<span class="text-gray-600 text-3xl">□</span>'}</div><div><p class="text-lg font-bold text-white">${html(data.nombre)}</p><p class="mt-1 text-xs text-gray-500">${html(data.descripcion||'Sin descripción')}</p><p class="mt-3 text-sm font-bold text-blue-300">${count} materiales</p></div></div>`;
        card('Categoría encontrada',data.nombre,body,`<a href="AL.catalogo.html?categoria=${encodeURIComponent(data.nombre)}" class="px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white">Abrir categoría</a>`);
        return true;
    }

    async function resolve(value){
        const now=Date.now();
        if(text(value)===last&&now-lastAt<900)return;
        last=text(value);
        lastAt=now;
        const parsed=parse(value);
        if(parsed.type==='empty')return;
        setStatus('Consultando información…');
        const input=$('scanner-code');
        if(input)input.value=parsed.raw;
        try{
            let found=false;
            let kind='Código';
            if(['ticket','movimiento','entrada','salida','ajuste','traspaso','reingreso'].includes(parsed.type)){found=await showTicket(parsed.value);kind='Ticket'}
            else if(['material','producto'].includes(parsed.type)){found=await showMaterial(parsed.value);kind='Material'}
            else if(['ubicacion','ubicación','location','posicion','posición'].includes(parsed.type)){found=await showLocation(parsed.value);kind='Posición'}
            else if(['proyecto','project'].includes(parsed.type)){found=await showProject(parsed.value);kind='Proyecto'}
            else if(['categoria','categoría','category'].includes(parsed.type)){found=await showCategory(parsed.value);kind='Categoría'}
            else{
                found=await showMaterial(parsed.value);
                if(found)kind='Material';
                if(!found){found=await showLocation(parsed.value);if(found)kind='Posición'}
                if(!found){found=await showProject(parsed.value);if(found)kind='Proyecto'}
                if(!found){found=await showCategory(parsed.value);if(found)kind='Categoría'}
                if(!found){found=await showTicket(parsed.value);if(found)kind='Ticket'}
            }
            if(!found){
                currentTicket=null;
                card('Código no encontrado',parsed.value,'<div class="rounded-xl border border-dashed border-[#243257] p-6 text-center"><p class="text-sm font-semibold text-gray-300">Sin coincidencias</p><p class="mt-2 text-xs text-gray-500 leading-relaxed">No coincide con un ticket, material, posición, proyecto o categoría registrada.</p></div>');
                setStatus('No se encontró información para el código leído.','error');
                remember(parsed.raw,'Sin coincidencia');
                return;
            }
            remember(parsed.raw,kind);
            setStatus(`${kind} identificado correctamente.`,'ok');
            if(input&&matchMedia('(pointer:fine)').matches){input.focus({preventScroll:true});input.select?.()}
        }catch(error){
            currentTicket=null;
            card('Error al consultar',parsed.value,`<div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><p class="text-sm text-rose-300">${html(error.message||error)}</p></div>`);
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
            setStatus('La cámara requiere HTTPS. Puedes seguir usando el lector USB o la captura manual.','warn');
            return;
        }
        try{
            setStatus('Preparando lector de cámara…');
            await loadScannerLibrary();
            setStatus('Solicitando acceso a la cámara…');
            scanner=scanner||new Html5Qrcode('universal-reader');
            await scanner.start({facingMode:'environment'},{fps:12,qrbox:(w,h)=>({width:Math.min(w*.82,360),height:Math.min(h*.52,240)}),aspectRatio:1.333},code=>resolve(code),()=>{});
            setCameraState(true);
            setStatus('Cámara activa. Centra el código dentro del marco.','ok');
        }catch(error){
            setCameraState(false);
            setStatus(`No se pudo abrir la cámara: ${error.message||error}`,'error');
        }
    };

    window.detenerScannerUniversal=async function(){
        if(scanner&&active){
            try{await scanner.stop()}catch(error){}
        }
        setCameraState(false);
        setStatus('Cámara detenida. Puedes usar el lector USB o iniciar otra lectura.');
    };

    window.procesarScannerManual=function(event){
        if(event&&event.key!=='Enter')return;
        if(event)event.preventDefault();
        const input=$('scanner-code');
        const value=text(input?.value);
        if(value)resolve(value);
        else setStatus('Escribe o escanea un código antes de consultar.','warn');
    };

    window.consultarScannerReciente=function(index){
        const item=recent[Number(index)];
        if(!item)return;
        last='';
        resolve(item.raw);
    };

    window.limpiarHistorialScanner=function(){
        recent=[];
        renderHistory();
    };

    document.addEventListener('keydown',event=>{
        const target=event.target;
        if(target?.id==='scanner-code'||target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
        const now=Date.now();
        if(now-wedgeLastAt>120)wedgeBuffer='';
        wedgeLastAt=now;
        if(event.key==='Enter'){
            const value=text(wedgeBuffer);
            wedgeBuffer='';
            if(value.length>=3){event.preventDefault();const input=$('scanner-code');if(input)input.value=value;resolve(value)}
            return;
        }
        if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)wedgeBuffer+=event.key;
    },true);

    window.addEventListener('beforeunload',()=>{if(scanner&&active)scanner.stop().catch(()=>{})});
    document.addEventListener('DOMContentLoaded',()=>{
        setCameraState(false);
        renderHistory();
        if(matchMedia('(pointer:fine)').matches)setTimeout(()=>$('scanner-code')?.focus({preventScroll:true}),180);
        const params=new URLSearchParams(location.search);
        if(params.get('codigo'))setTimeout(()=>resolve(params.get('codigo')),400);
    });
})();
