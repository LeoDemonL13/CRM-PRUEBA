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

begin;

alter table public.perfiles_usuario drop constraint if exists perfiles_usuario_rol_check;
alter table public.perfiles_usuario add constraint perfiles_usuario_rol_check
check (rol in ('administrador','jefe_almacen','almacen','compras','proyectos','rh','finanzas','gerente_general','subgerente','tsi','consulta'));

insert into public.perfiles_usuario(id,nombre,rol,activo,puesto,departamento)
select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),'Gerente General'),'gerente_general',true,'Gerente General','Dirección'
from auth.users u where lower(u.email)=lower('gg@skilled.mx')
on conflict(id) do update set rol='gerente_general',activo=true,puesto=coalesce(public.perfiles_usuario.puesto,'Gerente General'),departamento=coalesce(public.perfiles_usuario.departamento,'Dirección'),updated_at=now();

insert into public.perfiles_usuario(id,nombre,rol,activo,puesto,departamento)
select u.id,coalesce(nullif(u.raw_user_meta_data->>'nombre',''),'Subgerente'),'subgerente',true,'Subgerente','Dirección'
from auth.users u where lower(u.email)=lower('subgg@skilled.mx')
on conflict(id) do update set rol='subgerente',activo=true,puesto=coalesce(public.perfiles_usuario.puesto,'Subgerente'),departamento=coalesce(public.perfiles_usuario.departamento,'Dirección'),updated_at=now();

create or replace function public.crm_es_direccion()
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
    select auth.uid() is not null and (
        exists(
            select 1 from public.perfiles_usuario p
            where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')
        )
        or exists(
            select 1 from auth.users u
            where u.id=auth.uid() and lower(coalesce(u.email,'')) in ('gg@skilled.mx','subgg@skilled.mx')
        )
    );
$$;
revoke all on function public.crm_es_direccion() from public,anon;
grant execute on function public.crm_es_direccion() to authenticated;

create or replace function public.crm_puede_gestionar_rollos_cable()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
    select auth.uid() is not null and exists(
        select 1 from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','jefe_almacen','almacen')
    );
$$;
revoke all on function public.crm_puede_gestionar_rollos_cable() from public,anon;
grant execute on function public.crm_puede_gestionar_rollos_cable() to authenticated;

update public.materiales
set tipo_cable=null,
    tamano_mm2=null,
    updated_at=now()
where lower(btrim(coalesce(categoria,''))) not in ('cable','cables')
  and (nullif(btrim(coalesce(tipo_cable,'')),'') is not null or nullif(btrim(coalesce(tamano_mm2,'')),'') is not null);

update public.materiales
set unidad='METRO',
    updated_at=now()
where lower(btrim(coalesce(categoria,''))) in ('cable','cables')
  and upper(btrim(coalesce(unidad,'')))<>'METRO';

update public.materiales m
set campos_pendientes=coalesce((
        select array_agg(x order by ord)
        from (
            select 'categoria'::text x,1 ord where nullif(btrim(coalesce(m.categoria,'')),'') is null
            union all select 'unidad',2 where nullif(btrim(coalesce(m.unidad,'')),'') is null
            union all select 'tipo_cable',3 where lower(btrim(coalesce(m.categoria,''))) in ('cable','cables') and nullif(btrim(coalesce(m.tipo_cable,'')),'') is null
            union all select 'tamano_mm2',4 where lower(btrim(coalesce(m.categoria,''))) in ('cable','cables') and nullif(btrim(coalesce(m.tamano_mm2,'')),'') is null
            union all select 'precio',5 where coalesce(m.precio,0)<=0
            union all select 'imagen',6 where nullif(btrim(coalesce(m.imagen_url,'')),'') is null
        ) q
    ),'{}'::text[]),
    es_incompleto=(
        nullif(btrim(coalesce(m.categoria,'')),'') is null
        or nullif(btrim(coalesce(m.unidad,'')),'') is null
        or (lower(btrim(coalesce(m.categoria,''))) in ('cable','cables') and nullif(btrim(coalesce(m.tipo_cable,'')),'') is null)
        or (lower(btrim(coalesce(m.categoria,''))) in ('cable','cables') and nullif(btrim(coalesce(m.tamano_mm2,'')),'') is null)
        or coalesce(m.precio,0)<=0
        or nullif(btrim(coalesce(m.imagen_url,'')),'') is null
    ),
    updated_at=now();

create or replace function public.crm_material_campos_cable_trg()
returns trigger
language plpgsql
set search_path=public
as $$
begin
    if lower(btrim(coalesce(new.categoria,''))) in ('cable','cables') then
        new.unidad:='METRO';
    else
        new.tipo_cable:=null;
        new.tamano_mm2:=null;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_material_campos_cable on public.materiales;
create trigger trg_material_campos_cable
before insert or update of categoria,tipo_cable,tamano_mm2,unidad on public.materiales
for each row execute function public.crm_material_campos_cable_trg();

create table if not exists public.cable_rollos(
    id bigint generated by default as identity primary key,
    material_codigo text not null references public.materiales(codigo) on update cascade on delete cascade,
    almacen_id bigint not null references public.almacenes(id) on update cascade on delete cascade,
    codigo_rollo text not null,
    metros_iniciales numeric(14,3) not null,
    metros_disponibles numeric(14,3) not null,
    estado text not null default 'cerrado',
    ubicacion text,
    notas text,
    origen text not null default 'manual',
    activo boolean not null default true,
    creado_por uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint cable_rollos_metros_iniciales_ck check(metros_iniciales>0),
    constraint cable_rollos_metros_disponibles_ck check(metros_disponibles>=0 and metros_disponibles<=metros_iniciales),
    constraint cable_rollos_codigo_uq unique(material_codigo,almacen_id,codigo_rollo)
);

create index if not exists cable_rollos_material_idx on public.cable_rollos(material_codigo);
create index if not exists cable_rollos_almacen_idx on public.cable_rollos(almacen_id);
create index if not exists cable_rollos_activos_idx on public.cable_rollos(material_codigo,almacen_id,activo,metros_disponibles);

create or replace function public.crm_preparar_rollo_cable()
returns trigger
language plpgsql
set search_path=public
as $$
begin
    if not exists(select 1 from public.materiales m where m.codigo=new.material_codigo and lower(btrim(coalesce(m.categoria,''))) in ('cable','cables')) then
        raise exception 'Los rollos solo pueden asignarse a materiales de la categoría Cable/Cables.';
    end if;
    new.codigo_rollo:=btrim(coalesce(new.codigo_rollo,''));
    if new.codigo_rollo='' then raise exception 'El código del rollo es obligatorio.'; end if;
    if new.metros_iniciales<=0 then raise exception 'Los metros iniciales deben ser mayores a cero.'; end if;
    if new.metros_disponibles<0 or new.metros_disponibles>new.metros_iniciales then raise exception 'Los metros disponibles deben quedar entre 0 y los metros iniciales.'; end if;
    new.estado:=case
        when not coalesce(new.activo,true) then 'retirado'
        when new.metros_disponibles<=0 then 'agotado'
        when new.metros_disponibles<new.metros_iniciales then 'abierto'
        else 'cerrado'
    end;
    new.updated_at:=now();
    return new;
end;
$$;

drop trigger if exists trg_cable_rollos_preparar on public.cable_rollos;
create trigger trg_cable_rollos_preparar
before insert or update on public.cable_rollos
for each row execute function public.crm_preparar_rollo_cable();

create or replace function public.crm_sincronizar_stock_desde_rollos(p_material_codigo text,p_almacen_id bigint)
returns numeric
language plpgsql
security definer
set search_path=public
as $$
declare
    v_stock numeric:=0;
    v_ubicacion text;
begin
    if nullif(btrim(coalesce(p_material_codigo,'')),'') is null or coalesce(p_almacen_id,0)<=0 then return 0; end if;
    select coalesce(sum(r.metros_disponibles) filter(where r.activo=true),0),
           (array_agg(nullif(btrim(coalesce(r.ubicacion,'')),'') order by case when r.activo and r.metros_disponibles>0 then 0 else 1 end,r.id) filter(where nullif(btrim(coalesce(r.ubicacion,'')),'') is not null))[1]
    into v_stock,v_ubicacion
    from public.cable_rollos r
    where r.material_codigo=p_material_codigo and r.almacen_id=p_almacen_id;

    perform set_config('crm.syncing_roll_stock','1',true);
    update public.existencias_almacen
       set stock=greatest(v_stock,0),
           ubicacion=coalesce(v_ubicacion,ubicacion),
           updated_at=now()
     where material_codigo=p_material_codigo and almacen_id=p_almacen_id;
    if not found then
        insert into public.existencias_almacen(material_codigo,almacen_id,stock,stock_minimo,stock_medio,stock_maximo,ubicacion,updated_at)
        values(p_material_codigo,p_almacen_id,greatest(v_stock,0),0,0,greatest(v_stock,1),v_ubicacion,now())
        on conflict(material_codigo,almacen_id) do update
        set stock=excluded.stock,ubicacion=coalesce(excluded.ubicacion,public.existencias_almacen.ubicacion),updated_at=now();
    end if;
    perform set_config('crm.syncing_roll_stock','0',true);
    return greatest(v_stock,0);
exception when others then
    perform set_config('crm.syncing_roll_stock','0',true);
    raise;
end;
$$;
revoke all on function public.crm_sincronizar_stock_desde_rollos(text,bigint) from public,anon;
grant execute on function public.crm_sincronizar_stock_desde_rollos(text,bigint) to authenticated;

create or replace function public.crm_rollo_cable_sincronizar_stock_trg()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
    if coalesce(current_setting('crm.reconciling_cable',true),'0')='1' then
        if tg_op='DELETE' then return old; else return new; end if;
    end if;
    if tg_op='DELETE' then
        perform public.crm_sincronizar_stock_desde_rollos(old.material_codigo,old.almacen_id);
        return old;
    end if;
    if tg_op='UPDATE' and (old.material_codigo is distinct from new.material_codigo or old.almacen_id is distinct from new.almacen_id) then
        perform public.crm_sincronizar_stock_desde_rollos(old.material_codigo,old.almacen_id);
    end if;
    perform public.crm_sincronizar_stock_desde_rollos(new.material_codigo,new.almacen_id);
    return new;
end;
$$;

drop trigger if exists trg_cable_rollos_sincronizar_stock on public.cable_rollos;
create trigger trg_cable_rollos_sincronizar_stock
after insert or update or delete on public.cable_rollos
for each row execute function public.crm_rollo_cable_sincronizar_stock_trg();

insert into public.cable_rollos(material_codigo,almacen_id,codigo_rollo,metros_iniciales,metros_disponibles,estado,ubicacion,notas,origen,activo,created_at,updated_at)
select e.material_codigo,e.almacen_id,
       'LEGADO-'||e.almacen_id::text||'-'||regexp_replace(upper(e.material_codigo),'[^A-Z0-9_-]+','-','g'),
       greatest(coalesce(e.stock,0),0.001),greatest(coalesce(e.stock,0),0),
       case when coalesce(e.stock,0)<=0 then 'agotado' else 'abierto' end,
       e.ubicacion,'Existencia previa convertida automáticamente a rollo para iniciar el control por metraje. Verifica el metraje inicial y el identificador físico.','migracion_stock',true,now(),now()
from public.existencias_almacen e
join public.materiales m on m.codigo=e.material_codigo
where lower(btrim(coalesce(m.categoria,''))) in ('cable','cables')
  and coalesce(e.stock,0)>0
  and not exists(select 1 from public.cable_rollos r where r.material_codigo=e.material_codigo and r.almacen_id=e.almacen_id);

create or replace function public.crm_reconciliar_rollos_desde_stock_trg()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
    v_es_cable boolean:=false;
    v_objetivo numeric:=greatest(coalesce(new.stock,0),0);
    v_actual numeric:=0;
    v_delta numeric:=0;
    v_tomar numeric:=0;
    r record;
    v_codigo_auto text;
begin
    if coalesce(current_setting('crm.syncing_roll_stock',true),'0')='1' then return new; end if;
    select lower(btrim(coalesce(m.categoria,''))) in ('cable','cables') into v_es_cable from public.materiales m where m.codigo=new.material_codigo;
    if not coalesce(v_es_cable,false) then return new; end if;

    select coalesce(sum(cr.metros_disponibles) filter(where cr.activo=true),0)
      into v_actual
      from public.cable_rollos cr
     where cr.material_codigo=new.material_codigo and cr.almacen_id=new.almacen_id;

    if abs(v_actual-v_objetivo)<0.0005 then return new; end if;
    perform set_config('crm.reconciling_cable','1',true);

    if v_actual>v_objetivo then
        v_delta:=v_actual-v_objetivo;
        for r in
            select id,metros_disponibles,metros_iniciales
            from public.cable_rollos
            where material_codigo=new.material_codigo and almacen_id=new.almacen_id and activo=true and metros_disponibles>0
            order by case when metros_disponibles<metros_iniciales then 0 else 1 end,updated_at,id
            for update
        loop
            exit when v_delta<=0.0005;
            v_tomar:=least(v_delta,r.metros_disponibles);
            update public.cable_rollos set metros_disponibles=greatest(0,metros_disponibles-v_tomar),updated_at=now() where id=r.id;
            v_delta:=v_delta-v_tomar;
        end loop;
    else
        v_delta:=v_objetivo-v_actual;
        v_codigo_auto:='AUTO-'||new.almacen_id::text||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(md5(random()::text),1,5);
        insert into public.cable_rollos(material_codigo,almacen_id,codigo_rollo,metros_iniciales,metros_disponibles,ubicacion,notas,origen,activo)
        values(new.material_codigo,new.almacen_id,v_codigo_auto,v_delta,v_delta,new.ubicacion,'Metraje creado automáticamente por una entrada o ajuste de inventario. Cambia este identificador por el código físico del rollo cuando lo tengas.','stock_sin_identificar',true);
    end if;

    perform set_config('crm.reconciling_cable','0',true);
    return new;
exception when others then
    perform set_config('crm.reconciling_cable','0',true);
    raise;
end;
$$;

drop trigger if exists trg_existencias_reconciliar_rollos_cable on public.existencias_almacen;
create trigger trg_existencias_reconciliar_rollos_cable
after insert or update of stock on public.existencias_almacen
for each row execute function public.crm_reconciliar_rollos_desde_stock_trg();

do $$
declare r record;
begin
    for r in select distinct material_codigo,almacen_id from public.cable_rollos
    loop
        perform public.crm_sincronizar_stock_desde_rollos(r.material_codigo,r.almacen_id);
    end loop;
end;
$$;

create or replace function public.crm_material_categoria_rollos_trg()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
    v_old_cable boolean:=lower(btrim(coalesce(old.categoria,''))) in ('cable','cables');
    v_new_cable boolean:=lower(btrim(coalesce(new.categoria,''))) in ('cable','cables');
    r record;
begin
    if v_old_cable=v_new_cable then return new; end if;
    if v_old_cable and not v_new_cable then
        perform set_config('crm.reconciling_cable','1',true);
        update public.cable_rollos set activo=false,estado='retirado',notas=concat_ws(' · ',nullif(notas,''),'Rollo archivado al cambiar el material fuera de Cable/Cables.'),updated_at=now()
        where material_codigo=new.codigo and activo=true;
        perform set_config('crm.reconciling_cable','0',true);
    elsif v_new_cable then
        for r in select e.almacen_id,e.stock,e.ubicacion from public.existencias_almacen e where e.material_codigo=new.codigo and coalesce(e.stock,0)>0
        loop
            if not exists(select 1 from public.cable_rollos cr where cr.material_codigo=new.codigo and cr.almacen_id=r.almacen_id and cr.activo=true) then
                insert into public.cable_rollos(material_codigo,almacen_id,codigo_rollo,metros_iniciales,metros_disponibles,ubicacion,notas,origen,activo)
                values(new.codigo,r.almacen_id,'PENDIENTE-'||r.almacen_id::text||'-'||substr(md5(new.codigo||clock_timestamp()::text),1,8),r.stock,r.stock,r.ubicacion,'Existencia convertida a cable. Identifica el rollo físico y confirma el metraje.','stock_sin_identificar',true);
            end if;
        end loop;
    end if;
    return new;
exception when others then
    perform set_config('crm.reconciling_cable','0',true);
    raise;
end;
$$;

drop trigger if exists trg_material_categoria_rollos on public.materiales;
create trigger trg_material_categoria_rollos
after update of categoria on public.materiales
for each row execute function public.crm_material_categoria_rollos_trg();

create or replace function public.crm_listar_rollos_cable(
    p_material_codigo text default null,
    p_almacen_id bigint default null,
    p_incluir_inactivos boolean default false
)
returns table(
    id bigint,material_codigo text,almacen_id bigint,almacen_nombre text,codigo_rollo text,
    metros_iniciales numeric,metros_disponibles numeric,estado text,ubicacion text,notas text,origen text,activo boolean,created_at timestamptz,updated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
    if not (public.crm_puede_gestionar_rollos_cable() or public.crm_es_direccion()) then
        raise exception using errcode='42501',message='Tu perfil no puede consultar rollos de cable.';
    end if;
    return query
    select r.id,r.material_codigo,r.almacen_id,a.nombre,r.codigo_rollo,r.metros_iniciales,r.metros_disponibles,r.estado,r.ubicacion,r.notas,r.origen,r.activo,r.created_at,r.updated_at
    from public.cable_rollos r
    left join public.almacenes a on a.id=r.almacen_id
    where (nullif(btrim(coalesce(p_material_codigo,'')),'') is null or lower(r.material_codigo)=lower(btrim(p_material_codigo)))
      and (p_almacen_id is null or r.almacen_id=p_almacen_id)
      and (coalesce(p_incluir_inactivos,false) or r.activo=true)
    order by r.material_codigo,a.nombre,case when r.metros_disponibles<r.metros_iniciales and r.metros_disponibles>0 then 0 else 1 end,r.codigo_rollo;
end;
$$;
revoke all on function public.crm_listar_rollos_cable(text,bigint,boolean) from public,anon;
grant execute on function public.crm_listar_rollos_cable(text,bigint,boolean) to authenticated;

create or replace function public.crm_guardar_rollo_cable(
    p_id bigint,
    p_material_codigo text,
    p_almacen_id bigint,
    p_codigo_rollo text,
    p_metros_iniciales numeric,
    p_metros_disponibles numeric,
    p_ubicacion text default null,
    p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_row public.cable_rollos%rowtype;
begin
    if not public.crm_puede_gestionar_rollos_cable() then raise exception using errcode='42501',message='Tu perfil no puede modificar rollos de cable.'; end if;
    if not exists(select 1 from public.materiales m where lower(m.codigo)=lower(btrim(p_material_codigo)) and lower(btrim(coalesce(m.categoria,''))) in ('cable','cables')) then raise exception 'El material % no pertenece a la categoría Cable/Cables.',p_material_codigo; end if;
    if not exists(select 1 from public.almacenes a where a.id=p_almacen_id) then raise exception 'El almacén seleccionado no existe.'; end if;
    if coalesce(p_metros_iniciales,0)<=0 then raise exception 'Los metros iniciales deben ser mayores a cero.'; end if;
    if coalesce(p_metros_disponibles,p_metros_iniciales)<0 or coalesce(p_metros_disponibles,p_metros_iniciales)>p_metros_iniciales then raise exception 'Los metros disponibles no son válidos.'; end if;

    if coalesce(p_id,0)>0 then
        update public.cable_rollos set
            material_codigo=(select m.codigo from public.materiales m where lower(m.codigo)=lower(btrim(p_material_codigo)) limit 1),
            almacen_id=p_almacen_id,codigo_rollo=btrim(p_codigo_rollo),metros_iniciales=p_metros_iniciales,
            metros_disponibles=coalesce(p_metros_disponibles,p_metros_iniciales),ubicacion=nullif(btrim(coalesce(p_ubicacion,'')),''),
            notas=nullif(btrim(coalesce(p_notas,'')),''),origen=case when origen in ('migracion_stock','stock_sin_identificar') then 'manual' else origen end,activo=true,updated_at=now()
        where id=p_id returning * into v_row;
        if not found then raise exception 'No se encontró el rollo solicitado.'; end if;
    else
        insert into public.cable_rollos(material_codigo,almacen_id,codigo_rollo,metros_iniciales,metros_disponibles,ubicacion,notas,origen,activo)
        values((select m.codigo from public.materiales m where lower(m.codigo)=lower(btrim(p_material_codigo)) limit 1),p_almacen_id,btrim(p_codigo_rollo),p_metros_iniciales,coalesce(p_metros_disponibles,p_metros_iniciales),nullif(btrim(coalesce(p_ubicacion,'')),''),nullif(btrim(coalesce(p_notas,'')),''),'manual',true)
        returning * into v_row;
    end if;
    return to_jsonb(v_row);
end;
$$;
revoke all on function public.crm_guardar_rollo_cable(bigint,text,bigint,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.crm_guardar_rollo_cable(bigint,text,bigint,text,numeric,numeric,text,text) to authenticated;

create or replace function public.crm_eliminar_rollo_cable(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.cable_rollos%rowtype;
begin
    if not public.crm_puede_gestionar_rollos_cable() then raise exception using errcode='42501',message='Tu perfil no puede retirar rollos de cable.'; end if;
    update public.cable_rollos set activo=false,estado='retirado',updated_at=now() where id=p_id returning * into v_row;
    if not found then raise exception 'No se encontró el rollo solicitado.'; end if;
    return jsonb_build_object('ok',true,'id',v_row.id,'codigo_rollo',v_row.codigo_rollo);
end;
$$;
revoke all on function public.crm_eliminar_rollo_cable(bigint) from public,anon;
grant execute on function public.crm_eliminar_rollo_cable(bigint) to authenticated;

create or replace function public.crm_recalcular_stock_rollos_cable(p_material_codigo text,p_almacen_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_stock numeric;
begin
    if not public.crm_puede_gestionar_rollos_cable() then raise exception using errcode='42501',message='Tu perfil no puede recalcular rollos de cable.'; end if;
    v_stock:=public.crm_sincronizar_stock_desde_rollos(btrim(p_material_codigo),p_almacen_id);
    return jsonb_build_object('ok',true,'material_codigo',btrim(p_material_codigo),'almacen_id',p_almacen_id,'stock_metros',v_stock);
end;
$$;
revoke all on function public.crm_recalcular_stock_rollos_cable(text,bigint) from public,anon;
grant execute on function public.crm_recalcular_stock_rollos_cable(text,bigint) to authenticated;

alter table public.cable_rollos enable row level security;
drop policy if exists "Cable rollos consulta" on public.cable_rollos;
create policy "Cable rollos consulta" on public.cable_rollos for select to authenticated using (
    public.crm_puede_gestionar_rollos_cable() or public.crm_es_direccion()
);
drop policy if exists "Cable rollos administra" on public.cable_rollos;
create policy "Cable rollos administra" on public.cable_rollos for all to authenticated using (
    public.crm_puede_gestionar_rollos_cable()
) with check (
    public.crm_puede_gestionar_rollos_cable()
);
grant select,insert,update,delete on public.cable_rollos to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create or replace function public.crm_sky_direccion_materiales()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
    if not public.crm_es_direccion() then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
        'codigo',m.codigo,'descripcion',m.descripcion,'categoria',m.categoria,'tipo_cable',m.tipo_cable,'tamano_mm2',m.tamano_mm2,
        'unidad',m.unidad,'marca',m.marca,'proveedor',m.proveedor,'modismos',to_jsonb(m.modismos),
        'stock',coalesce(inv.stock,0),'stock_minimo',coalesce(inv.stock_minimo,0),'stock_medio',coalesce(inv.stock_medio,0),'stock_maximo',coalesce(inv.stock_maximo,0),
        'almacenes',coalesce(inv.almacenes,'[]'::jsonb),'rollos_disponibles',coalesce(rr.rollos_disponibles,0),'metros_rollos',coalesce(rr.metros_rollos,0)
    ) order by m.codigo),'[]'::jsonb)
    into v_result
    from public.materiales m
    left join lateral(
        select sum(coalesce(e.stock,0))::numeric stock,sum(coalesce(e.stock_minimo,0))::numeric stock_minimo,sum(coalesce(e.stock_medio,0))::numeric stock_medio,sum(coalesce(e.stock_maximo,0))::numeric stock_maximo,
        coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nombre',a.nombre,'stock',coalesce(e.stock,0),'stockMinimo',coalesce(e.stock_minimo,0),'stockMedio',coalesce(e.stock_medio,0),'stockMaximo',coalesce(e.stock_maximo,0),'ubicacion',e.ubicacion) order by a.nombre),'[]'::jsonb) almacenes
        from public.existencias_almacen e left join public.almacenes a on a.id=e.almacen_id where e.material_codigo=m.codigo
    ) inv on true
    left join lateral(
        select count(*) filter(where r.activo=true and r.metros_disponibles>0)::bigint rollos_disponibles,
               coalesce(sum(r.metros_disponibles) filter(where r.activo=true),0)::numeric metros_rollos
        from public.cable_rollos r where r.material_codigo=m.codigo
    ) rr on true
    where coalesce(m.activo,true)=true;
    return v_result;
end;
$$;
revoke all on function public.crm_sky_direccion_materiales() from public,anon;
grant execute on function public.crm_sky_direccion_materiales() to authenticated;

create or replace function public.crm_sky_direccion_personal(p_proyecto text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb; v_project text:=nullif(btrim(coalesce(p_proyecto,'')),'');
begin
    if not public.crm_es_direccion() then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    if v_project is null then
        select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'numero_empleado',rp.numero_empleado,'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),'puesto',rp.puesto,'departamento',rp.departamento,'estado',rp.estado) order by rp.apellidos,rp.nombre),'[]'::jsonb)
        into v_result from public.rh_personal rp where lower(coalesce(rp.estado,''))='activo';
    else
        select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'numero_empleado',rp.numero_empleado,'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),'puesto',rp.puesto,'departamento',rp.departamento,'estado',rp.estado,'proyecto',a.proyecto_numero,'rol_proyecto',a.rol_proyecto,'porcentaje_dedicacion',coalesce(a.porcentaje_dedicacion,100),'fecha_inicio',a.fecha_inicio,'fecha_fin',a.fecha_fin) order by rp.apellidos,rp.nombre),'[]'::jsonb)
        into v_result from public.rh_proyecto_asignaciones a join public.rh_personal rp on rp.id=a.personal_id
        where a.proyecto_numero=v_project and lower(coalesce(a.estado,''))='activo' and lower(coalesce(rp.estado,''))='activo';
    end if;
    return v_result;
end;
$$;
revoke all on function public.crm_sky_direccion_personal(text) from public,anon;
grant execute on function public.crm_sky_direccion_personal(text) to authenticated;

create or replace function public.crm_sky_direccion_compras()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_proveedores jsonb:='[]'::jsonb; v_solicitudes jsonb:='[]'::jsonb; v_cotizaciones jsonb:='[]'::jsonb;
begin
    if not public.crm_es_direccion() then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.'; end if;
    if to_regclass('public.co_proveedores') is not null then execute 'select coalesce(jsonb_agg(to_jsonb(x) order by x.razon_social),''[]''::jsonb) from public.co_proveedores x where lower(coalesce(x.estado,''activo''))<>''inactivo''' into v_proveedores; end if;
    if to_regclass('public.solicitudes_compra') is not null then execute 'select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),''[]''::jsonb) from public.solicitudes_compra x' into v_solicitudes; end if;
    if to_regclass('public.co_cotizaciones') is not null then execute 'select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),''[]''::jsonb) from public.co_cotizaciones x' into v_cotizaciones; end if;
    return jsonb_build_object('proveedores',v_proveedores,'solicitudes',v_solicitudes,'cotizaciones',v_cotizaciones);
end;
$$;
revoke all on function public.crm_sky_direccion_compras() from public,anon;
grant execute on function public.crm_sky_direccion_compras() to authenticated;

create or replace function public.crm_direccion_vehiculos()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb:='[]'::jsonb;
begin
    if not public.crm_es_direccion() then raise exception using errcode='42501',message='Vehículos está disponible solo para perfiles autorizados.'; end if;
    if to_regclass('public.vehiculos') is not null then
        execute 'select coalesce(jsonb_agg(to_jsonb(v) order by v.numero_economico),''[]''::jsonb) from public.vehiculos v where coalesce(v.activo,true)=true' into v_result;
    end if;
    return v_result;
end;
$$;
revoke all on function public.crm_direccion_vehiculos() from public,anon;
grant execute on function public.crm_direccion_vehiculos() to authenticated;

create or replace function public.crm_sky_direccion_consultar(p_fuente text,p_filtro text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_fuente text:=lower(btrim(coalesce(p_fuente,'')));
    v_result jsonb:='[]'::jsonb;
    v_materiales_bajos bigint:=0;
    v_sin_ubicacion bigint:=0;
    v_incompletos bigint:=0;
    v_compras_pendientes bigint:=0;
begin
    if not public.crm_es_direccion() then raise exception using errcode='42501',message='Sky Dirección no tiene autorización para esta consulta.'; end if;

    if v_fuente='materiales' then return public.crm_sky_direccion_materiales(); end if;
    if v_fuente='personal' then return public.crm_sky_direccion_personal(p_filtro); end if;
    if v_fuente='compras' then return public.crm_sky_direccion_compras(); end if;
    if v_fuente='vehiculos' then return public.crm_direccion_vehiculos(); end if;

    if v_fuente='almacenes' then
        select coalesce(jsonb_agg(jsonb_build_object(
            'id',a.id,'nombre',a.nombre,'tipo',a.tipo,'ubicacion',a.ubicacion,'encargado',a.encargado,'estado',a.estado,
            'materiales',coalesce(x.materiales,0),'stock_total',coalesce(x.stock_total,0)
        ) order by a.nombre),'[]'::jsonb)
        into v_result
        from public.almacenes a
        left join lateral(
            select count(distinct e.material_codigo)::bigint materiales,coalesce(sum(e.stock),0)::numeric stock_total
            from public.existencias_almacen e where e.almacen_id=a.id
        ) x on true
        where lower(coalesce(a.estado,'activo'))<>'inactivo';
        return coalesce(v_result,'[]'::jsonb);
    end if;

    if v_fuente='herramientas' then
        if to_regclass('public.herramientas_catalogo') is null then return '[]'::jsonb; end if;
        execute $q$
            select coalesce(jsonb_agg(jsonb_build_object(
                'id',h.id,'sku',h.sku,'descripcion',h.descripcion,'clasificacion',h.clasificacion,'marca',h.marca,'modelo',h.modelo,'uso',h.uso,'unidad',h.unidad,'activo',h.activo,
                'total',coalesce(u.total,0),'disponibles',coalesce(u.disponibles,0),'asignadas',coalesce(u.asignadas,0),'otros',coalesce(u.otros,0)
            ) order by h.descripcion),'[]'::jsonb)
            from public.herramientas_catalogo h
            left join lateral(
                select sum(coalesce(nullif(hu.cantidad,0),1)) total,
                       sum(case when lower(coalesce(hu.estado,'disponible'))='disponible' then coalesce(nullif(hu.cantidad,0),1) else 0 end) disponibles,
                       sum(case when lower(coalesce(hu.estado,''))='asignada' then coalesce(nullif(hu.cantidad,0),1) else 0 end) asignadas,
                       sum(case when lower(coalesce(hu.estado,'disponible')) not in ('disponible','asignada') then coalesce(nullif(hu.cantidad,0),1) else 0 end) otros
                from public.herramientas_unidades hu where hu.herramienta_id=h.id and coalesce(hu.activo,true)=true and lower(coalesce(hu.estado,''))<>'baja'
            ) u on true
            where coalesce(h.activo,true)=true
        $q$ into v_result;
        return coalesce(v_result,'[]'::jsonb);
    end if;

    if v_fuente='proyectos' then
        if to_regprocedure('public.crm_resumen_ejecutivo_proyectos()') is not null then
            execute 'select coalesce(jsonb_agg(to_jsonb(s)),''[]''::jsonb) from public.crm_resumen_ejecutivo_proyectos() s' into v_result;
            return coalesce(v_result,'[]'::jsonb);
        end if;
        return '[]'::jsonb;
    end if;

    if v_fuente='alertas' then
        select count(*) into v_materiales_bajos from public.existencias_almacen e where coalesce(e.stock,0)<=coalesce(e.stock_minimo,0);
        select count(*) into v_sin_ubicacion from public.existencias_almacen e where coalesce(e.stock,0)>0 and nullif(btrim(coalesce(e.ubicacion,'')),'') is null;
        select count(*) into v_incompletos from public.materiales m where coalesce(m.es_incompleto,false)=true and coalesce(m.activo,true)=true;
        if to_regclass('public.solicitudes_compra') is not null then
            execute 'select count(*) from public.solicitudes_compra where lower(coalesce(estado_compras,''no_revisada'')) not in (''compra_realizada'',''no_viable'')' into v_compras_pendientes;
        end if;
        return jsonb_build_object('bajo_minimo',v_materiales_bajos,'sin_ubicacion',v_sin_ubicacion,'informacion_incompleta',v_incompletos,'compras_pendientes',v_compras_pendientes);
    end if;

    raise exception 'Fuente de Sky no válida: %',p_fuente;
end;
$$;
revoke all on function public.crm_sky_direccion_consultar(text,text) from public,anon;
grant execute on function public.crm_sky_direccion_consultar(text,text) to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V44-SKY-DIRECCION-CABLES-ROLLOS-2026-08-11',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select
    'OK' as estado,
    'CRM-V44-SKY-DIRECCION-CABLES-ROLLOS-2026-08-11' as version,
    case when exists(select 1 from public.perfiles_usuario p join auth.users u on u.id=p.id where lower(u.email)='gg@skilled.mx' and p.rol='gerente_general' and p.activo=true) then 'OK' else 'REVISAR_GG' end as gerente_general,
    case when exists(select 1 from public.perfiles_usuario p join auth.users u on u.id=p.id where lower(u.email)='subgg@skilled.mx' and p.rol='subgerente' and p.activo=true) then 'OK' else 'REVISAR_SUBGERENTE' end as subgerente,
    case when to_regprocedure('public.crm_sky_direccion_consultar(text,text)') is not null then 'OK' else 'FALTA' end as sky_direccion,
    case when to_regclass('public.cable_rollos') is not null then 'OK' else 'FALTA' end as control_rollos,
    (select count(*) from public.cable_rollos where activo=true) as rollos_activos,
    (select count(*) from public.materiales where lower(btrim(coalesce(categoria,''))) in ('cable','cables')) as materiales_cable;
