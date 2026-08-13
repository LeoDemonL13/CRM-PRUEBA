(function(){
    'use strict';
    const base=window.SkilledDB;
    if(!base||!base.client)return;
    const client=base.client;
    const text=v=>String(v??'').trim();
    const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
    const lower=v=>text(v).toLocaleLowerCase('es-MX');
    const bool=v=>v===true||v===1||lower(v)==='true'||lower(v)==='1';
    const isDeliveredTransfer=move=>move?.tipo==='traspaso'&&['almacen','proyecto'].includes(lower(move?.traspasoModo||move?.traspaso_modo));
    const mapMovement=row=>({
        id:row.id,
        requestId:text(row.request_id),
        request_id:text(row.request_id),
        fecha:row.fecha||row.created_at||'',
        tipo:lower(row.tipo),
        tipo_movimiento:lower(row.tipo),
        ajusteAccion:text(row.ajuste_accion),
        ajuste_accion:text(row.ajuste_accion),
        codigo:text(row.material_codigo||row.codigo_manual),
        material_codigo:text(row.material_codigo),
        codigoManual:text(row.codigo_manual),
        codigo_manual:text(row.codigo_manual),
        descripcion:text(row.descripcion),
        desc:text(row.descripcion),
        cantidad:number(row.cantidad),
        unidad:text(row.unidad),
        categoria:text(row.categoria_manual),
        esNoListado:bool(row.es_no_listado)||/^NL-/i.test(text(row.material_codigo||row.codigo_manual)),
        es_no_listado:bool(row.es_no_listado)||/^NL-/i.test(text(row.material_codigo||row.codigo_manual)),
        proyecto:text(row.proyecto),
        proyectoDestino:text(row.proyecto_destino),
        proyecto_destino:text(row.proyecto_destino),
        traspasoModo:text(row.traspaso_modo),
        traspaso_modo:text(row.traspaso_modo),
        ubicacionPendiente:bool(row.ubicacion_pendiente),
        ubicacion_pendiente:bool(row.ubicacion_pendiente),
        ubicacion:text(row.ubicacion),
        ordenCompra:text(row.orden_compra),
        orden_compra:text(row.orden_compra),
        fechaOrdenCompra:text(row.fecha_orden_compra),
        fecha_orden_compra:text(row.fecha_orden_compra),
        referencia:text(row.referencia),
        bodegaOrigen:text(row.bodega_origen),
        bodega_origen:text(row.bodega_origen),
        bodegaDestino:text(row.bodega_destino),
        bodega_destino:text(row.bodega_destino),
        motivo:text(row.motivo),
        precio:number(row.precio_unitario),
        precio_unitario:number(row.precio_unitario),
        recibeNombre:text(row.recibe_nombre),
        recibe_nombre:text(row.recibe_nombre),
        recibeTipo:text(row.recibe_tipo),
        recibe_tipo:text(row.recibe_tipo),
        folioEntrega:text(row.folio_entrega),
        folio_entrega:text(row.folio_entrega),
        alcance:text(row.alcance)||'sin_plan',
        stockFuente:text(row.stock_fuente)||'general',
        stock_fuente:text(row.stock_fuente)||'general',
        cantidadStockProyecto:number(row.cantidad_stock_proyecto),
        cantidadStockGeneral:number(row.cantidad_stock_general),
        cantidadDentroPlan:number(row.cantidad_dentro_plan),
        cantidad_dentro_plan:number(row.cantidad_dentro_plan),
        cantidadFueraPlan:number(row.cantidad_fuera_plan),
        cantidad_fuera_plan:number(row.cantidad_fuera_plan),
        origenEntrada:text(row.origen_entrada),
        origen_entrada:text(row.origen_entrada),
        tomarDelAlmacen:bool(row.tomar_del_almacen),
        tomar_del_almacen:bool(row.tomar_del_almacen)
    });
    async function listMovements(options={}){
        const rows=await base.listMovements(options);
        return Array.isArray(rows)?rows:[];
    }
    async function listProjectStocks(project){
        const value=text(project);
        if(!value)return[];
        const [{data,error},{data:warehouses,error:warehouseError}]=await Promise.all([
            client.from('existencias_proyecto_almacen').select('*').eq('proyecto_numero',value),
            client.from('almacenes').select('id,nombre')
        ]);
        if(error)throw new Error(error.message||'No se pudo consultar el stock reservado del proyecto.');
        if(warehouseError)throw new Error(warehouseError.message||'No se pudieron consultar los almacenes.');
        const names=new Map((warehouses||[]).map(row=>[Number(row.id),text(row.nombre)]));
        return(data||[]).map(row=>({
            id:Number(row.id),
            proyecto:text(row.proyecto_numero),
            codigo:text(row.material_codigo),
            almacenId:Number(row.almacen_id),
            almacen:names.get(Number(row.almacen_id))||'',
            stock:number(row.stock),
            ubicacion:text(row.ubicacion),
            fuenteReserva:'existencias_proyecto_almacen'
        }));
    }
    function historicalReserveRows(project,movements,authoritativeRows=[]){
        const value=text(project);
        const authoritative=new Set((authoritativeRows||[]).map(row=>`${lower(row.codigo)}|${lower(row.almacen)}`));
        const warehouseTotals=new Map();
        const warehouseLabels=new Map();
        const descriptions=new Map();
        const warehouseName=(move,positive)=>{
            const raw=positive
                ? text(move.bodegaDestino||move.bodega_destino||move.bodegaOrigen||move.bodega_origen)
                : text(move.bodegaOrigen||move.bodega_origen||move.bodegaDestino||move.bodega_destino);
            return raw||'Sin almacén';
        };
        const add=(code,warehouse,amount,move)=>{
            const normalizedCode=text(code);
            if(!normalizedCode||!Number.isFinite(amount)||Math.abs(amount)<0.000001)return;
            const key=`${lower(normalizedCode)}|${lower(warehouse)}`;
            warehouseTotals.set(key,(warehouseTotals.get(key)||0)+amount);
            if(!warehouseLabels.has(key))warehouseLabels.set(key,text(warehouse)||'Sin almacén');
            if(!descriptions.has(lower(normalizedCode)))descriptions.set(lower(normalizedCode),{
                codigo:normalizedCode,
                descripcion:text(move?.descripcion||move?.desc||normalizedCode),
                unidad:text(move?.unidad),
                categoria:text(move?.categoria),
                esNoListado:bool(move?.esNoListado??move?.es_no_listado)||/^NL-/i.test(normalizedCode)
            });
        };
        (movements||[]).forEach(move=>{
            if(text(move.proyecto)!==value)return;
            const code=text(move.codigo);
            if(!code)return;
            const qty=Math.max(0,number(move.cantidad));
            if(!qty)return;
            const type=lower(move.tipo);
            const adjustment=lower(move.ajusteAccion||move.ajuste_accion);
            const entryOrigin=lower(move.origenEntrada||move.origen_entrada);
            if(type==='entrada'){
                // Con proyecto, toda entrada es reserva salvo que se marcara expresamente como stock general.
                if(entryOrigin!=='ingreso_nuevo_almacen')add(code,warehouseName(move,true),qty,move);
            }else if(type==='salida'){
                add(code,warehouseName(move,false),-qty,move);
            }else if(type==='ajuste'){
                add(code,warehouseName(move,adjustment!=='disminuir'),adjustment==='disminuir'?-qty:qty,move);
            }else if(type==='traspaso'||type==='reingreso'||type==='prestamo'){
                add(code,warehouseName(move,false),-qty,move);
            }
        });
        const rows=[];
        warehouseTotals.forEach((stock,key)=>{
            if(stock<=0.000001)return;
            const [codeKey,warehouseKey]=key.split('|');
            const info=descriptions.get(codeKey)||{};
            const isManual=Boolean(info.esNoListado)||/^nl-/i.test(codeKey);
            // Para materiales catalogados, la tabla de existencias es la fuente oficial.
            // El historial solo actúa como respaldo cuando falta la fila de existencias (datos legacy).
            if(!isManual&&authoritative.has(key))return;
            rows.push({
                id:`hist:${value}:${codeKey}:${warehouseKey}`,
                proyecto:value,
                codigo:info.codigo||codeKey,
                almacenId:0,
                almacen:warehouseLabels.get(key)||(warehouseKey==='sin almacén'?'Sin almacén':warehouseKey),
                stock:number(stock),
                ubicacion:'',
                descripcion:info.descripcion||info.codigo||codeKey,
                unidad:info.unidad||'',
                categoria:info.categoria||'',
                esNoListado:isManual,
                es_no_listado:isManual,
                fuenteReserva:isManual?'historial_no_listado':'historial_legacy'
            });
        });
        return rows;
    }
    async function listProjectMovementPlan(project,options={}){
        const value=text(project);
        if(!value)throw new Error('Falta el número del proyecto.');
        const [plan,movements,materials,projectStocksStored]=await Promise.all([
            base.listProjectPlan(value),
            listMovements({project:value}),
            base.listMaterials(),
            listProjectStocks(value)
        ]);
        const projectStocks=[
            ...projectStocksStored,
            ...historicalReserveRows(value,movements,projectStocksStored)
        ];
        const materialByCode=new Map(materials.map(item=>[lower(item.codigo),item]));
        const projectByCode=new Map();
        const projectCodeByKey=new Map();
        projectStocks.forEach(item=>{
            const key=lower(item.codigo);
            if(!projectByCode.has(key))projectByCode.set(key,{});
            projectByCode.get(key)[item.almacen]=number(item.stock);
            if(!projectCodeByKey.has(key))projectCodeByKey.set(key,text(item.codigo));
        });
        const movementByCode=new Map();
        movements.forEach(item=>{
            const key=lower(item.codigo);
            if(!key)return;
            if(!movementByCode.has(key))movementByCode.set(key,[]);
            movementByCode.get(key).push(item);
        });
        const enrich=(row,material)=>{
            const general={};
            (material?.almacenes||[]).forEach(item=>{general[text(item.nombre)]=number(item.stock)});
            const reserved=projectByCode.get(lower(row.codigo))||{};
            const generalTotal=Object.values(general).reduce((a,b)=>a+number(b),0);
            const reservedTotal=Object.values(reserved).reduce((a,b)=>a+number(b),0);
            const requested=number(row.requerido??row.solicitado??row.cantidadPlaneada);
            return{
                ...row,
                material:{...(row.material||material||{}),stockGeneralPorAlmacen:general,stockProyectoPorAlmacen:reserved,stock_general_por_almacen:general,stock_proyecto_por_almacen:reserved},
                stockGeneralPorAlmacen:general,
                stockProyectoPorAlmacen:reserved,
                stock_general_por_almacen:general,
                stock_proyecto_por_almacen:reserved,
                stockGeneral:generalTotal,
                stockProyecto:reservedTotal,
                almacenGeneral:generalTotal,
                almacen_general:generalTotal,
                reservado:reservedTotal,
                stockReservado:reservedTotal,
                stock_reservado:reservedTotal,
                solicitado:requested,
                cantidadSolicitada:requested,
                cantidad_solicitada:requested,
                fueraDelPlan:Boolean(row.fueraPlan||row.fuera_plan),
                fuera_del_plan:Boolean(row.fueraPlan||row.fuera_plan)
            };
        };
        const planCodes=new Set(plan.map(row=>lower(row.codigo)));
        const rows=plan.map(line=>{
            const moves=movementByCode.get(lower(line.codigo))||[];
            let enteredInside=0;
            let deliveredInside=0;
            let returnedInside=0;
            let transferredInside=0;
            moves.forEach(move=>{
                const amount=move.cantidadDentroPlan>0?move.cantidadDentroPlan:(move.alcance==='dentro_plan'?move.cantidad:0);
                if(move.tipo==='entrada')enteredInside+=amount;
                if(move.tipo==='salida')deliveredInside+=amount;
                if(move.tipo==='ajuste'&&lower(move.ajusteAccion)==='aumentar')enteredInside+=amount;
                if(move.tipo==='ajuste'&&lower(move.ajusteAccion)==='disminuir')deliveredInside+=amount;
                if(move.tipo==='reingreso')returnedInside+=amount;
                if(isDeliveredTransfer(move))transferredInside+=amount;
            });
            const requested=number(line.cantidadPlaneada);
            const delivered=Math.max(0,deliveredInside);
            const leftover=Math.min(delivered,Math.max(0,returnedInside+transferredInside));
            const transferable=Math.max(0,delivered-leftover);
            const material=materialByCode.get(lower(line.codigo))||line.material;
            return enrich({
                ...line,
                requerido:requested,
                planeado:requested,
                ingresado:enteredInside,
                entregado:delivered,
                reingresado:returnedInside,
                sobrante:leftover,
                cantidadSobrante:leftover,
                cantidad_sobrante:leftover,
                disponibleTraspaso:transferable,
                disponible_traspaso:transferable,
                entregadoDisponible:transferable,
                entregado_disponible:transferable,
                pendiente:Math.max(0,requested-delivered),
                entregadoHistorico:delivered,
                entregado_historico:delivered,
                sobranteReingresado:returnedInside,
                sobrante_reingresado:returnedInside,
                sobranteTraspasado:transferredInside,
                sobrante_traspasado:transferredInside,
                descripcion:text(material?.descripcion??material?.desc??line.codigo),
                categoria:text(material?.categoria),
                unidad:text(line.unidad??material?.unidad),
                solicitudAprobada:lower(line.estadoSolicitud)==='aprobada',
                fueraPlan:false,
                fuera_plan:false,
                rowKey:`plan:${line.codigo}`
            },material);
        });
        if(options.includeOutsidePlan){
            const outsideKeys=new Set([...movementByCode.keys(),...projectByCode.keys()]);
            outsideKeys.forEach(key=>{
                const moves=movementByCode.get(key)||[];
                let entered=0;
                let delivered=0;
                let returned=0;
                let transferred=0;
                moves.forEach(move=>{
                    const outside=move.cantidadFueraPlan>0?move.cantidadFueraPlan:((move.alcance==='fuera_plan'||!planCodes.has(key))?move.cantidad:0);
                    if(move.tipo==='entrada')entered+=outside;
                    if(move.tipo==='salida')delivered+=outside;
                    if(move.tipo==='ajuste'&&lower(move.ajusteAccion)==='aumentar')entered+=outside;
                    if(move.tipo==='ajuste'&&lower(move.ajusteAccion)==='disminuir')delivered+=outside;
                    if(move.tipo==='reingreso')returned+=outside;
                    if(isDeliveredTransfer(move))transferred+=outside;
                });
                const reserved=projectByCode.get(key)||{};
                const reservedTotal=Object.values(reserved).reduce((sum,value)=>sum+number(value),0);
                const deliveredNet=Math.max(0,delivered);
                const leftover=Math.min(deliveredNet,Math.max(0,returned+transferred));
                const transferable=Math.max(0,deliveredNet-leftover);
                const hasOutsideHistory=entered>0||delivered>0||returned>0||transferred>0;
                if(!hasOutsideHistory&&(planCodes.has(key)||reservedTotal<=0))return;
                const first=moves[0]||{};
                const code=text(first.codigo||projectCodeByKey.get(key)||materialByCode.get(key)?.codigo||key);
                const material=materialByCode.get(key)||{codigo:code,descripcion:text(first.descripcion)||code,desc:text(first.descripcion)||code,categoria:text(first.categoria),unidad:text(first.unidad),precio:number(first.precio),almacenes:[],esNoListado:bool(first.esNoListado??first.es_no_listado)||/^NL-/i.test(code),es_no_listado:bool(first.esNoListado??first.es_no_listado)||/^NL-/i.test(code)};
                rows.push(enrich({
                    id:`fuera:${code}`,
                    proyecto:value,
                    codigo:code,
                    cantidadPlaneada:0,
                    cantidadEntregada:deliveredNet,
                    cantidadSobrante:leftover,
                    cantidad_sobrante:leftover,
                    unidad:text(material.unidad||first.unidad),
                    precioUnitario:number(first.precio)||number(material.precio),
                    observaciones:'Material fuera del plan original',
                    esNoListado:bool(material.esNoListado??material.es_no_listado),
                    esIncompleto:bool(material.esIncompleto??material.es_incompleto),
                    estadoSolicitud:'aprobada',
                    estado_solicitud:'aprobada',
                    material,
                    requerido:0,
                    planeado:0,
                    ingresado:entered,
                    entregado:deliveredNet,
                    reingresado:returned,
                    sobrante:leftover,
                    disponibleTraspaso:transferable,
                    disponible_traspaso:transferable,
                    entregadoDisponible:transferable,
                    entregado_disponible:transferable,
                    pendiente:0,
                    entregadoHistorico:deliveredNet,
                    entregado_historico:deliveredNet,
                    sobranteReingresado:returned,
                    sobrante_reingresado:returned,
                    sobranteTraspasado:transferred,
                    sobrante_traspasado:transferred,
                    descripcion:text(material.descripcion??material.desc??code),
                    categoria:text(material.categoria),
                    solicitudAprobada:true,
                    entradaNoSolicitada:reservedTotal,
                    entrada_no_solicitada:reservedTotal,
                    stockReservadoFueraPlan:reservedTotal,
                    stock_reservado_fuera_plan:reservedTotal,
                    fueraPlan:true,
                    fuera_plan:true,
                    rowKey:`fuera:${code}`
                },material));
            });
        }
        return rows;
    }
    async function listMovementGroups(options={}){
        const rows=await listMovements(options);
        const groups=new Map();
        rows.forEach(row=>{
            const key=row.requestId||`mov-${row.id}`;
            if(!groups.has(key))groups.set(key,{
                requestId:key,
                tipo_movimiento:row.tipo,
                tipo:row.tipo,
                motivo:row.motivo,
                fecha:row.fecha,
                proyecto:row.proyecto,
                proyectoDestino:row.proyectoDestino,
                proyecto_destino:row.proyectoDestino,
                traspasoModo:row.traspasoModo,
                traspaso_modo:row.traspasoModo,
                referencia:row.referencia,
                ordenCompra:row.ordenCompra,
                fechaOrdenCompra:row.fechaOrdenCompra,
                bodegaOrigen:row.bodegaOrigen,
                bodegaDestino:row.bodegaDestino,
                ubicacion:row.ubicacion,
                recibeNombre:row.recibeNombre,
                recibeTipo:row.recibeTipo,
                folioEntrega:row.folioEntrega||row.referencia||row.requestId,
                productos:[]
            });
            const group=groups.get(key);
            if(row.tipo==='traspaso'||row.tipo==='prestamo'){
                group.tipo_movimiento=row.tipo;
                group.tipo=row.tipo;
                group.proyecto=row.proyecto||group.proyecto;
                group.proyectoDestino=row.proyectoDestino||group.proyectoDestino;
                group.proyecto_destino=row.proyectoDestino||group.proyecto_destino;
                group.traspasoModo=row.traspasoModo||group.traspasoModo;
                group.traspaso_modo=row.traspasoModo||group.traspaso_modo;
                group.bodegaOrigen=row.bodegaOrigen||group.bodegaOrigen;
                group.bodegaDestino=row.bodegaDestino||group.bodegaDestino;
            }
            group.productos.push({
                tipo:row.tipo,
                ajusteAccion:row.ajusteAccion||null,
                producto:{codigo:row.codigo,desc:row.descripcion,descripcion:row.descripcion,unidad:row.unidad,categoria:row.categoria,esNoListado:row.esNoListado},
                codigo:row.codigo,
                descripcion:row.descripcion,
                cantidad:row.cantidad,
                proyecto:row.proyecto,
                proyectoDestino:row.proyectoDestino,
                proyecto_destino:row.proyectoDestino,
                traspasoModo:row.traspasoModo,
                traspaso_modo:row.traspasoModo,
                ubicacion:row.ubicacion,
                ordenCompra:row.ordenCompra,
                fechaOrdenCompra:row.fechaOrdenCompra,
                referencia:row.referencia,
                bodegaOrigen:row.bodegaOrigen,
                bodegaDestino:row.bodegaDestino,
                esNoListado:row.esNoListado,
                unidad:row.unidad,
                alcance:row.alcance,
                stockFuente:row.stockFuente,
                cantidadDentroPlan:row.cantidadDentroPlan,
                cantidadFueraPlan:row.cantidadFueraPlan
            });
        });
        return Array.from(groups.values()).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    }
    window.SkilledDB=Object.freeze({...base,listMovements,listMovementGroups,listProjectStocks,listProjectMovementPlan,listProjectDeliveryPlan:listProjectMovementPlan});
})();
