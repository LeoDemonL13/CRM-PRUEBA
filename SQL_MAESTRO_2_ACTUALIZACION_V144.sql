begin;

create or replace function public.rh_resumen_asistencia_periodo_v73(p_inicio date,p_fin date)
returns table(
    personal_id bigint,
    dias_trabajados integer,
    horas_brutas numeric,
    horas_pagables_hora numeric,
    checadas_incompletas integer,
    fuente text
)
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
    if auth.uid() is null or not exists(
        select 1 from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true and lower(btrim(coalesce(p.rol,''))) in ('administrador','rh')
    ) then
        raise exception using errcode='42501',message='Solo RH o Administrador puede consultar el resumen de asistencia.';
    end if;
    return query
    with punch_days as(
        select c.personal_id,c.fecha_local dia,
               min(c.fecha_hora) filter(where c.tipo='entrada') entrada,
               max(c.fecha_hora) filter(where c.tipo='salida') salida,
               count(*) filter(where c.tipo='entrada') entradas,
               count(*) filter(where c.tipo='salida') salidas
        from public.rh_checadas c
        where c.fecha_local between p_inicio and p_fin
        group by c.personal_id,c.fecha_local
    ),
    punch_calc as(
        select pd.personal_id,pd.dia,
               case when pd.entrada is not null and pd.salida is not null and pd.salida>pd.entrada then extract(epoch from(pd.salida-pd.entrada))/3600.0 else 0 end horas,
               case when pd.entrada is null or pd.salida is null then 1 else 0 end incompleta,
               'checador'::text origen
        from punch_days pd
    ),
    incident_days as(
        select i.personal_id,g.dia::date dia,
               case when i.hora_entrada is not null and i.hora_salida is not null and i.hora_salida>i.hora_entrada
                    then extract(epoch from((g.dia::date+i.hora_salida)-(g.dia::date+i.hora_entrada)))/3600.0 else 0 end horas,
               case when i.hora_entrada is null or i.hora_salida is null then 1 else 0 end incompleta,
               'incidencia'::text origen
        from public.rh_incidencias i
        cross join lateral generate_series(i.fecha_inicio,i.fecha_fin,interval '1 day') g(dia)
        where i.fecha_inicio<=p_fin and i.fecha_fin>=p_inicio
          and g.dia::date between p_inicio and p_fin
          and i.tipo in('asistencia','retardo') and i.estado not in('cancelado','rechazado')
    ),
    daily as(
        select * from punch_calc
        union all
        select i.* from incident_days i
        where not exists(select 1 from punch_calc p where p.personal_id=i.personal_id and p.dia=i.dia)
    ),
    agg as(
        select d.personal_id,
               count(*) filter(where d.horas>0)::integer dias,
               round(coalesce(sum(d.horas),0)::numeric,2) bruto,
               round(coalesce(sum(greatest(d.horas-1,0)),0)::numeric,2) pagable_hora,
               coalesce(sum(d.incompleta),0)::integer incompletas,
               case when bool_or(d.origen='checador') and bool_or(d.origen='incidencia') then 'checador+incidencias'
                    when bool_or(d.origen='checador') then 'checador'
                    when bool_or(d.origen='incidencia') then 'incidencias'
                    else 'sin_registros' end fuente
        from daily d group by d.personal_id
    )
    select rp.id,coalesce(a.dias,0),coalesce(a.bruto,0),coalesce(a.pagable_hora,0),coalesce(a.incompletas,0),coalesce(a.fuente,'sin_registros')
    from public.rh_personal rp left join agg a on a.personal_id=rp.id;
end;
$$;
revoke all on function public.rh_resumen_asistencia_periodo_v73(date,date) from public,anon;
grant execute on function public.rh_resumen_asistencia_periodo_v73(date,date) to authenticated;

create or replace function public.crm_crear_material_incompleto_v78(
    p_codigo text,
    p_descripcion text,
    p_categoria text default 'Sin clasificar',
    p_unidad text default 'pieza',
    p_precio numeric default 0,
    p_codigo_marca text default null,
    p_moneda_costo text default 'MXN',
    p_origen text default 'alta_manual'
) returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
    v_role text;
    v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
    v_descripcion text:=nullif(btrim(coalesce(p_descripcion,'')),'');
    v_moneda text:=upper(btrim(coalesce(p_moneda_costo,'MXN')));
begin
    if auth.uid() is null then
        if coalesce(auth.role(),'')<>'service_role' then
            raise exception using errcode='42501',message='La sesión no está activa.';
        end if;
        v_role:='service_role';
    else
        select lower(btrim(coalesce(p.rol,''))) into v_role
        from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true;
        if v_role is null or v_role not in ('administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion') then
            raise exception using errcode='42501',message='Tu perfil no tiene permiso para crear o completar materiales.';
        end if;
    end if;
    if v_codigo='' or v_descripcion is null then raise exception 'Código y descripción son obligatorios.'; end if;
    if v_moneda not in ('MXN','USD','EUR') then v_moneda:='MXN'; end if;
    insert into public.materiales(codigo,descripcion,categoria,unidad,precio,codigo_marca,moneda_costo,es_incompleto,origen_alta,activo,updated_at)
    values(v_codigo,v_descripcion,coalesce(nullif(btrim(p_categoria),''),'Sin clasificar'),coalesce(nullif(btrim(p_unidad),''),'pieza'),coalesce(p_precio,0),nullif(btrim(coalesce(p_codigo_marca,'')),''),v_moneda,true,coalesce(nullif(btrim(p_origen),''),'alta_manual'),true,now())
    on conflict (codigo) do update set
        descripcion=coalesce(nullif(excluded.descripcion,''),public.materiales.descripcion),
        categoria=coalesce(nullif(excluded.categoria,''),public.materiales.categoria),
        unidad=coalesce(nullif(excluded.unidad,''),public.materiales.unidad),
        precio=coalesce(excluded.precio,public.materiales.precio),
        codigo_marca=coalesce(excluded.codigo_marca,public.materiales.codigo_marca),
        moneda_costo=coalesce(excluded.moneda_costo,public.materiales.moneda_costo),
        es_incompleto=true,
        origen_alta=coalesce(excluded.origen_alta,public.materiales.origen_alta),
        activo=true,
        updated_at=now();
    return jsonb_build_object('codigo',v_codigo,'ok',true);
end;
$$;
revoke all on function public.crm_crear_material_incompleto_v78(text,text,text,text,numeric,text,text,text) from public,anon;
grant execute on function public.crm_crear_material_incompleto_v78(text,text,text,text,numeric,text,text,text) to authenticated,service_role;

create or replace function public.rh_importar_activos_resguardos_v144(p_activos jsonb default '[]'::jsonb,p_resguardos jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
    v_role text;
    v_item jsonb;
    v_code text;
    v_name text;
    v_control text;
    v_existing_control text;
    v_asset_state text;
    v_asset_state_raw text;
    v_assignment_state text;
    v_employee text;
    v_person_name text;
    v_qty numeric(14,2);
    v_total numeric(14,2);
    v_date date;
    v_close_date date;
    v_asset_id bigint;
    v_person_id bigint;
    v_assignment_id bigint;
    v_occupied numeric(14,2);
    v_assets_inserted integer:=0;
    v_assets_updated integer:=0;
    v_assignments_inserted integer:=0;
    v_assignments_updated integer:=0;
    v_skipped integer:=0;
    v_errors jsonb:='[]'::jsonb;
begin
    if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
    select lower(btrim(coalesce(p.rol,''))) into v_role from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true;
    if v_role not in ('administrador','rh') then raise exception using errcode='42501',message='Solo RH o Administrador puede importar equipos y resguardos.'; end if;
    if p_activos is null or jsonb_typeof(p_activos)<>'array' then p_activos:='[]'::jsonb; end if;
    if p_resguardos is null or jsonb_typeof(p_resguardos)<>'array' then p_resguardos:='[]'::jsonb; end if;

    for v_item in select value from jsonb_array_elements(p_activos)
    loop
        begin
            v_code:=upper(btrim(coalesce(v_item->>'codigo','')));
            v_name:=btrim(coalesce(v_item->>'nombre',''));
            if v_code='' or v_name='' then
                v_skipped:=v_skipped+1;
                v_errors:=v_errors||jsonb_build_array(jsonb_build_object('tipo','activo','codigo',v_code,'detalle','Código y nombre son obligatorios.'));
                continue;
            end if;
            v_control:=case lower(btrim(coalesce(v_item->>'tipo_control',''))) when 'cantidad' then 'cantidad' when 'individual' then 'individual' else null end;
            v_asset_state_raw:=lower(btrim(coalesce(v_item->>'estado','')));
            v_asset_state:=case v_asset_state_raw when 'mantenimiento' then 'mantenimiento' when 'baja' then 'baja' when 'activo' then 'activo' else null end;
            v_total:=case when nullif(btrim(coalesce(v_item->>'cantidad_total','')),'') is null then null else greatest((v_item->>'cantidad_total')::numeric,0.01) end;
            select a.id,a.tipo_control,a.cantidad_total into v_asset_id,v_existing_control,v_occupied from public.rh_activos_oficina a where lower(btrim(a.codigo))=lower(v_code) order by a.id limit 1;
            if v_asset_id is null then
                v_control:=coalesce(v_control,case when coalesce(v_total,1)>1 then 'cantidad' else 'individual' end);
                v_total:=coalesce(v_total,1);
                if v_control='individual' then v_total:=1; end if;
                v_asset_state:=coalesce(v_asset_state,'activo');
                insert into public.rh_activos_oficina(codigo,nombre,categoria,tipo_control,marca,modelo,numero_serie,unidad,cantidad_total,ubicacion,estado,observaciones,creado_por,created_at,updated_at)
                values(v_code,v_name,coalesce(nullif(btrim(v_item->>'categoria'),''),'Otro'),v_control,nullif(btrim(v_item->>'marca'),''),nullif(btrim(v_item->>'modelo'),''),nullif(btrim(v_item->>'numero_serie'),''),upper(coalesce(nullif(btrim(v_item->>'unidad'),''),'PIEZA')),v_total,nullif(btrim(v_item->>'ubicacion'),''),v_asset_state,nullif(btrim(v_item->>'observaciones'),''),auth.uid(),now(),now())
                returning id into v_asset_id;
                v_assets_inserted:=v_assets_inserted+1;
            else
                update public.rh_activos_oficina set
                    nombre=v_name,
                    categoria=coalesce(nullif(btrim(v_item->>'categoria'),''),categoria),
                    tipo_control=coalesce(v_control,tipo_control),
                    marca=coalesce(nullif(btrim(v_item->>'marca'),''),marca),
                    modelo=coalesce(nullif(btrim(v_item->>'modelo'),''),modelo),
                    numero_serie=coalesce(nullif(btrim(v_item->>'numero_serie'),''),numero_serie),
                    unidad=coalesce(upper(nullif(btrim(v_item->>'unidad'),'')),unidad),
                    cantidad_total=coalesce(v_total,cantidad_total),
                    ubicacion=coalesce(nullif(btrim(v_item->>'ubicacion'),''),ubicacion),
                    estado=coalesce(v_asset_state,estado),
                    observaciones=coalesce(nullif(btrim(v_item->>'observaciones'),''),observaciones),
                    updated_at=now()
                where id=v_asset_id;
                v_assets_updated:=v_assets_updated+1;
            end if;
        exception when others then
            v_skipped:=v_skipped+1;
            v_errors:=v_errors||jsonb_build_array(jsonb_build_object('tipo','activo','codigo',coalesce(v_code,''),'detalle',sqlerrm));
        end;
        v_asset_id:=null;
    end loop;

    for v_item in select value from jsonb_array_elements(p_resguardos)
    loop
        begin
            v_code:=upper(btrim(coalesce(v_item->>'activo_codigo','')));
            v_employee:=btrim(coalesce(v_item->>'empleado',''));
            v_person_name:=lower(btrim(regexp_replace(coalesce(v_item->>'colaborador',''),'\s+',' ','g')));
            v_qty:=greatest(coalesce(nullif(v_item->>'cantidad','')::numeric,1),0.01);
            v_date:=coalesce(nullif(v_item->>'fecha_asignacion','')::date,current_date);
            v_close_date:=nullif(v_item->>'fecha_devolucion','')::date;
            v_assignment_state:=case lower(btrim(coalesce(v_item->>'estado','asignado'))) when 'devuelto' then 'devuelto' when 'danado' then 'danado' when 'dañado' then 'danado' when 'perdido' then 'perdido' else 'asignado' end;
            select a.id into v_asset_id from public.rh_activos_oficina a where lower(btrim(a.codigo))=lower(v_code) order by a.id limit 1;
            if v_asset_id is null then
                v_skipped:=v_skipped+1;
                v_errors:=v_errors||jsonb_build_array(jsonb_build_object('tipo','resguardo','codigo',v_code,'detalle','No se encontró el activo indicado.'));
                continue;
            end if;
            v_person_id:=null;
            if v_employee<>'' then
                select p.id into v_person_id from public.rh_personal p where lower(btrim(coalesce(p.numero_empleado,'')))=lower(v_employee) order by p.id limit 1;
            end if;
            if v_person_id is null and v_person_name<>'' then
                select p.id into v_person_id from public.rh_personal p where lower(btrim(regexp_replace(concat_ws(' ',p.nombre,p.apellidos),'\s+',' ','g')))=v_person_name order by p.id limit 1;
            end if;
            if v_person_id is null then
                v_skipped:=v_skipped+1;
                v_errors:=v_errors||jsonb_build_array(jsonb_build_object('tipo','resguardo','codigo',v_code,'empleado',v_employee,'colaborador',v_item->>'colaborador','detalle','No se encontró al colaborador por número de empleado ni nombre completo.'));
                continue;
            end if;
            select a.id into v_assignment_id
            from public.rh_activos_asignaciones a
            where a.activo_id=v_asset_id and a.personal_id=v_person_id and a.fecha_asignacion=v_date and a.cantidad=v_qty
            order by a.id limit 1;
            if v_assignment_state in ('asignado','danado','perdido') then
                select coalesce(sum(a.cantidad),0) into v_occupied
                from public.rh_activos_asignaciones a
                where a.activo_id=v_asset_id and a.estado in ('asignado','danado','perdido') and (v_assignment_id is null or a.id<>v_assignment_id);
                select cantidad_total into v_total from public.rh_activos_oficina where id=v_asset_id;
                if v_occupied+v_qty>v_total then
                    raise exception 'La importación excede la cantidad total del activo %: total %, ya no disponible %, intento %.',v_code,v_total,v_occupied,v_qty;
                end if;
            end if;
            if v_assignment_id is null then
                insert into public.rh_activos_asignaciones(activo_id,personal_id,cantidad,fecha_asignacion,fecha_devolucion,estado,condicion_entrega,condicion_devolucion,responsable_entrega,responsable_recepcion,notas,creado_por,cerrado_por,created_at,updated_at)
                values(v_asset_id,v_person_id,v_qty,v_date,case when v_assignment_state='asignado' then null else v_close_date end,v_assignment_state,nullif(btrim(v_item->>'condicion_entrega'),''),nullif(btrim(v_item->>'condicion_devolucion'),''),nullif(btrim(v_item->>'responsable_entrega'),''),nullif(btrim(v_item->>'responsable_recepcion'),''),nullif(btrim(v_item->>'notas'),''),auth.uid(),case when v_assignment_state='asignado' then null else auth.uid() end,now(),now());
                v_assignments_inserted:=v_assignments_inserted+1;
            else
                update public.rh_activos_asignaciones set
                    fecha_devolucion=case when v_assignment_state='asignado' then null else coalesce(v_close_date,fecha_devolucion) end,
                    estado=v_assignment_state,
                    condicion_entrega=coalesce(nullif(btrim(v_item->>'condicion_entrega'),''),condicion_entrega),
                    condicion_devolucion=coalesce(nullif(btrim(v_item->>'condicion_devolucion'),''),condicion_devolucion),
                    responsable_entrega=coalesce(nullif(btrim(v_item->>'responsable_entrega'),''),responsable_entrega),
                    responsable_recepcion=coalesce(nullif(btrim(v_item->>'responsable_recepcion'),''),responsable_recepcion),
                    notas=coalesce(nullif(btrim(v_item->>'notas'),''),notas),
                    cerrado_por=case when v_assignment_state='asignado' then null else coalesce(cerrado_por,auth.uid()) end,
                    updated_at=now()
                where id=v_assignment_id;
                v_assignments_updated:=v_assignments_updated+1;
            end if;
        exception when others then
            v_skipped:=v_skipped+1;
            v_errors:=v_errors||jsonb_build_array(jsonb_build_object('tipo','resguardo','codigo',coalesce(v_code,''),'empleado',coalesce(v_employee,''),'detalle',sqlerrm));
        end;
        v_asset_id:=null;v_person_id:=null;v_assignment_id:=null;
    end loop;

    return jsonb_build_object('ok',true,'activos_insertados',v_assets_inserted,'activos_actualizados',v_assets_updated,'resguardos_insertados',v_assignments_inserted,'resguardos_actualizados',v_assignments_updated,'omitidos',v_skipped,'errores',v_errors);
end;
$$;
revoke all on function public.rh_importar_activos_resguardos_v144(jsonb,jsonb) from public,anon;
grant execute on function public.rh_importar_activos_resguardos_v144(jsonb,jsonb) to authenticated;

create or replace function public.co_crear_orden_libre_v107(
    p_orden text,
    p_proveedor_id bigint,
    p_almacen_id bigint,
    p_proyecto text,
    p_prioridad text,
    p_fecha_requerida date,
    p_referencia text,
    p_solicitado_por text,
    p_justificacion text,
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_order text:=upper(btrim(coalesce(p_orden,'')));
    v_provider_name text;
    v_provider_contact text;
    v_warehouse_name text:='Por definir';
    v_project text:=nullif(btrim(coalesce(p_proyecto,'')),'');
    v_priority text;
    v_count integer:=0;
    v_group text;
    v_currency text:='MXN';
    v_currency_count integer:=0;
begin
    if not public.crm_usuario_tiene_rol(array['administrador','compras']) then raise exception using errcode='42501',message='Solo Compras o Administrador puede crear una orden libre.'; end if;
    if p_almacen_id is not null then
        select nombre into v_warehouse_name from public.almacenes where id=p_almacen_id;
        if v_warehouse_name is null then raise exception 'El almacén destino seleccionado ya no existe.'; end if;
    end if;
    if v_project is not null and not exists(select 1 from public.proyectos where numero_proyecto=v_project) then raise exception 'El proyecto seleccionado ya no existe.'; end if;
    if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Agrega al menos una partida a la orden.'; end if;
    select count(distinct case upper(coalesce(x.moneda,'MXN')) when 'USD' then 'USD' when 'EUR' then 'EUR' else 'MXN' end),
           max(case upper(coalesce(x.moneda,'MXN')) when 'USD' then 'USD' when 'EUR' then 'EUR' else 'MXN' end)
      into v_currency_count,v_currency
      from jsonb_to_recordset(p_items) as x(descripcion text,cantidad numeric,moneda text)
     where nullif(btrim(coalesce(x.descripcion,'')),'') is not null and coalesce(x.cantidad,0)>0;
    if v_currency_count>1 then raise exception 'Una orden de compra debe usar una sola moneda. Separa MXN, USD y EUR en órdenes diferentes.'; end if;
    v_currency:=coalesce(v_currency,'MXN');
    if p_proveedor_id is not null then
        select coalesce(nullif(nombre_comercial,''),razon_social),contacto into v_provider_name,v_provider_contact from public.co_proveedores where id=p_proveedor_id and estado<>'inactivo';
        if v_provider_name is null then raise exception 'El proveedor seleccionado ya no está disponible.'; end if;
    end if;
    if v_order='' then v_order:='OC-LIB-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(md5(random()::text),1,3)); end if;
    v_group:=v_order;
    v_priority:=case when lower(coalesce(p_prioridad,'normal')) in('critica','urgente','alta') then 'urgente' else 'normal' end;
    insert into public.solicitudes_compra(
        folio,material_codigo,descripcion,categoria,unidad,almacen_id,almacen_nombre,existencia_actual,stock_minimo,stock_medio,stock_maximo,cantidad_solicitada,cantidad_recibida,prioridad,estado,proveedor,contacto_proveedor,orden_compra,grupo_orden,motivo,solicitado_por,fecha_requerida,fecha_orden_compra,referencia,estado_compras,proveedor_id,precio_cotizado,moneda,origen_solicitud,justificacion_excepcion,proyecto_numero,created_at,updated_at
    )
    select
        'SC-LIB-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||lpad(row_number() over()::text,3,'0'),
        nullif(btrim(x.material_codigo),''),coalesce(nullif(btrim(x.descripcion),''),m.descripcion),coalesce(nullif(btrim(x.categoria),''),m.categoria,'Compra libre'),coalesce(nullif(btrim(x.unidad),''),m.unidad,'PIEZA'),p_almacen_id,v_warehouse_name,coalesce(e.stock,0),coalesce(e.stock_minimo,0),coalesce(e.stock_medio,0),coalesce(e.stock_maximo,0),greatest(coalesce(x.cantidad,0),0),0,v_priority,'pendiente',v_provider_name,v_provider_contact,v_order,v_group,'Orden libre temporal'||case when btrim(coalesce(p_justificacion,''))<>'' then ': '||btrim(p_justificacion) else '' end,nullif(btrim(coalesce(p_solicitado_por,'')),''),p_fecha_requerida,current_date,nullif(btrim(coalesce(p_referencia,'')),''),'en_revision',p_proveedor_id,greatest(coalesce(x.precio_unitario,0),0),v_currency,'manual_libre_temporal',nullif(btrim(coalesce(p_justificacion,'')),''),v_project,now(),now()
    from jsonb_to_recordset(p_items) as x(material_codigo text,descripcion text,categoria text,unidad text,cantidad numeric,precio_unitario numeric,moneda text)
    left join public.materiales m on lower(m.codigo)=lower(nullif(btrim(x.material_codigo),''))
    left join public.existencias_almacen e on e.material_codigo=m.codigo and e.almacen_id=p_almacen_id
    where nullif(btrim(coalesce(x.descripcion,m.descripcion,'')),'') is not null and coalesce(x.cantidad,0)>0;
    get diagnostics v_count=row_count;
    if v_count=0 then raise exception 'No hay partidas válidas para crear la orden.'; end if;
    return jsonb_build_object('ok',true,'orden',v_order,'materiales',v_count,'origen','manual_libre_temporal','moneda',v_currency);
end;
$$;
revoke all on function public.co_crear_orden_libre_v107(text,bigint,bigint,text,text,date,text,text,text,jsonb) from public,anon;
grant execute on function public.co_crear_orden_libre_v107(text,bigint,bigint,text,text,date,text,text,text,jsonb) to authenticated;

create or replace function public.crm_skill_perfil_consultar_v136(p_fuente text,p_filtro text default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  v_role text; v_fuente text:=lower(btrim(coalesce(p_fuente,''))); v_filtro text:=nullif(btrim(coalesce(p_filtro,'')),''); v_result jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
  select lower(btrim(rol)) into v_role from public.perfiles_usuario where id=auth.uid() and activo=true;
  if v_role is null then raise exception using errcode='42501',message='Tu perfil no está activo para Skill.'; end if;
  v_fuente:=case v_fuente when 'projectdetails' then 'proyectos' when 'purchases' then 'compras' when 'suppliers' then 'proveedores' when 'quotations' then 'cotizaciones' else v_fuente end;
  if v_role not in ('gerente_general','subgerente','sky_demo') then
    if v_role='administrador' and v_fuente not in ('') then raise exception using errcode='42501',message='Skill Administración no consulta datos operativos de otros perfiles.'; end if;
    if v_role in ('jefe_almacen','almacen') and v_fuente not in ('materiales','categorias','almacenes','herramientas','herramientas_asignaciones','vehiculos','proyectos','compras') then raise exception using errcode='42501',message='Skill solo puede consultar información de Almacén en este perfil.'; end if;
    if v_role='compras' and v_fuente not in ('materiales','categorias','proyectos','proveedores','proveedor_materiales','compras','cotizaciones','solicitudes_proveedor','servicios') then raise exception using errcode='42501',message='Skill solo puede consultar información de Compras en este perfil.'; end if;
    if v_role='rh' and v_fuente not in ('personal','proyectos','vehiculos','asistencia','asignaciones_rh','incidencias_rh','documentos_rh','capacitaciones_rh','participantes_capacitacion_rh','activos_rh','resguardos_rh') then raise exception using errcode='42501',message='Skill solo puede consultar información de RH en este perfil.'; end if;
    if v_role='finanzas' and v_fuente not in ('proyectos','compras','cotizaciones') then raise exception using errcode='42501',message='Skill solo puede consultar información de Finanzas en este perfil.'; end if;
    if v_role='proyectos' and v_fuente not in ('proyectos','materiales','categorias','compras') then raise exception using errcode='42501',message='Skill solo puede consultar información de Proyectos en este perfil.'; end if;
    if v_role='planeacion' and v_fuente not in ('proyectos','materiales','categorias','compras') then raise exception using errcode='42501',message='Skill solo puede consultar información de Planeación en este perfil.'; end if;
    if v_role='coordinacion' and v_fuente not in ('proyectos','vehiculos','compras') then raise exception using errcode='42501',message='Skill solo puede consultar información de Coordinación en este perfil.'; end if;
    if v_role='logistica' and v_fuente not in ('proyectos','vehiculos','materiales','categorias') then raise exception using errcode='42501',message='Skill solo puede consultar información de Logística en este perfil.'; end if;
    if v_role='recepcion' and v_fuente not in ('presencia_recepcion','directorio_recepcion','suministros','tienda') then raise exception using errcode='42501',message='Skill solo puede consultar información de Recepción en este perfil.'; end if;
    if v_role='tsi' and v_fuente not in ('materiales','categorias','proyectos') then raise exception using errcode='42501',message='Skill solo puede consultar información de TSI en este perfil.'; end if;
    if v_role='consulta' and v_fuente not in ('materiales','categorias') then raise exception using errcode='42501',message='Skill Consulta no puede consultar esa fuente.'; end if;
  end if;

  if v_fuente in ('materiales','categorias','almacenes','herramientas','vehiculos','proyectos','compras','proveedores','cotizaciones','suministros','tienda') then
    return public.crm_sky_perfil_consultar_v103(v_fuente,v_filtro);
  end if;
  if v_fuente='presencia_recepcion' then return public.crm_sky_recepcion_presencia_v100(v_filtro); end if;
  if v_fuente='directorio_recepcion' then return public.crm_skill_recepcion_directorio_v102(); end if;
  if v_fuente='asistencia' then return public.crm_sky_asistencia_v81(v_filtro); end if;

  if v_fuente='herramientas_asignaciones' then select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into v_result from public.herramientas_asignaciones x; return v_result; end if;
  if v_fuente='proveedor_materiales' then select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into v_result from public.co_proveedor_materiales x where x.activo=true; return v_result; end if;
  if v_fuente='solicitudes_proveedor' then select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_result from public.co_solicitudes_proveedor x; return v_result; end if;
  if v_fuente='servicios' then select coalesce(jsonb_agg(to_jsonb(x) order by x.proxima_fecha_pago),'[]'::jsonb) into v_result from public.co_servicios x; return v_result; end if;
  if v_fuente='asignaciones_rh' then select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into v_result from public.rh_proyecto_asignaciones x; return v_result; end if;
  if v_fuente='incidencias_rh' then select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_inicio desc,x.id desc),'[]'::jsonb) into v_result from public.rh_incidencias x; return v_result; end if;
  if v_fuente='documentos_rh' then select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('personal',case when p.id is null then null else jsonb_build_object('id',p.id,'numero_empleado',p.numero_empleado,'nombre',p.nombre,'apellidos',p.apellidos,'puesto',p.puesto) end) order by d.id desc),'[]'::jsonb) into v_result from public.rh_documentos d left join public.rh_personal p on p.id=d.personal_id; return v_result; end if;
  if v_fuente='capacitaciones_rh' then select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into v_result from public.rh_capacitaciones x; return v_result; end if;
  if v_fuente='participantes_capacitacion_rh' then select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('personal',case when p.id is null then null else jsonb_build_object('id',p.id,'nombre',p.nombre,'apellidos',p.apellidos) end) order by c.id desc),'[]'::jsonb) into v_result from public.rh_capacitacion_participantes c left join public.rh_personal p on p.id=c.personal_id; return v_result; end if;
  if v_fuente='activos_rh' then select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('rh_activos_asignaciones',coalesce((select jsonb_agg(jsonb_build_object('cantidad',r.cantidad,'estado',r.estado)) from public.rh_activos_asignaciones r where r.activo_id=a.id),'[]'::jsonb)) order by a.nombre),'[]'::jsonb) into v_result from public.rh_activos_oficina a; return v_result; end if;
  if v_fuente='resguardos_rh' then select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('rh_activos_oficina',to_jsonb(a),'rh_personal',to_jsonb(p)) order by r.fecha_asignacion desc,r.id desc),'[]'::jsonb) into v_result from public.rh_activos_asignaciones r join public.rh_activos_oficina a on a.id=r.activo_id join public.rh_personal p on p.id=r.personal_id; return v_result; end if;
  raise exception using errcode='42501',message='Fuente no autorizada para Skill.';
end; $$;

drop policy if exists skill_reuniones_select_v105 on public.skill_reuniones;
create policy skill_reuniones_select_v105 on public.skill_reuniones for select to authenticated using(
    creador_id=auth.uid() or exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and lower(btrim(coalesce(p.rol,''))) in ('gerente_general','subgerente','sky_demo'))
);

drop policy if exists skill_reunion_intervenciones_select_v105 on public.skill_reunion_intervenciones;
create policy skill_reunion_intervenciones_select_v105 on public.skill_reunion_intervenciones for select to authenticated using(
    exists(select 1 from public.skill_reuniones r where r.id=reunion_id and (r.creador_id=auth.uid() or exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and lower(btrim(coalesce(p.rol,''))) in ('gerente_general','subgerente','sky_demo'))))
);

create or replace function public.crm_skill_reuniones_listar_v105(p_limite integer default 20)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_role text;v_limit integer:=least(100,greatest(1,coalesce(p_limite,20)));v_result jsonb:='[]'::jsonb;
begin
    if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
    select lower(btrim(coalesce(p.rol,''))) into v_role from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true;
    if v_role is null or v_role='' then raise exception using errcode='42501',message='Tu perfil no está activo para SKILL Reuniones.'; end if;
    select coalesce(jsonb_agg(x.item order by x.creado_at desc),'[]'::jsonb) into v_result
    from(
        select r.creado_at,jsonb_build_object('id',r.id,'titulo',r.titulo,'perfil',r.perfil,'participantes',r.participantes,'inicio_at',r.inicio_at,'fin_at',r.fin_at,'duracion_seg',r.duracion_seg,'resumen',r.resumen,'acuerdos',r.acuerdos,'estado',r.estado,'creado_at',r.creado_at,'creador_id',r.creador_id,'intervenciones',(select count(*) from public.skill_reunion_intervenciones i where i.reunion_id=r.id)) item
        from public.skill_reuniones r
        where r.creador_id=auth.uid() or v_role in ('gerente_general','subgerente','sky_demo')
        order by r.creado_at desc limit v_limit
    ) x;
    return coalesce(v_result,'[]'::jsonb);
end;
$$;
revoke all on function public.crm_skill_reuniones_listar_v105(integer) from public,anon;
grant execute on function public.crm_skill_reuniones_listar_v105(integer) to authenticated;

create or replace function public.co_datos_envio_orden_v138(p_orden text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_order text:=btrim(coalesce(p_orden,''));v_profile public.perfiles_usuario%rowtype;v_first public.solicitudes_compra%rowtype;v_provider public.co_proveedores%rowtype;v_signatures integer:=0;v_missing text[]:=array[]::text[];v_method text;v_terms text;v_last_signature timestamptz;
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  select * into v_profile from public.perfiles_usuario where id=auth.uid() and activo=true;
  if not found or lower(coalesce(v_profile.rol,'')) not in ('administrador','compras') then raise exception using errcode='42501',message='Solo Compras o Administrador puede enviar órdenes de compra.'; end if;
  if v_order='' then raise exception 'Orden no válida.'; end if;
  select * into v_first from public.solicitudes_compra s where lower(btrim(coalesce(s.orden_compra,'')))=lower(v_order) or lower(btrim(coalesce(s.grupo_orden,'')))=lower(v_order) order by s.id limit 1;
  if not found then raise exception 'No se encontró la orden de compra.'; end if;
  select count(distinct f.tipo),max(f.firmado_at) into v_signatures,v_last_signature from public.co_orden_firmas f where lower(btrim(f.orden_compra))=lower(v_order) and f.tipo in ('solicito','elaboro','reviso','aprobo') and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null;
  v_method:=btrim(coalesce(v_first.metodo_pago,''));v_terms:=btrim(coalesce(v_first.condiciones_pago,''));
  if v_first.proveedor_id is not null then select * into v_provider from public.co_proveedores where id=v_first.proveedor_id; end if;
  if v_provider.id is null and nullif(btrim(coalesce(v_first.proveedor,'')),'') is not null then select * into v_provider from public.co_proveedores p where lower(btrim(coalesce(p.nombre_comercial,p.razon_social,'')))=lower(btrim(v_first.proveedor)) or lower(btrim(coalesce(p.razon_social,'')))=lower(btrim(v_first.proveedor)) order by p.id limit 1; end if;
  if v_signatures<4 then v_missing:=array_append(v_missing,'Faltan firmas de autorización.'); end if;
  if v_method='' then v_missing:=array_append(v_missing,'Falta especificar el método de pago.'); end if;
  if nullif(btrim(coalesce(v_first.pdf_url,'')),'') is null and nullif(btrim(coalesce(v_first.pdf_path,'')),'') is null then v_missing:=array_append(v_missing,'Falta generar el PDF final de la orden.'); end if;
  if v_last_signature is not null and (v_first.pdf_firma_revision_at is null or v_first.pdf_firma_revision_at<v_last_signature) then v_missing:=array_append(v_missing,'El PDF final no corresponde a las firmas vigentes.'); end if;
  if nullif(btrim(coalesce(v_first.proveedor,'')),'') is null then v_missing:=array_append(v_missing,'Falta definir el proveedor.'); end if;
  if nullif(btrim(coalesce(v_provider.email,'')),'') is null and nullif(btrim(coalesce(v_provider.whatsapp,'')),'') is null and nullif(btrim(coalesce(v_provider.telefono,'')),'') is null then v_missing:=array_append(v_missing,'El proveedor no tiene correo ni teléfono/WhatsApp registrado.'); end if;
  return jsonb_build_object('ok',true,'lista',cardinality(v_missing)=0,'orden_compra',v_order,'firmas',v_signatures,'metodo_pago',v_method,'condiciones_pago',v_terms,'proveedor_id',v_first.proveedor_id,'proveedor',coalesce(nullif(btrim(v_provider.nombre_comercial),''),nullif(btrim(v_provider.razon_social),''),v_first.proveedor,''),'contacto',coalesce(nullif(btrim(v_provider.contacto),''),v_first.contacto_proveedor,''),'email',coalesce(v_provider.email,''),'telefono',coalesce(v_provider.telefono,''),'whatsapp',coalesce(nullif(btrim(v_provider.whatsapp),''),v_provider.telefono,''),'pdf_url',coalesce(v_first.pdf_url,''),'pdf_path',coalesce(v_first.pdf_path,''),'pdf_nombre',coalesce(v_first.pdf_nombre,''),'pdf_firma_revision_at',v_first.pdf_firma_revision_at,'orden_enviada_at',v_first.orden_enviada_at,'orden_envio_canal',coalesce(v_first.orden_envio_canal,''),'orden_envio_destinatario',coalesce(v_first.orden_envio_destinatario,''),'faltantes',to_jsonb(v_missing));
end;
$$;

create or replace function public.co_marcar_orden_enviada_v138(p_orden text,p_canal text default 'manual',p_destinatario text default null,p_message_id text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_order text:=btrim(coalesce(p_orden,''));v_profile public.perfiles_usuario%rowtype;v_ready jsonb;v_missing text;v_count integer:=0;v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  select * into v_profile from public.perfiles_usuario where id=auth.uid() and activo=true;
  if not found or lower(coalesce(v_profile.rol,'')) not in ('administrador','compras') then raise exception using errcode='42501',message='Solo Compras o Administrador puede registrar el envío de una orden.'; end if;
  if v_order='' then raise exception 'Orden no válida.'; end if;
  v_ready:=public.co_datos_envio_orden_v138(v_order);
  if not coalesce((v_ready->>'lista')::boolean,false) then
      select string_agg(value,' ') into v_missing from jsonb_array_elements_text(coalesce(v_ready->'faltantes','[]'::jsonb));
      raise exception 'La orden todavía no está lista para enviarse: %',coalesce(v_missing,'Revisa firmas, pago, PDF y datos del proveedor.');
  end if;
  update public.solicitudes_compra set orden_enviada_at=v_now,orden_enviada_por=auth.uid(),orden_envio_canal=nullif(btrim(coalesce(p_canal,'')),''),orden_envio_destinatario=nullif(btrim(coalesce(p_destinatario,'')),''),orden_envio_message_id=nullif(btrim(coalesce(p_message_id,'')),''),estado=case when estado in ('recibida','cancelada') then estado else 'ordenada' end,estado_compras=case when estado_compras='no_viable' then estado_compras else 'compra_realizada' end,fecha_compra=coalesce(fecha_compra,current_date),updated_at=v_now where lower(btrim(coalesce(orden_compra,'')))=lower(v_order) or lower(btrim(coalesce(grupo_orden,'')))=lower(v_order);
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'No se encontró la orden de compra.'; end if;
  return jsonb_build_object('ok',true,'orden_compra',v_order,'actualizados',v_count,'enviada_at',v_now,'canal',p_canal,'destinatario',p_destinatario,'message_id',p_message_id);
end;
$$;
revoke all on function public.co_datos_envio_orden_v138(text) from public,anon;
revoke all on function public.co_marcar_orden_enviada_v138(text,text,text,text) from public,anon;
grant execute on function public.co_datos_envio_orden_v138(text) to authenticated;
grant execute on function public.co_marcar_orden_enviada_v138(text,text,text,text) to authenticated;

create or replace function public.co_validar_moneda_unica_orden_v144()
returns trigger
language plpgsql
set search_path=public
as $$
declare
    v_order text:=lower(btrim(coalesce(nullif(new.orden_compra,''),nullif(new.grupo_orden,''),'')));
    v_currency text:=case upper(btrim(coalesce(new.moneda,'MXN'))) when 'USD' then 'USD' when 'EUR' then 'EUR' else 'MXN' end;
begin
    new.moneda:=v_currency;
    if v_order='' then return new; end if;
    if exists(
        select 1 from public.solicitudes_compra s
        where (new.id is null or s.id<>new.id)
          and lower(btrim(coalesce(nullif(s.orden_compra,''),nullif(s.grupo_orden,''),'')))=v_order
          and case upper(btrim(coalesce(s.moneda,'MXN'))) when 'USD' then 'USD' when 'EUR' then 'EUR' else 'MXN' end<>v_currency
    ) then
        raise exception using errcode='22023',message='Una orden de compra debe usar una sola moneda. Separa MXN, USD y EUR en órdenes distintas.';
    end if;
    return new;
end;
$$;
drop trigger if exists trg_co_moneda_unica_orden_v144 on public.solicitudes_compra;
create trigger trg_co_moneda_unica_orden_v144 before insert or update of orden_compra,grupo_orden,moneda on public.solicitudes_compra for each row execute function public.co_validar_moneda_unica_orden_v144();
drop trigger if exists trg_co_moneda_unica_orden_v144_check on public.solicitudes_compra;
create trigger trg_co_moneda_unica_orden_v144_check after insert or update of orden_compra,grupo_orden,moneda on public.solicitudes_compra for each row execute function public.co_validar_moneda_unica_orden_v144();

create or replace function public.crm_listar_usuarios_v144()
returns table(id uuid,correo text,nombre text,puesto text,departamento text,rol text,activo boolean,email_confirmado_at timestamptz,ultimo_acceso timestamptz,fecha_alta timestamptz)
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
    if auth.uid() is null or not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and lower(btrim(coalesce(p.rol,'')))='administrador') then
        raise exception using errcode='42501',message='Solo Administrador puede consultar la lista completa de usuarios.';
    end if;
    return query
    select u.id,u.email::text,coalesce(p.nombre,''),coalesce(p.puesto,''),coalesce(p.departamento,''),coalesce(p.rol,''),coalesce(p.activo,false),u.email_confirmed_at,u.last_sign_in_at,u.created_at
    from auth.users u left join public.perfiles_usuario p on p.id=u.id
    order by lower(coalesce(p.nombre,u.email,''));
end;
$$;
revoke all on function public.crm_listar_usuarios_v144() from public,anon;
grant execute on function public.crm_listar_usuarios_v144() to authenticated;

insert into public.crm_migraciones(version,aplicada_at) values('CRM-V137-DIRECCION-HISTORIAL-OC-2026-08-25',now()) on conflict(version) do update set aplicada_at=excluded.aplicada_at;
insert into public.crm_migraciones(version,aplicada_at) values('CRM-V144-RH-IMPORTACION-OC-PDF-SEGURIDAD-Y-CACHE-2026-08-26',now()) on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select 'OK' as estado,'CRM-V144-RH-IMPORTACION-OC-PDF-SEGURIDAD-Y-CACHE-2026-08-26' as revision,
       case when to_regprocedure('public.rh_importar_activos_resguardos_v144(jsonb,jsonb)') is not null then 'OK' else 'FALTA' end as importar_rh,
       case when to_regprocedure('public.co_datos_envio_orden_v138(text)') is not null then 'OK' else 'FALTA' end as envio_oc,
       case when to_regprocedure('public.crm_skill_perfil_consultar_v136(text,text)') is not null then 'OK' else 'FALTA' end as skill_perfil;
