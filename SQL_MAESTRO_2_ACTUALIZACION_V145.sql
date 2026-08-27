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

begin;

alter table public.vehiculos add column if not exists apodo text;
alter table public.vehiculos add column if not exists ubicacion_base_tipo text;
alter table public.vehiculos add column if not exists ubicacion_base_referencia text;
alter table public.vehiculos add column if not exists ubicacion_base_nombre text;
alter table public.vehiculos add column if not exists aviso_seguro_dias integer not null default 30;

update public.vehiculos
set ubicacion_base_tipo=case when almacen_base_id is not null then 'almacen' else ubicacion_base_tipo end,
    ubicacion_base_referencia=case when almacen_base_id is not null then almacen_base_id::text else ubicacion_base_referencia end
where ubicacion_base_tipo is null and almacen_base_id is not null;

update public.vehiculos v
set ubicacion_base_nombre=a.nombre
from public.almacenes a
where v.almacen_base_id=a.id and nullif(btrim(coalesce(v.ubicacion_base_nombre,'')),'') is null;

alter table public.vehiculos drop constraint if exists vehiculos_aviso_seguro_dias_check;
alter table public.vehiculos add constraint vehiculos_aviso_seguro_dias_check check(aviso_seguro_dias between 1 and 180);


create table if not exists public.vehiculos_ubicaciones_base(
    id bigint generated by default as identity primary key,
    tipo text not null default 'sede',
    nombre text not null,
    direccion text,
    notas text,
    activo boolean not null default true,
    creado_por uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint vehiculos_ubicaciones_base_tipo_check check(tipo in ('sede','oficina','taller','patio','otra'))
);
create unique index if not exists vehiculos_ubicaciones_base_tipo_nombre_uidx on public.vehiculos_ubicaciones_base(tipo,lower(btrim(nombre)));
alter table public.vehiculos_ubicaciones_base enable row level security;
drop policy if exists vehiculos_ubicaciones_base_lectura_v145 on public.vehiculos_ubicaciones_base;
drop policy if exists vehiculos_ubicaciones_base_escritura_v145 on public.vehiculos_ubicaciones_base;
create policy vehiculos_ubicaciones_base_lectura_v145 on public.vehiculos_ubicaciones_base for select to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh','finanzas','gerente_general','subgerente','coordinacion','logistica'])
);
create policy vehiculos_ubicaciones_base_escritura_v145 on public.vehiculos_ubicaciones_base for all to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
) with check(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
);
grant select,insert,update,delete on public.vehiculos_ubicaciones_base to authenticated;

create or replace function public.crm_guardar_ubicacion_base_vehiculo_v145(p_tipo text,p_nombre text,p_direccion text default null,p_notas text default null)
returns public.vehiculos_ubicaciones_base
language plpgsql
security definer
set search_path=public,auth
as $$
declare
    v_tipo text:=lower(btrim(coalesce(p_tipo,'')));
    v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
    v_result public.vehiculos_ubicaciones_base%rowtype;
begin
    if auth.uid() is null or not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh']) then
        raise exception using errcode='42501',message='Tu perfil no puede administrar ubicaciones base de vehículos.';
    end if;
    if v_tipo not in ('sede','oficina','taller','patio','otra') then raise exception 'Tipo de ubicación base no válido.'; end if;
    if v_nombre is null then raise exception 'Indica el nombre de la ubicación base.'; end if;
    select * into v_result
    from public.vehiculos_ubicaciones_base x
    where x.tipo=v_tipo and lower(btrim(x.nombre))=lower(v_nombre)
    order by x.id limit 1 for update;
    if found then
        update public.vehiculos_ubicaciones_base set
            nombre=v_nombre,
            direccion=coalesce(nullif(btrim(coalesce(p_direccion,'')),''),direccion),
            notas=coalesce(nullif(btrim(coalesce(p_notas,'')),''),notas),
            activo=true,
            updated_at=now()
        where id=v_result.id returning * into v_result;
    else
        insert into public.vehiculos_ubicaciones_base(tipo,nombre,direccion,notas,activo,creado_por,updated_at)
        values(v_tipo,v_nombre,nullif(btrim(coalesce(p_direccion,'')),''),nullif(btrim(coalesce(p_notas,'')),''),true,auth.uid(),now())
        returning * into v_result;
    end if;
    return v_result;
end;
$$;
revoke all on function public.crm_guardar_ubicacion_base_vehiculo_v145(text,text,text,text) from public,anon;
grant execute on function public.crm_guardar_ubicacion_base_vehiculo_v145(text,text,text,text) to authenticated;

create table if not exists public.vehiculos_mantenimiento_planes(
    id bigint generated by default as identity primary key,
    vehiculo_id bigint not null references public.vehiculos(id) on update cascade on delete cascade,
    nombre text not null,
    tipo text not null default 'preventivo',
    criterio text not null default 'kilometraje',
    proximo_km numeric,
    proxima_fecha date,
    aviso_km numeric not null default 500,
    aviso_dias integer not null default 15,
    intervalo_km numeric,
    intervalo_dias integer,
    prioridad text not null default 'normal',
    proveedor_sugerido text,
    notas text,
    activo boolean not null default true,
    creado_por uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint vehiculos_mantenimiento_tipo_check check(tipo in ('preventivo','correctivo','reparacion','aceite','llantas','frenos','suspension','electrico','verificacion','afinacion','otro')),
    constraint vehiculos_mantenimiento_criterio_check check(criterio in ('kilometraje','fecha','ambos','manual')),
    constraint vehiculos_mantenimiento_prioridad_check check(prioridad in ('baja','normal','alta','critica')),
    constraint vehiculos_mantenimiento_numeros_check check(coalesce(proximo_km,0)>=0 and aviso_km>=0 and coalesce(intervalo_km,0)>=0 and aviso_dias>=0 and coalesce(intervalo_dias,0)>=0)
);

create table if not exists public.vehiculos_mantenimiento_historial(
    id bigint generated by default as identity primary key,
    vehiculo_id bigint not null references public.vehiculos(id) on update cascade on delete cascade,
    plan_id bigint references public.vehiculos_mantenimiento_planes(id) on update cascade on delete set null,
    tipo text not null default 'preventivo',
    descripcion text not null,
    fecha date not null default current_date,
    odometro numeric,
    proveedor text,
    costo numeric not null default 0,
    comprobante text,
    resultado text,
    notas text,
    creado_por uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint vehiculos_mantenimiento_historial_costo_check check(costo>=0),
    constraint vehiculos_mantenimiento_historial_odometro_check check(odometro is null or odometro>=0)
);

create index if not exists vehiculos_mantenimiento_planes_vehiculo_idx on public.vehiculos_mantenimiento_planes(vehiculo_id,activo);
create index if not exists vehiculos_mantenimiento_planes_fecha_idx on public.vehiculos_mantenimiento_planes(proxima_fecha) where activo=true;
create index if not exists vehiculos_mantenimiento_planes_km_idx on public.vehiculos_mantenimiento_planes(proximo_km) where activo=true;
create index if not exists vehiculos_mantenimiento_historial_vehiculo_idx on public.vehiculos_mantenimiento_historial(vehiculo_id,fecha desc);

alter table public.vehiculos_mantenimiento_planes enable row level security;
alter table public.vehiculos_mantenimiento_historial enable row level security;

drop policy if exists vehiculos_mantenimiento_planes_lectura_v145 on public.vehiculos_mantenimiento_planes;
drop policy if exists vehiculos_mantenimiento_planes_escritura_v145 on public.vehiculos_mantenimiento_planes;
drop policy if exists vehiculos_mantenimiento_historial_lectura_v145 on public.vehiculos_mantenimiento_historial;
drop policy if exists vehiculos_mantenimiento_historial_escritura_v145 on public.vehiculos_mantenimiento_historial;

create policy vehiculos_mantenimiento_planes_lectura_v145 on public.vehiculos_mantenimiento_planes for select to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh','finanzas','gerente_general','subgerente'])
);
create policy vehiculos_mantenimiento_planes_escritura_v145 on public.vehiculos_mantenimiento_planes for all to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
) with check(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
);
create policy vehiculos_mantenimiento_historial_lectura_v145 on public.vehiculos_mantenimiento_historial for select to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh','finanzas','gerente_general','subgerente'])
);
create policy vehiculos_mantenimiento_historial_escritura_v145 on public.vehiculos_mantenimiento_historial for all to authenticated using(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
) with check(
    public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh'])
);

grant select,insert,update,delete on public.vehiculos_mantenimiento_planes to authenticated;
grant select,insert,update,delete on public.vehiculos_mantenimiento_historial to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create or replace function public.crm_guardar_vehiculo(
    p_id bigint default null,
    p_datos jsonb default '{}'::jsonb
)
returns public.vehiculos
language plpgsql
security definer
set search_path=public
as $$
declare
    v_result public.vehiculos%rowtype;
    v_numero text:=btrim(coalesce(p_datos->>'numero_economico',''));
    v_marca text:=btrim(coalesce(p_datos->>'marca',''));
    v_modelo text:=btrim(coalesce(p_datos->>'modelo',''));
    v_base_tipo text:=lower(btrim(coalesce(p_datos->>'ubicacion_base_tipo','')));
    v_aviso_seguro integer:=greatest(1,least(180,coalesce(nullif(p_datos->>'aviso_seguro_dias','')::integer,30)));
begin
    if auth.uid() is not null and not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh']) then
        raise exception using errcode='42501',message='Tu perfil no tiene permiso para guardar o editar vehículos.';
    end if;
    if v_numero='' then raise exception 'El nombre del vehículo es obligatorio.'; end if;
    if v_marca='' or v_modelo='' then raise exception 'Marca y modelo son obligatorios.'; end if;
    if v_base_tipo not in ('','almacen','proyecto','sede','oficina','taller','patio','otra') then raise exception 'El tipo de ubicación base no es válido.'; end if;

    if coalesce(p_id,0)=0 then
        insert into public.vehiculos(
            numero_economico,apodo,placas,vin,marca,modelo,anio,tipo,color,combustible,transmision,
            capacidad_carga,capacidad_personas,distribucion_asientos,kilometraje,propiedad,estado,
            almacen_base_id,ubicacion_base_tipo,ubicacion_base_referencia,ubicacion_base_nombre,proyecto,asignado_a,responsable,
            aseguradora,poliza_seguro,vigencia_seguro,aviso_seguro_dias,tarjeta_circulacion,vigencia_tarjeta,
            proxima_verificacion,fecha_adquisicion,costo_adquisicion,imagen_url,notas,activo,created_at,updated_at
        ) values(
            v_numero,nullif(btrim(coalesce(p_datos->>'apodo','')),''),nullif(upper(btrim(coalesce(p_datos->>'placas',''))),''),nullif(upper(btrim(coalesce(p_datos->>'vin',''))),''),
            v_marca,v_modelo,nullif(p_datos->>'anio','')::integer,coalesce(nullif(p_datos->>'tipo',''),'pickup'),nullif(p_datos->>'color',''),nullif(p_datos->>'combustible',''),nullif(p_datos->>'transmision',''),
            greatest(0,coalesce(nullif(p_datos->>'capacidad_carga','')::numeric,0)),greatest(0,coalesce(nullif(p_datos->>'capacidad_personas','')::integer,0)),coalesce(p_datos->'distribucion_asientos','{"version":1,"filas":[]}'::jsonb),
            greatest(0,coalesce(nullif(p_datos->>'kilometraje','')::numeric,0)),coalesce(nullif(p_datos->>'propiedad',''),'empresa'),coalesce(nullif(p_datos->>'estado',''),'disponible'),
            nullif(p_datos->>'almacen_base_id','')::bigint,nullif(v_base_tipo,''),nullif(btrim(coalesce(p_datos->>'ubicacion_base_referencia','')),''),nullif(btrim(coalesce(p_datos->>'ubicacion_base_nombre','')),''),
            nullif(p_datos->>'proyecto',''),nullif(p_datos->>'asignado_a',''),nullif(p_datos->>'responsable',''),nullif(p_datos->>'aseguradora',''),nullif(p_datos->>'poliza_seguro',''),nullif(p_datos->>'vigencia_seguro','')::date,v_aviso_seguro,
            nullif(p_datos->>'tarjeta_circulacion',''),nullif(p_datos->>'vigencia_tarjeta','')::date,nullif(p_datos->>'proxima_verificacion','')::date,nullif(p_datos->>'fecha_adquisicion','')::date,
            greatest(0,coalesce(nullif(p_datos->>'costo_adquisicion','')::numeric,0)),nullif(p_datos->>'imagen_url',''),nullif(p_datos->>'notas',''),coalesce(nullif(p_datos->>'activo','')::boolean,true),now(),now()
        ) returning * into v_result;
    else
        update public.vehiculos set
            numero_economico=v_numero,apodo=nullif(btrim(coalesce(p_datos->>'apodo','')),''),placas=nullif(upper(btrim(coalesce(p_datos->>'placas',''))),''),vin=nullif(upper(btrim(coalesce(p_datos->>'vin',''))),''),
            marca=v_marca,modelo=v_modelo,anio=nullif(p_datos->>'anio','')::integer,tipo=coalesce(nullif(p_datos->>'tipo',''),'pickup'),color=nullif(p_datos->>'color',''),combustible=nullif(p_datos->>'combustible',''),transmision=nullif(p_datos->>'transmision',''),
            capacidad_carga=greatest(0,coalesce(nullif(p_datos->>'capacidad_carga','')::numeric,0)),capacidad_personas=greatest(0,coalesce(nullif(p_datos->>'capacidad_personas','')::integer,0)),distribucion_asientos=coalesce(p_datos->'distribucion_asientos','{"version":1,"filas":[]}'::jsonb),
            kilometraje=greatest(0,coalesce(nullif(p_datos->>'kilometraje','')::numeric,0)),propiedad=coalesce(nullif(p_datos->>'propiedad',''),'empresa'),estado=coalesce(nullif(p_datos->>'estado',''),'disponible'),
            almacen_base_id=nullif(p_datos->>'almacen_base_id','')::bigint,ubicacion_base_tipo=nullif(v_base_tipo,''),ubicacion_base_referencia=nullif(btrim(coalesce(p_datos->>'ubicacion_base_referencia','')),''),ubicacion_base_nombre=nullif(btrim(coalesce(p_datos->>'ubicacion_base_nombre','')),''),
            proyecto=nullif(p_datos->>'proyecto',''),asignado_a=nullif(p_datos->>'asignado_a',''),responsable=nullif(p_datos->>'responsable',''),aseguradora=nullif(p_datos->>'aseguradora',''),poliza_seguro=nullif(p_datos->>'poliza_seguro',''),
            vigencia_seguro=nullif(p_datos->>'vigencia_seguro','')::date,aviso_seguro_dias=v_aviso_seguro,tarjeta_circulacion=nullif(p_datos->>'tarjeta_circulacion',''),vigencia_tarjeta=nullif(p_datos->>'vigencia_tarjeta','')::date,
            proxima_verificacion=nullif(p_datos->>'proxima_verificacion','')::date,fecha_adquisicion=nullif(p_datos->>'fecha_adquisicion','')::date,costo_adquisicion=greatest(0,coalesce(nullif(p_datos->>'costo_adquisicion','')::numeric,0)),
            imagen_url=nullif(p_datos->>'imagen_url',''),notas=nullif(p_datos->>'notas',''),activo=coalesce(nullif(p_datos->>'activo','')::boolean,activo),updated_at=now()
        where id=p_id returning * into v_result;
        if not found then raise exception 'No existe el vehículo con ID %.',p_id; end if;
    end if;
    return v_result;
exception when unique_violation then
    raise exception using errcode='23505',message='El nombre del vehículo, las placas o el VIN ya están registrados.';
end;
$$;
revoke all on function public.crm_guardar_vehiculo(bigint,jsonb) from public,anon;
grant execute on function public.crm_guardar_vehiculo(bigint,jsonb) to authenticated,service_role;

create or replace function public.crm_guardar_mantenimiento_vehiculo_v145(p_id bigint default null,p_datos jsonb default '{}'::jsonb)
returns public.vehiculos_mantenimiento_planes
language plpgsql
security definer
set search_path=public
as $$
declare
    v_result public.vehiculos_mantenimiento_planes%rowtype;
    v_vehicle bigint:=coalesce(nullif(p_datos->>'vehiculo_id','')::bigint,0);
    v_name text:=btrim(coalesce(p_datos->>'nombre',''));
    v_tipo text:=lower(btrim(coalesce(p_datos->>'tipo','preventivo')));
    v_criterio text:=lower(btrim(coalesce(p_datos->>'criterio','kilometraje')));
    v_priority text:=lower(btrim(coalesce(p_datos->>'prioridad','normal')));
begin
    if auth.uid() is not null and not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh']) then raise exception using errcode='42501',message='Tu perfil no puede programar mantenimientos.'; end if;
    if v_vehicle<=0 or not exists(select 1 from public.vehiculos where id=v_vehicle) then raise exception 'Selecciona un vehículo válido.'; end if;
    if v_name='' then raise exception 'Captura el mantenimiento o reparación requerida.'; end if;
    if v_tipo not in ('preventivo','correctivo','reparacion','aceite','llantas','frenos','suspension','electrico','verificacion','afinacion','otro') then raise exception 'Selecciona un tipo de mantenimiento válido.'; end if;
    if v_criterio not in ('kilometraje','fecha','ambos','manual') then raise exception 'Selecciona un criterio de aviso válido.'; end if;
    if v_priority not in ('baja','normal','alta','critica') then v_priority:='normal'; end if;
    if v_criterio in ('kilometraje','ambos') and coalesce(nullif(p_datos->>'proximo_km','')::numeric,0)<=0 then raise exception 'Indica el kilometraje al que debe realizarse el mantenimiento.'; end if;
    if v_criterio in ('fecha','ambos') and nullif(p_datos->>'proxima_fecha','') is null then raise exception 'Indica la fecha programada del mantenimiento.'; end if;

    if coalesce(p_id,0)>0 then
        update public.vehiculos_mantenimiento_planes set
            vehiculo_id=v_vehicle,nombre=v_name,tipo=v_tipo,criterio=v_criterio,
            proximo_km=nullif(p_datos->>'proximo_km','')::numeric,proxima_fecha=nullif(p_datos->>'proxima_fecha','')::date,
            aviso_km=greatest(0,coalesce(nullif(p_datos->>'aviso_km','')::numeric,500)),aviso_dias=greatest(0,coalesce(nullif(p_datos->>'aviso_dias','')::integer,15)),
            intervalo_km=nullif(p_datos->>'intervalo_km','')::numeric,intervalo_dias=nullif(p_datos->>'intervalo_dias','')::integer,
            prioridad=v_priority,proveedor_sugerido=nullif(btrim(coalesce(p_datos->>'proveedor_sugerido','')),''),notas=nullif(btrim(coalesce(p_datos->>'notas','')),''),
            activo=coalesce(nullif(p_datos->>'activo','')::boolean,true),updated_at=now()
        where id=p_id returning * into v_result;
        if not found then raise exception 'El mantenimiento seleccionado ya no existe.'; end if;
    else
        insert into public.vehiculos_mantenimiento_planes(vehiculo_id,nombre,tipo,criterio,proximo_km,proxima_fecha,aviso_km,aviso_dias,intervalo_km,intervalo_dias,prioridad,proveedor_sugerido,notas,activo,creado_por)
        values(v_vehicle,v_name,v_tipo,v_criterio,nullif(p_datos->>'proximo_km','')::numeric,nullif(p_datos->>'proxima_fecha','')::date,greatest(0,coalesce(nullif(p_datos->>'aviso_km','')::numeric,500)),greatest(0,coalesce(nullif(p_datos->>'aviso_dias','')::integer,15)),nullif(p_datos->>'intervalo_km','')::numeric,nullif(p_datos->>'intervalo_dias','')::integer,v_priority,nullif(btrim(coalesce(p_datos->>'proveedor_sugerido','')),''),nullif(btrim(coalesce(p_datos->>'notas','')),''),coalesce(nullif(p_datos->>'activo','')::boolean,true),auth.uid())
        returning * into v_result;
    end if;
    return v_result;
end;
$$;
revoke all on function public.crm_guardar_mantenimiento_vehiculo_v145(bigint,jsonb) from public,anon;
grant execute on function public.crm_guardar_mantenimiento_vehiculo_v145(bigint,jsonb) to authenticated;

create or replace function public.crm_completar_mantenimiento_vehiculo_v145(p_id bigint,p_datos jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_plan public.vehiculos_mantenimiento_planes%rowtype;
    v_vehicle public.vehiculos%rowtype;
    v_fecha date:=coalesce(nullif(p_datos->>'fecha','')::date,current_date);
    v_km numeric;
    v_hist_id bigint;
    v_next_km numeric;
    v_next_date date;
    v_recurring boolean:=false;
begin
    if auth.uid() is not null and not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh']) then raise exception using errcode='42501',message='Tu perfil no puede completar mantenimientos.'; end if;
    select * into v_plan from public.vehiculos_mantenimiento_planes where id=p_id for update;
    if not found then raise exception 'El mantenimiento seleccionado ya no existe.'; end if;
    select * into v_vehicle from public.vehiculos where id=v_plan.vehiculo_id for update;
    if not found then raise exception 'El vehículo del mantenimiento ya no existe.'; end if;
    v_km:=greatest(coalesce(v_vehicle.kilometraje,0),coalesce(nullif(p_datos->>'odometro','')::numeric,coalesce(v_vehicle.kilometraje,0)));

    insert into public.vehiculos_mantenimiento_historial(vehiculo_id,plan_id,tipo,descripcion,fecha,odometro,proveedor,costo,comprobante,resultado,notas,creado_por)
    values(v_plan.vehiculo_id,v_plan.id,v_plan.tipo,v_plan.nombre,v_fecha,v_km,nullif(btrim(coalesce(p_datos->>'proveedor','')),''),greatest(0,coalesce(nullif(p_datos->>'costo','')::numeric,0)),nullif(btrim(coalesce(p_datos->>'comprobante','')),''),nullif(btrim(coalesce(p_datos->>'resultado','')),''),nullif(btrim(coalesce(p_datos->>'notas','')),''),auth.uid())
    returning id into v_hist_id;

    if v_km>coalesce(v_vehicle.kilometraje,0) then update public.vehiculos set kilometraje=v_km,updated_at=now() where id=v_vehicle.id; end if;
    if coalesce(v_plan.intervalo_km,0)>0 then v_next_km:=v_km+v_plan.intervalo_km;v_recurring:=true; end if;
    if coalesce(v_plan.intervalo_dias,0)>0 then v_next_date:=v_fecha+v_plan.intervalo_dias;v_recurring:=true; end if;

    if v_recurring then
        update public.vehiculos_mantenimiento_planes set proximo_km=v_next_km,proxima_fecha=v_next_date,activo=true,updated_at=now() where id=v_plan.id;
    else
        update public.vehiculos_mantenimiento_planes set activo=false,updated_at=now() where id=v_plan.id;
    end if;
    return jsonb_build_object('ok',true,'historial_id',v_hist_id,'plan_id',v_plan.id,'recurrente',v_recurring,'proximo_km',v_next_km,'proxima_fecha',v_next_date);
end;
$$;
revoke all on function public.crm_completar_mantenimiento_vehiculo_v145(bigint,jsonb) from public,anon;
grant execute on function public.crm_completar_mantenimiento_vehiculo_v145(bigint,jsonb) to authenticated;

create or replace function public.crm_generar_alertas_vehiculos_v145()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
    v_count integer:=0;
    v_row record;
    v_message text;
begin
    if auth.uid() is not null and not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','rh','finanzas','gerente_general','subgerente']) then return 0; end if;
    for v_row in
        select v.id,v.numero_economico,v.apodo,v.aseguradora,v.vigencia_seguro,v.aviso_seguro_dias
        from public.vehiculos v
        where v.activo=true and v.vigencia_seguro is not null and v.vigencia_seguro<=current_date+greatest(1,least(180,coalesce(v.aviso_seguro_dias,30)))
    loop
        if not exists(select 1 from public.notificaciones_sistema n where n.tipo='vehiculo_seguro_vencimiento' and n.entidad_id=v_row.id and (n.leida=false or n.created_at::date=current_date)) then
            v_message:=case when v_row.vigencia_seguro<current_date then 'Seguro vencido el ' else 'Seguro próximo a vencer el ' end||to_char(v_row.vigencia_seguro,'DD/MM/YYYY')||case when nullif(btrim(coalesce(v_row.aseguradora,'')),'') is not null then ' · '||v_row.aseguradora else '' end;
            insert into public.notificaciones_sistema(tipo,titulo,mensaje,entidad_id,leida) values('vehiculo_seguro_vencimiento','Seguro · '||v_row.numero_economico||coalesce(' ('||nullif(v_row.apodo,'')||')',''),v_message,v_row.id,false);
            v_count:=v_count+1;
        end if;
    end loop;

    for v_row in
        select p.*,v.numero_economico,v.apodo,v.kilometraje
        from public.vehiculos_mantenimiento_planes p join public.vehiculos v on v.id=p.vehiculo_id
        where p.activo=true and v.activo=true and (
            (p.proximo_km is not null and coalesce(v.kilometraje,0)>=greatest(0,p.proximo_km-coalesce(p.aviso_km,0))) or
            (p.proxima_fecha is not null and p.proxima_fecha<=current_date+coalesce(p.aviso_dias,0)) or
            (p.criterio='manual' and p.prioridad in ('alta','critica'))
        )
    loop
        if not exists(select 1 from public.notificaciones_sistema n where n.tipo='vehiculo_mantenimiento' and n.entidad_id=v_row.id and (n.leida=false or n.created_at::date=current_date)) then
            v_message:=v_row.nombre||case when v_row.proximo_km is not null then ' · Programado a '||trim(to_char(v_row.proximo_km,'FM999999990'))||' km' else '' end||case when v_row.proxima_fecha is not null then ' · '||to_char(v_row.proxima_fecha,'DD/MM/YYYY') else '' end||' · Odómetro actual '||trim(to_char(coalesce(v_row.kilometraje,0),'FM999999990'))||' km';
            insert into public.notificaciones_sistema(tipo,titulo,mensaje,entidad_id,leida) values('vehiculo_mantenimiento','Mantenimiento · '||v_row.numero_economico||coalesce(' ('||nullif(v_row.apodo,'')||')',''),v_message,v_row.id,false);
            v_count:=v_count+1;
        end if;
    end loop;
    return v_count;
end;
$$;
revoke all on function public.crm_generar_alertas_vehiculos_v145() from public,anon;
grant execute on function public.crm_generar_alertas_vehiculos_v145() to authenticated;


create or replace function public.crm_skill_vehiculos_v145(p_filtro text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
    v_role text;
    v_filter text:=nullif(btrim(coalesce(p_filtro,'')),'');
    v_result jsonb:='[]'::jsonb;
begin
    if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
    select lower(btrim(coalesce(p.rol,''))) into v_role from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true;
    if v_role not in ('administrador','jefe_almacen','almacen','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','sky_demo') then
        raise exception using errcode='42501',message='Tu perfil no puede consultar vehículos mediante Skill.';
    end if;
    select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object(
        'mantenimientos_activos',coalesce((select count(*) from public.vehiculos_mantenimiento_planes mp where mp.vehiculo_id=v.id and mp.activo=true),0),
        'mantenimientos_atencion',coalesce((select count(*) from public.vehiculos_mantenimiento_planes mp where mp.vehiculo_id=v.id and mp.activo=true and ((mp.proximo_km is not null and coalesce(v.kilometraje,0)>=greatest(0,mp.proximo_km-coalesce(mp.aviso_km,0))) or (mp.proxima_fecha is not null and mp.proxima_fecha<=current_date+coalesce(mp.aviso_dias,0)) or (mp.criterio='manual' and mp.prioridad in ('alta','critica')))),0)
    ) order by v.numero_economico),'[]'::jsonb)
    into v_result
    from public.vehiculos v
    where coalesce(v.activo,true)=true
      and (v_filter is null or lower(concat_ws(' ',v.numero_economico,v.apodo,v.placas,v.marca,v.modelo,v.tipo,v.estado,v.proyecto,v.responsable,v.aseguradora,v.poliza_seguro,v.ubicacion_base_tipo,v.ubicacion_base_nombre)) like '%'||lower(v_filter)||'%');
    return coalesce(v_result,'[]'::jsonb);
end;
$$;
revoke all on function public.crm_skill_vehiculos_v145(text) from public,anon;
grant execute on function public.crm_skill_vehiculos_v145(text) to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V145-VEHICULOS-BASE-SEGURO-MANTENIMIENTO-2026-08-27',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select 'OK' as estado,'CRM-V145-VEHICULOS-BASE-SEGURO-MANTENIMIENTO-2026-08-27' as revision,
       case when to_regclass('public.vehiculos_ubicaciones_base') is not null then 'OK' else 'FALTA' end as ubicaciones_base,
       case when to_regclass('public.vehiculos_mantenimiento_planes') is not null then 'OK' else 'FALTA' end as planes_mantenimiento,
       case when to_regprocedure('public.crm_generar_alertas_vehiculos_v145()') is not null then 'OK' else 'FALTA' end as alertas_vehiculos,
       case when to_regprocedure('public.crm_skill_vehiculos_v145(text)') is not null then 'OK' else 'FALTA' end as skill_vehiculos;
