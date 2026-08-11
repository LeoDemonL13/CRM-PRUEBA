begin;

alter table public.perfiles_usuario add column if not exists puesto text;
alter table public.perfiles_usuario add column if not exists departamento text;
alter table if exists public.rh_proyecto_asignaciones add column if not exists porcentaje_dedicacion numeric(5,2) not null default 100;
alter table if exists public.existencias_almacen add column if not exists stock_medio numeric not null default 0;
alter table if exists public.existencias_almacen add column if not exists stock_maximo numeric not null default 0;

alter table public.materiales add column if not exists es_incompleto boolean not null default false;
alter table public.materiales add column if not exists origen_alta text;
alter table public.materiales add column if not exists campos_pendientes text[] not null default '{}';

alter table public.perfiles_usuario drop constraint if exists perfiles_usuario_rol_check;
alter table public.perfiles_usuario add constraint perfiles_usuario_rol_check
check (rol in ('administrador','jefe_almacen','almacen','compras','proyectos','rh','finanzas','gerente_general','subgerente','tsi','consulta'));

create or replace function public.crear_material_incompleto(
    p_codigo text,
    p_descripcion text,
    p_categoria text default null,
    p_unidad text default null,
    p_precio numeric default 0,
    p_origen text default 'alta_manual'
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
    v_codigo text:=btrim(coalesce(p_codigo,''));
    v_descripcion text:=btrim(coalesce(p_descripcion,''));
    v_categoria_raw text:=btrim(coalesce(p_categoria,''));
    v_unidad_raw text:=btrim(coalesce(p_unidad,''));
    v_categoria text:=coalesce(nullif(v_categoria_raw,''),'Sin clasificar');
    v_unidad text:=coalesce(nullif(v_unidad_raw,''),'pieza');
    v_pendientes text[]:=array[]::text[];
begin
    if not public.crm_usuario_tiene_rol(array['administrador','jefe_almacen','almacen','proyectos','compras']) then
        raise exception using errcode='42501',message='Tu perfil no puede crear materiales incompletos.';
    end if;
    if v_codigo='' or v_descripcion='' then raise exception 'Código y descripción son obligatorios.'; end if;
    if exists(select 1 from public.materiales m where lower(btrim(m.codigo))=lower(v_codigo)) then
        select m.codigo into v_codigo from public.materiales m where lower(btrim(m.codigo))=lower(v_codigo) limit 1;
        return v_codigo;
    end if;
    if v_categoria_raw='' then v_pendientes:=array_append(v_pendientes,'categoria'); end if;
    if v_unidad_raw='' then v_pendientes:=array_append(v_pendientes,'unidad'); end if;
    if coalesce(p_precio,0)<=0 then v_pendientes:=array_append(v_pendientes,'precio'); end if;
    v_pendientes:=array_append(v_pendientes,'imagen');
    if to_regclass('public.categorias_materiales') is not null then
        insert into public.categorias_materiales(nombre,activo,updated_at)
        values(v_categoria,true,now())
        on conflict(nombre) do update set activo=true,updated_at=now();
    end if;
    insert into public.materiales(codigo,descripcion,categoria,unidad,precio,imagen_url,es_incompleto,origen_alta,campos_pendientes,activo,updated_at)
    values(v_codigo,v_descripcion,v_categoria,v_unidad,greatest(coalesce(p_precio,0),0),null,true,coalesce(nullif(btrim(coalesce(p_origen,'')),''),'alta_manual'),v_pendientes,true,now());
    return v_codigo;
end;
$$;

revoke all on function public.crear_material_incompleto(text,text,text,text,numeric,text) from public,anon;
grant execute on function public.crear_material_incompleto(text,text,text,text,numeric,text) to authenticated;

create or replace function public.crm_asignar_rol_por_correo(
    p_correo text,
    p_rol text,
    p_activo boolean default true
)
returns public.perfiles_usuario
language plpgsql
security definer
set search_path=public,auth
as $$
declare
    v_usuario_id uuid;
    v_perfil public.perfiles_usuario%rowtype;
    v_jwt_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
begin
    if p_rol not in ('administrador','jefe_almacen','almacen','compras','proyectos','rh','finanzas','gerente_general','subgerente','tsi','consulta') then raise exception 'Rol no válido: %',p_rol; end if;
    if auth.uid() is not null then
        if not public.crm_usuario_tiene_rol(array['administrador']) then raise exception using errcode='42501',message='Solo un administrador activo puede asignar roles.'; end if;
    elsif session_user not in ('postgres','supabase_admin') and v_jwt_role<>'service_role' then
        raise exception using errcode='42501',message='La asignación de roles requiere administrador o service_role.';
    end if;
    select id into v_usuario_id from auth.users where lower(email)=lower(btrim(p_correo)) limit 1;
    if v_usuario_id is null then raise exception 'No existe un usuario con el correo %',p_correo; end if;
    insert into public.perfiles_usuario(id,nombre,rol,activo)
    select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),split_part(u.email,'@',1)),p_rol,p_activo from auth.users u where u.id=v_usuario_id
    on conflict(id) do update set rol=excluded.rol,activo=excluded.activo,updated_at=now()
    returning * into v_perfil;
    return v_perfil;
end;
$$;

revoke all on function public.crm_asignar_rol_por_correo(text,text,boolean) from public,anon;
grant execute on function public.crm_asignar_rol_por_correo(text,text,boolean) to authenticated,service_role;

create or replace function public.crm_sky_direccion_materiales()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
    if auth.uid() is null or not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')) then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('codigo',m.codigo,'descripcion',m.descripcion,'categoria',m.categoria,'tipo_cable',m.tipo_cable,'tamano_mm2',m.tamano_mm2,'unidad',m.unidad,'marca',m.marca,'proveedor',m.proveedor,'modismos',to_jsonb(m.modismos),'stock',coalesce(inv.stock,0),'stock_minimo',coalesce(inv.stock_minimo,0),'stock_medio',coalesce(inv.stock_medio,0),'stock_maximo',coalesce(inv.stock_maximo,0),'almacenes',coalesce(inv.almacenes,'[]'::jsonb)) order by m.codigo),'[]'::jsonb)
    into v_result
    from public.materiales m
    left join lateral(
        select sum(coalesce(e.stock,0))::numeric stock,sum(coalesce(e.stock_minimo,0))::numeric stock_minimo,sum(coalesce(e.stock_medio,0))::numeric stock_medio,sum(coalesce(e.stock_maximo,0))::numeric stock_maximo,
        coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nombre',a.nombre,'stock',coalesce(e.stock,0),'stockMinimo',coalesce(e.stock_minimo,0),'stockMedio',coalesce(e.stock_medio,0),'stockMaximo',coalesce(e.stock_maximo,0),'ubicacion',e.ubicacion) order by a.nombre),'[]'::jsonb) almacenes
        from public.existencias_almacen e left join public.almacenes a on a.id=e.almacen_id where e.material_codigo=m.codigo
    ) inv on true where coalesce(m.activo,true)=true;
    return v_result;
end;
$$;
revoke all on function public.crm_sky_direccion_materiales() from public,anon;
grant execute on function public.crm_sky_direccion_materiales() to authenticated;

create or replace function public.crm_sky_direccion_personal(p_proyecto text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_project text:=nullif(btrim(coalesce(p_proyecto,'')),'');
begin
    if auth.uid() is null or not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')) then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    if v_project is null then
        select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'numero_empleado',rp.numero_empleado,'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),'puesto',rp.puesto,'departamento',rp.departamento,'estado',rp.estado) order by rp.apellidos,rp.nombre),'[]'::jsonb) into v_result from public.rh_personal rp where lower(coalesce(rp.estado,''))='activo';
    else
        select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'numero_empleado',rp.numero_empleado,'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),'puesto',rp.puesto,'departamento',rp.departamento,'estado',rp.estado,'proyecto',a.proyecto_numero,'rol_proyecto',a.rol_proyecto,'porcentaje_dedicacion',coalesce(a.porcentaje_dedicacion,100),'fecha_inicio',a.fecha_inicio,'fecha_fin',a.fecha_fin) order by rp.apellidos,rp.nombre),'[]'::jsonb) into v_result from public.rh_proyecto_asignaciones a join public.rh_personal rp on rp.id=a.personal_id where a.proyecto_numero=v_project and lower(coalesce(a.estado,''))='activo' and lower(coalesce(rp.estado,''))='activo';
    end if;
    return v_result;
end;
$$;
revoke all on function public.crm_sky_direccion_personal(text) from public,anon;
grant execute on function public.crm_sky_direccion_personal(text) to authenticated;

create or replace function public.crm_sky_direccion_compras()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_proveedores jsonb; v_solicitudes jsonb; v_cotizaciones jsonb;
begin
    if auth.uid() is null or not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')) then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.razon_social),'[]'::jsonb) into v_proveedores from public.co_proveedores x where lower(coalesce(x.estado,'activo'))<>'inactivo';
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_solicitudes from public.solicitudes_compra x;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_cotizaciones from public.co_cotizaciones x;
    return jsonb_build_object('proveedores',v_proveedores,'solicitudes',v_solicitudes,'cotizaciones',v_cotizaciones);
end;
$$;
revoke all on function public.crm_sky_direccion_compras() from public,anon;
grant execute on function public.crm_sky_direccion_compras() to authenticated;

create or replace function public.crm_direccion_vehiculos()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
    if auth.uid() is null or not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')) then raise exception using errcode='42501',message='La flotilla ejecutiva está disponible solo para Dirección.'; end if;
    select coalesce(jsonb_agg(to_jsonb(v) order by v.numero_economico),'[]'::jsonb) into v_result from public.vehiculos v where coalesce(v.activo,true)=true;
    return v_result;
end;
$$;
revoke all on function public.crm_direccion_vehiculos() from public,anon;
grant execute on function public.crm_direccion_vehiculos() to authenticated;

insert into public.perfiles_usuario(id,nombre,rol,activo,puesto,departamento)
select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),'Gerente General'),'gerente_general',true,'Gerente General','Dirección'
from auth.users u where lower(u.email)=lower('gg@skilled.mx')
on conflict(id) do update set rol='gerente_general',activo=true,updated_at=now();

insert into public.perfiles_usuario(id,nombre,rol,activo,puesto,departamento)
select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),'Subgerente'),'subgerente',true,'Subgerente','Dirección'
from auth.users u where lower(u.email)=lower('subgg@skilled.mx')
on conflict(id) do update set rol='subgerente',activo=true,updated_at=now();

insert into public.perfiles_usuario(id,nombre,rol,activo,puesto,departamento)
select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),'Administrador TSI'),'tsi',true,'Administrador TSI','TSI'
from auth.users u where lower(u.email)=lower('admin.tsi@skilled.mx')
on conflict(id) do update set rol='tsi',activo=true,updated_at=now();

commit;

begin;

do $$
declare r record; v_pending text[];
begin
    if to_regclass('public.proyecto_materiales_no_listados') is not null then
        for r in select distinct on(lower(btrim(codigo_manual))) codigo_manual,descripcion,categoria,unidad,precio_unitario from public.proyecto_materiales_no_listados where coalesce(btrim(codigo_manual),'')<>'' order by lower(btrim(codigo_manual)),id desc
        loop
            if not exists(select 1 from public.materiales m where lower(btrim(m.codigo))=lower(btrim(r.codigo_manual))) then
                v_pending:=array[]::text[];
                if coalesce(btrim(r.categoria),'')='' then v_pending:=array_append(v_pending,'categoria'); end if;
                if coalesce(btrim(r.unidad),'')='' then v_pending:=array_append(v_pending,'unidad'); end if;
                if coalesce(r.precio_unitario,0)<=0 then v_pending:=array_append(v_pending,'precio'); end if;
                v_pending:=array_append(v_pending,'imagen');
                insert into public.materiales(codigo,descripcion,categoria,unidad,precio,imagen_url,es_incompleto,origen_alta,campos_pendientes,activo,updated_at)
                values(btrim(r.codigo_manual),coalesce(nullif(btrim(coalesce(r.descripcion,'')),''),btrim(r.codigo_manual)),coalesce(nullif(btrim(coalesce(r.categoria,'')),''),'Sin clasificar'),coalesce(nullif(btrim(coalesce(r.unidad,'')),''),'pieza'),greatest(coalesce(r.precio_unitario,0),0),null,true,'proyecto_no_listado_legacy',v_pending,true,now());
            end if;
        end loop;
    end if;
    if to_regclass('public.movimientos') is not null then
        for r in select distinct on(lower(btrim(codigo_manual))) codigo_manual,descripcion,categoria_manual as categoria,unidad,precio_unitario from public.movimientos where coalesce(btrim(codigo_manual),'')<>'' order by lower(btrim(codigo_manual)),fecha desc,id desc
        loop
            if not exists(select 1 from public.materiales m where lower(btrim(m.codigo))=lower(btrim(r.codigo_manual))) then
                v_pending:=array[]::text[];
                if coalesce(btrim(r.categoria),'')='' then v_pending:=array_append(v_pending,'categoria'); end if;
                if coalesce(btrim(r.unidad),'')='' then v_pending:=array_append(v_pending,'unidad'); end if;
                if coalesce(r.precio_unitario,0)<=0 then v_pending:=array_append(v_pending,'precio'); end if;
                v_pending:=array_append(v_pending,'imagen');
                insert into public.materiales(codigo,descripcion,categoria,unidad,precio,imagen_url,es_incompleto,origen_alta,campos_pendientes,activo,updated_at)
                values(btrim(r.codigo_manual),coalesce(nullif(btrim(coalesce(r.descripcion,'')),''),btrim(r.codigo_manual)),coalesce(nullif(btrim(coalesce(r.categoria,'')),''),'Sin clasificar'),coalesce(nullif(btrim(coalesce(r.unidad,'')),''),'pieza'),greatest(coalesce(r.precio_unitario,0),0),null,true,'movimiento_no_listado_legacy',v_pending,true,now());
            end if;
        end loop;
    end if;
end;
$$;

create or replace function public.crm_registrar_movimientos_v33(
    p_request_id text,
    p_tipo text,
    p_motivo text,
    p_fecha timestamptz,
    p_productos jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_item jsonb;
    v_tipo text:=lower(btrim(coalesce(p_tipo,'')));
    v_codigo text;
    v_descripcion text;
    v_unidad text;
    v_categoria text;
    v_proyecto text;
    v_origen_nombre text;
    v_destino_nombre text;
    v_ubicacion text;
    v_ubicacion_origen text;
    v_ubicacion_destino text;
    v_orden text;
    v_fecha_orden date;
    v_referencia text;
    v_recibe text;
    v_recibe_tipo text;
    v_ajuste text;
    v_origen_entrada text;
    v_alcance text;
    v_stock_fuente text;
    v_cantidad numeric;
    v_precio numeric;
    v_dentro numeric;
    v_fuera numeric;
    v_stock_proyecto numeric;
    v_stock_general numeric;
    v_plan numeric;
    v_entregado numeric;
    v_reservado numeric;
    v_pendiente_plan numeric;
    v_origen_id bigint;
    v_destino_id bigint;
    v_catalogado boolean;
    v_es_no_listado boolean;
    v_legacy_no_listado boolean;
    v_fila record;
    v_restante numeric;
    v_tomar numeric;
    v_disponible numeric;
    v_registros integer:=0;
begin
    if auth.uid() is null or not exists(
        select 1 from public.perfiles_usuario
        where id=auth.uid() and activo=true and lower(coalesce(rol::text,'')) in('administrador','jefe_almacen','almacen')
    ) then raise exception 'No tienes permiso para registrar movimientos.'; end if;
    if coalesce(btrim(p_request_id),'')='' then raise exception 'Falta el folio del movimiento.'; end if;
    if v_tipo not in('entrada','salida','ajuste','traspaso','reingreso') then raise exception 'Tipo de movimiento no válido.'; end if;
    if jsonb_typeof(p_productos)<>'array' or jsonb_array_length(p_productos)=0 then raise exception 'Agrega al menos un material.'; end if;
    if exists(select 1 from public.movimientos where request_id=btrim(p_request_id)) then raise exception 'El folio % ya fue registrado.',p_request_id; end if;

    for v_item in select value from jsonb_array_elements(p_productos)
    loop
        v_codigo:=btrim(coalesce(v_item->>'codigo',v_item#>>'{producto,codigo}',''));
        v_descripcion:=btrim(coalesce(v_item->>'descripcion',v_item#>>'{producto,descripcion}',v_item#>>'{producto,desc}',v_codigo));
        v_unidad:=btrim(coalesce(v_item->>'unidad',v_item#>>'{producto,unidad}',''));
        v_categoria:=btrim(coalesce(v_item->>'categoria',v_item#>>'{producto,categoria}',''));
        v_cantidad:=coalesce(nullif(v_item->>'cantidad','')::numeric,0);
        v_precio:=coalesce(nullif(coalesce(v_item->>'precio',v_item->>'precio_unitario'),'')::numeric,0);
        v_proyecto:=btrim(coalesce(v_item->>'proyecto',''));
        v_origen_nombre:=btrim(coalesce(v_item->>'bodegaOrigen',v_item->>'bodega_origen',''));
        v_destino_nombre:=btrim(coalesce(v_item->>'bodegaDestino',v_item->>'bodega_destino',''));
        v_ubicacion:=btrim(coalesce(v_item->>'ubicacion',''));
        v_ubicacion_origen:=btrim(coalesce(v_item->>'ubicacionOrigen',v_item->>'ubicacion_origen',''));
        v_ubicacion_destino:=btrim(coalesce(v_item->>'ubicacionDestino',v_item->>'ubicacion_destino',''));
        v_orden:=btrim(coalesce(v_item->>'ordenCompra',v_item->>'orden_compra',''));
        begin v_fecha_orden:=nullif(coalesce(v_item->>'fechaOrdenCompra',v_item->>'fecha_orden_compra'),'')::date; exception when others then v_fecha_orden:=null; end;
        v_referencia:=btrim(coalesce(v_item->>'referencia',''));
        v_recibe:=btrim(coalesce(v_item->>'recibeNombre',v_item->>'recibe_nombre',''));
        v_recibe_tipo:=btrim(coalesce(v_item->>'recibeTipo',v_item->>'recibe_tipo',''));
        v_ajuste:=lower(btrim(coalesce(v_item->>'ajusteAccion',v_item->>'ajuste_accion','')));
        v_origen_entrada:=lower(btrim(coalesce(v_item->>'origenEntrada',v_item->>'origen_entrada','')));
        v_stock_fuente:='';
        v_es_no_listado:=
            lower(coalesce(nullif(v_item->>'esNoListado',''),nullif(v_item->>'es_no_listado',''),'false')) in('true','1','si','sí','yes')
            or v_codigo ~* '^NL-';
        v_stock_proyecto:=coalesce(nullif(coalesce(v_item->>'cantidadStockProyecto',v_item->>'cantidad_stock_proyecto'),'')::numeric,0);
        v_stock_general:=coalesce(nullif(coalesce(v_item->>'cantidadStockGeneral',v_item->>'cantidad_stock_general'),'')::numeric,0);
        v_dentro:=coalesce(nullif(coalesce(v_item->>'cantidadDentroPlan',v_item->>'cantidad_dentro_plan'),'')::numeric,0);
        v_fuera:=coalesce(nullif(coalesce(v_item->>'cantidadFueraPlan',v_item->>'cantidad_fuera_plan'),'')::numeric,0);
        if v_codigo='' or v_cantidad<=0 then raise exception 'Existe un material sin código o con cantidad inválida.'; end if;
        select exists(select 1 from public.materiales where codigo=v_codigo) into v_catalogado;
        v_legacy_no_listado:=false;
        if v_proyecto<>'' and to_regclass('public.proyecto_materiales_no_listados') is not null then
            select exists(
                select 1 from public.proyecto_materiales_no_listados pn
                where pn.proyecto_numero=v_proyecto and lower(btrim(pn.codigo_manual))=lower(v_codigo)
            ) and not exists(
                select 1 from public.proyecto_materiales pm
                where pm.proyecto_numero=v_proyecto and lower(btrim(pm.material_codigo))=lower(v_codigo)
            ) into v_legacy_no_listado;
        end if;
        v_es_no_listado:=v_es_no_listado or v_legacy_no_listado;
        if not v_catalogado and not v_es_no_listado then raise exception 'No existe el material % en el catálogo.',v_codigo; end if;
        if v_catalogado then
            select coalesce(nullif(v_descripcion,''),m.descripcion),coalesce(nullif(v_unidad,''),m.unidad),coalesce(nullif(v_categoria,''),m.categoria)
            into v_descripcion,v_unidad,v_categoria from public.materiales m where m.codigo=v_codigo;
        end if;
        v_origen_id:=null;v_destino_id:=null;
        if v_origen_nombre<>'' then select id into v_origen_id from public.almacenes where lower(nombre)=lower(v_origen_nombre) limit 1; end if;
        if v_destino_nombre<>'' then select id into v_destino_id from public.almacenes where lower(nombre)=lower(v_destino_nombre) limit 1; end if;

        select coalesce(max(cantidad_planeada),0) into v_plan from(
            select cantidad_planeada from public.proyecto_materiales where proyecto_numero=v_proyecto and material_codigo=v_codigo
            union all select cantidad_planeada from public.proyecto_materiales_no_listados where proyecto_numero=v_proyecto and codigo_manual=v_codigo
        ) q;
        select greatest(0,
            coalesce(sum(case
                when lower(tipo)='salida' then cantidad
                when lower(tipo)='ajuste' and lower(coalesce(ajuste_accion,''))='disminuir' then cantidad
                else 0
            end),0)
        ) into v_entregado
        from public.movimientos
        where proyecto=v_proyecto and coalesce(material_codigo,codigo_manual)=v_codigo;
        if v_proyecto<>'' and v_catalogado and not v_legacy_no_listado then
            select coalesce(sum(stock),0) into v_reservado
            from public.existencias_proyecto_almacen
            where proyecto_numero=v_proyecto and material_codigo=v_codigo;
        elsif v_proyecto<>'' and v_es_no_listado then
            v_reservado:=public.crm_reserva_manual_disponible_v33(v_proyecto,v_codigo,null);
        else
            v_reservado:=0;
        end if;
        v_pendiente_plan:=case
            when v_tipo='entrada' then greatest(0,v_plan-v_entregado-v_reservado)
            else greatest(0,v_plan-v_entregado)
        end;
        if v_dentro<=0 and v_fuera<=0 then
            if v_proyecto<>'' and v_plan>0 then v_dentro:=least(v_cantidad,v_pendiente_plan);v_fuera:=greatest(0,v_cantidad-v_dentro);
            else v_dentro:=0;v_fuera:=case when v_proyecto<>'' then v_cantidad else 0 end; end if;
        elsif v_dentro+v_fuera<>v_cantidad then v_fuera:=greatest(0,v_cantidad-v_dentro); end if;
        v_alcance:=case when v_dentro>0 and v_fuera>0 then 'mixto' when v_dentro>0 then 'dentro_plan' when v_fuera>0 then 'fuera_plan' else 'sin_plan' end;

        if v_catalogado and not v_legacy_no_listado then
            if v_tipo='entrada' then
                if v_destino_id is null then raise exception 'Selecciona el almacén de destino para %.',v_codigo; end if;
                if v_proyecto='' or v_origen_entrada in('ingreso_nuevo_almacen','almacen') then
                    update public.existencias_almacen set stock=stock+v_cantidad,ubicacion=coalesce(nullif(v_ubicacion_destino,''),nullif(v_ubicacion,''),ubicacion),updated_at=now()
                    where material_codigo=v_codigo and almacen_id=v_destino_id;
                    if not found then
                        begin insert into public.existencias_almacen(material_codigo,almacen_id,stock,stock_minimo,ubicacion,updated_at)
                        values(v_codigo,v_destino_id,v_cantidad,0,nullif(coalesce(v_ubicacion_destino,v_ubicacion),''),now());
                        exception when unique_violation then update public.existencias_almacen set stock=stock+v_cantidad,updated_at=now() where material_codigo=v_codigo and almacen_id=v_destino_id; end;
                    end if;
                    v_stock_general:=v_cantidad;v_stock_proyecto:=0;v_stock_fuente:='almacen_general';
                elsif v_origen_entrada='almacen_general_a_proyecto' then
                    select coalesce(stock,0) into v_disponible from public.existencias_almacen where material_codigo=v_codigo and almacen_id=v_destino_id for update;
                    if v_disponible<v_cantidad then raise exception 'Stock general insuficiente de % en %. Disponible: %.',v_codigo,v_destino_nombre,v_disponible; end if;
                    update public.existencias_almacen set stock=stock-v_cantidad,updated_at=now() where material_codigo=v_codigo and almacen_id=v_destino_id;
                    insert into public.existencias_proyecto_almacen(proyecto_numero,material_codigo,almacen_id,stock,ubicacion,updated_at)
                    values(v_proyecto,v_codigo,v_destino_id,v_cantidad,nullif(v_ubicacion_destino,''),now())
                    on conflict(proyecto_numero,material_codigo,almacen_id) do update set stock=public.existencias_proyecto_almacen.stock+excluded.stock,updated_at=now();
                    v_stock_general:=0;v_stock_proyecto:=v_cantidad;v_stock_fuente:='almacen_general_a_proyecto';
                else
                    insert into public.existencias_proyecto_almacen(proyecto_numero,material_codigo,almacen_id,stock,ubicacion,updated_at)
                    values(v_proyecto,v_codigo,v_destino_id,v_cantidad,nullif(v_ubicacion_destino,''),now())
                    on conflict(proyecto_numero,material_codigo,almacen_id) do update set stock=public.existencias_proyecto_almacen.stock+excluded.stock,updated_at=now();
                    v_stock_general:=0;v_stock_proyecto:=v_cantidad;v_stock_fuente:='reserva_proyecto_nueva';
                end if;
            elsif v_tipo='salida' then
                if v_origen_id is null then raise exception 'Selecciona el almacén de origen para %.',v_codigo; end if;
                if v_proyecto='' then
                    v_stock_proyecto:=0;v_stock_general:=v_cantidad;
                elsif v_stock_proyecto+v_stock_general<=0 then
                    select coalesce(stock,0) into v_stock_proyecto from public.existencias_proyecto_almacen
                    where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_origen_id for update;
                    v_stock_proyecto:=least(v_cantidad,coalesce(v_stock_proyecto,0));
                    v_stock_general:=v_cantidad-v_stock_proyecto;
                end if;
                if v_stock_proyecto+v_stock_general<>v_cantidad then v_stock_general:=greatest(0,v_cantidad-v_stock_proyecto); end if;
                if v_stock_proyecto>0 then
                    select coalesce(stock,0) into v_disponible from public.existencias_proyecto_almacen
                    where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_origen_id for update;
                    if v_disponible<v_stock_proyecto then raise exception 'Reserva insuficiente de % para el proyecto % en %. Disponible: %.',v_codigo,v_proyecto,v_origen_nombre,v_disponible; end if;
                    update public.existencias_proyecto_almacen set stock=stock-v_stock_proyecto,updated_at=now()
                    where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_origen_id;
                    delete from public.existencias_proyecto_almacen where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_origen_id and stock<=0;
                end if;
                if v_stock_general>0 then
                    select coalesce(stock,0) into v_disponible from public.existencias_almacen where material_codigo=v_codigo and almacen_id=v_origen_id for update;
                    if v_disponible<v_stock_general then raise exception 'Stock general insuficiente de % en %. Disponible: %.',v_codigo,v_origen_nombre,v_disponible; end if;
                    update public.existencias_almacen set stock=stock-v_stock_general,updated_at=now() where material_codigo=v_codigo and almacen_id=v_origen_id;
                end if;
                v_stock_fuente:=case when v_stock_proyecto>0 and v_stock_general>0 then 'mixto' when v_stock_proyecto>0 then 'reserva_proyecto' else 'almacen_general' end;
                if v_proyecto<>'' and v_dentro>0 then
                    update public.proyecto_materiales set cantidad_entregada=least(cantidad_planeada,coalesce(cantidad_entregada,0)+v_dentro),updated_at=now()
                    where proyecto_numero=v_proyecto and material_codigo=v_codigo;
                    update public.proyecto_materiales_no_listados set cantidad_entregada=least(cantidad_planeada,coalesce(cantidad_entregada,0)+v_dentro),updated_at=now()
                    where proyecto_numero=v_proyecto and codigo_manual=v_codigo;
                end if;
            elsif v_tipo='ajuste' then
                if v_destino_id is null then v_destino_id:=v_origen_id;v_destino_nombre:=v_origen_nombre; end if;
                if v_destino_id is null then raise exception 'Selecciona el almacén para ajustar %.',v_codigo; end if;
                if v_proyecto<>'' then
                    if v_ajuste='disminuir' then
                        select coalesce(stock,0) into v_disponible from public.existencias_proyecto_almacen where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_destino_id for update;
                        if v_disponible<v_cantidad then raise exception 'Reserva insuficiente de % para el ajuste.',v_codigo; end if;
                        update public.existencias_proyecto_almacen set stock=stock-v_cantidad,updated_at=now() where proyecto_numero=v_proyecto and material_codigo=v_codigo and almacen_id=v_destino_id;
                    else
                        insert into public.existencias_proyecto_almacen(proyecto_numero,material_codigo,almacen_id,stock,ubicacion,updated_at)
                        values(v_proyecto,v_codigo,v_destino_id,v_cantidad,nullif(v_ubicacion,''),now())
                        on conflict(proyecto_numero,material_codigo,almacen_id) do update set stock=public.existencias_proyecto_almacen.stock+excluded.stock,updated_at=now();
                    end if;
                    v_stock_proyecto:=v_cantidad;v_stock_general:=0;v_stock_fuente:='reserva_proyecto';
                else
                    if v_ajuste='disminuir' then
                        select coalesce(stock,0) into v_disponible from public.existencias_almacen where material_codigo=v_codigo and almacen_id=v_destino_id for update;
                        if v_disponible<v_cantidad then raise exception 'Stock insuficiente de % para el ajuste.',v_codigo; end if;
                        update public.existencias_almacen set stock=stock-v_cantidad,updated_at=now() where material_codigo=v_codigo and almacen_id=v_destino_id;
                    else
                        update public.existencias_almacen set stock=stock+v_cantidad,updated_at=now() where material_codigo=v_codigo and almacen_id=v_destino_id;
                        if not found then insert into public.existencias_almacen(material_codigo,almacen_id,stock,stock_minimo,ubicacion,updated_at) values(v_codigo,v_destino_id,v_cantidad,0,nullif(v_ubicacion,''),now()); end if;
                    end if;
                    v_stock_general:=v_cantidad;v_stock_proyecto:=0;v_stock_fuente:='almacen_general';
                end if;
            elsif v_tipo='traspaso' then
                if v_origen_id is null or v_destino_id is null then raise exception 'Selecciona almacén origen y destino.'; end if;
                if v_origen_id=v_destino_id then raise exception 'El almacén de origen y destino deben ser distintos.'; end if;
                select coalesce(stock,0) into v_disponible from public.existencias_almacen where material_codigo=v_codigo and almacen_id=v_origen_id for update;
                if v_disponible<v_cantidad then raise exception 'Stock insuficiente de % en %.',v_codigo,v_origen_nombre; end if;
                update public.existencias_almacen set stock=stock-v_cantidad,updated_at=now() where material_codigo=v_codigo and almacen_id=v_origen_id;
                update public.existencias_almacen set stock=stock+v_cantidad,ubicacion=coalesce(nullif(v_ubicacion_destino,''),ubicacion),updated_at=now() where material_codigo=v_codigo and almacen_id=v_destino_id;
                if not found then insert into public.existencias_almacen(material_codigo,almacen_id,stock,stock_minimo,ubicacion,updated_at) values(v_codigo,v_destino_id,v_cantidad,0,nullif(v_ubicacion_destino,''),now()); end if;
                v_stock_general:=v_cantidad;v_stock_proyecto:=0;v_stock_fuente:='almacen_general';
            end if;
        else
            if v_tipo='entrada' then
                if v_proyecto<>'' and v_origen_entrada not in('ingreso_nuevo_almacen','almacen') then
                    if v_destino_nombre='' then
                        raise exception 'Selecciona el almacén de destino para el material no enlistado %.',v_codigo;
                    end if;
                    v_stock_proyecto:=v_cantidad;
                    v_stock_general:=0;
                    v_stock_fuente:='reserva_proyecto_no_listado';
                else
                    v_stock_proyecto:=0;
                    v_stock_general:=0;
                    v_stock_fuente:='historial_no_listado';
                end if;
            elsif v_tipo='salida' then
                if v_proyecto='' then
                    raise exception 'El material no enlistado % solo puede salir desde la reserva de un proyecto.',v_codigo;
                end if;
                if v_origen_nombre='' then
                    raise exception 'Selecciona el almacén de origen para el material no enlistado %.',v_codigo;
                end if;
                perform pg_advisory_xact_lock(hashtextextended(v_proyecto||'|'||v_codigo||'|'||lower(v_origen_nombre),0));
                v_disponible:=public.crm_reserva_manual_disponible_v33(v_proyecto,v_codigo,v_origen_nombre);
                if v_disponible<v_cantidad then
                    raise exception 'Reserva exclusiva insuficiente de % para el proyecto % en %. Disponible: %.',
                        v_codigo,v_proyecto,v_origen_nombre,v_disponible;
                end if;
                v_stock_proyecto:=v_cantidad;
                v_stock_general:=0;
                v_stock_fuente:='reserva_proyecto_no_listado';
                if v_dentro>0 then
                    update public.proyecto_materiales_no_listados
                    set cantidad_entregada=least(cantidad_planeada,coalesce(cantidad_entregada,0)+v_dentro),updated_at=now()
                    where proyecto_numero=v_proyecto and codigo_manual=v_codigo;
                end if;
            elsif v_tipo='ajuste' then
                if v_proyecto='' then
                    raise exception 'Los ajustes de materiales no enlistados requieren un proyecto para conservar su trazabilidad.';
                end if;
                if v_destino_nombre='' then
                    v_destino_nombre:=v_origen_nombre;
                end if;
                if v_destino_nombre='' then
                    raise exception 'Selecciona el almacén para ajustar el material no enlistado %.',v_codigo;
                end if;
                if v_ajuste='disminuir' then
                    perform pg_advisory_xact_lock(hashtextextended(v_proyecto||'|'||v_codigo||'|'||lower(v_destino_nombre),0));
                    v_disponible:=public.crm_reserva_manual_disponible_v33(v_proyecto,v_codigo,v_destino_nombre);
                    if v_disponible<v_cantidad then
                        raise exception 'Reserva exclusiva insuficiente de % para el ajuste. Disponible: %.',v_codigo,v_disponible;
                    end if;
                end if;
                v_stock_proyecto:=v_cantidad;
                v_stock_general:=0;
                v_stock_fuente:='reserva_proyecto_no_listado';
            else
                v_stock_proyecto:=0;
                v_stock_general:=0;
                v_stock_fuente:='historial_no_listado';
            end if;
        end if;

        insert into public.movimientos(
            request_id,fecha,tipo,ajuste_accion,material_codigo,codigo_manual,descripcion,cantidad,unidad,categoria_manual,
            proyecto,ubicacion,orden_compra,fecha_orden_compra,referencia,bodega_origen,bodega_destino,motivo,precio_unitario,
            recibe_nombre,recibe_tipo,folio_entrega,alcance,stock_fuente,cantidad_stock_proyecto,cantidad_stock_general,
            cantidad_dentro_plan,cantidad_fuera_plan,origen_entrada,tomar_del_almacen,es_no_listado
        ) values(
            btrim(p_request_id),coalesce(p_fecha,now()),v_tipo,nullif(v_ajuste,''),case when v_catalogado and not v_legacy_no_listado then v_codigo else null end,
            case when v_catalogado and not v_legacy_no_listado then null else v_codigo end,v_descripcion,v_cantidad,nullif(v_unidad,''),nullif(v_categoria,''),
            nullif(v_proyecto,''),nullif(v_ubicacion,''),nullif(v_orden,''),v_fecha_orden,nullif(v_referencia,''),
            nullif(v_origen_nombre,''),nullif(v_destino_nombre,''),nullif(btrim(p_motivo),''),v_precio,
            nullif(v_recibe,''),nullif(v_recibe_tipo,''),btrim(p_request_id),v_alcance,coalesce(nullif(v_stock_fuente,''),'general'),
            v_stock_proyecto,v_stock_general,v_dentro,v_fuera,nullif(v_origen_entrada,''),v_origen_entrada='almacen_general_a_proyecto',not (v_catalogado and not v_legacy_no_listado)
        );
        v_registros:=v_registros+1;
    end loop;
    return jsonb_build_object('ok',true,'requestId',btrim(p_request_id),'registrados',v_registros,'tipo',v_tipo);
end;
$$;

revoke all on function public.crm_registrar_movimientos_v33(text,text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.crm_registrar_movimientos_v33(text,text,text,timestamptz,jsonb) to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V43-RECUPERACION-INTEGRAL-2026-08-11',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select
    'OK' as estado,
    'CRM-V43-RECUPERACION-INTEGRAL-2026-08-11' as version,
    (select count(*) from public.materiales where coalesce(es_incompleto,false)=true) as materiales_incompletos,
    case when exists(select 1 from public.perfiles_usuario p join auth.users u on u.id=p.id where lower(u.email)=lower('gg@skilled.mx') and p.rol='gerente_general' and p.activo=true) then 'OK' else 'REVISAR_GG' end as gerente_general,
    case when exists(select 1 from public.perfiles_usuario p join auth.users u on u.id=p.id where lower(u.email)=lower('subgg@skilled.mx') and p.rol='subgerente' and p.activo=true) then 'OK' else 'REVISAR_SUBGERENTE' end as subgerente,
    case when exists(select 1 from public.perfiles_usuario p join auth.users u on u.id=p.id where lower(u.email)=lower('admin.tsi@skilled.mx') and p.rol='tsi' and p.activo=true) then 'OK' else 'REVISAR_TSI' end as tsi;
