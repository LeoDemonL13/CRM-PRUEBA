begin;

create or replace function public.crm_sky_direccion_materiales()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_result jsonb;
begin
    if auth.uid() is null or not exists(
        select 1 from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')
    ) then
        raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'codigo',m.codigo,
        'descripcion',m.descripcion,
        'categoria',m.categoria,
        'tipo_cable',m.tipo_cable,
        'tamano_mm2',m.tamano_mm2,
        'unidad',m.unidad,
        'marca',m.marca,
        'proveedor',m.proveedor,
        'modismos',to_jsonb(m.modismos),
        'stock',coalesce(inv.stock,0),
        'stock_minimo',coalesce(inv.stock_minimo,0),
        'stock_medio',coalesce(inv.stock_medio,0),
        'stock_maximo',coalesce(inv.stock_maximo,0),
        'almacenes',coalesce(inv.almacenes,'[]'::jsonb)
    ) order by m.codigo),'[]'::jsonb)
    into v_result
    from public.materiales m
    left join lateral (
        select
            sum(coalesce(e.stock,0))::numeric stock,
            sum(coalesce(e.stock_minimo,0))::numeric stock_minimo,
            sum(coalesce(e.stock_medio,0))::numeric stock_medio,
            sum(coalesce(e.stock_maximo,0))::numeric stock_maximo,
            coalesce(jsonb_agg(jsonb_build_object(
                'id',a.id,
                'nombre',a.nombre,
                'stock',coalesce(e.stock,0),
                'stockMinimo',coalesce(e.stock_minimo,0),
                'stockMedio',coalesce(e.stock_medio,0),
                'stockMaximo',coalesce(e.stock_maximo,0),
                'ubicacion',e.ubicacion
            ) order by a.nombre),'[]'::jsonb) almacenes
        from public.existencias_almacen e
        left join public.almacenes a on a.id=e.almacen_id
        where e.material_codigo=m.codigo
    ) inv on true
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
declare
    v_result jsonb;
    v_project text:=nullif(btrim(coalesce(p_proyecto,'')),'');
begin
    if auth.uid() is null or not exists(
        select 1 from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')
    ) then
        raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.';
    end if;

    if v_project is null then
        select coalesce(jsonb_agg(jsonb_build_object(
            'id',rp.id,
            'numero_empleado',rp.numero_empleado,
            'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),
            'puesto',rp.puesto,
            'departamento',rp.departamento,
            'estado',rp.estado
        ) order by rp.apellidos,rp.nombre),'[]'::jsonb)
        into v_result
        from public.rh_personal rp
        where lower(coalesce(rp.estado,''))='activo';
    else
        select coalesce(jsonb_agg(jsonb_build_object(
            'id',rp.id,
            'numero_empleado',rp.numero_empleado,
            'nombre',btrim(coalesce(rp.nombre,'')||' '||coalesce(rp.apellidos,'')),
            'puesto',rp.puesto,
            'departamento',rp.departamento,
            'estado',rp.estado,
            'proyecto',a.proyecto_numero,
            'rol_proyecto',a.rol_proyecto,
            'porcentaje_dedicacion',coalesce(a.porcentaje_dedicacion,100),
            'fecha_inicio',a.fecha_inicio,
            'fecha_fin',a.fecha_fin
        ) order by rp.apellidos,rp.nombre),'[]'::jsonb)
        into v_result
        from public.rh_proyecto_asignaciones a
        join public.rh_personal rp on rp.id=a.personal_id
        where a.proyecto_numero=v_project
          and lower(coalesce(a.estado,''))='activo'
          and lower(coalesce(rp.estado,''))='activo';
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
declare
    v_proveedores jsonb;
    v_solicitudes jsonb;
    v_cotizaciones jsonb;
begin
    if auth.uid() is null or not exists(
        select 1 from public.perfiles_usuario p
        where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente')
    ) then
        raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.razon_social),'[]'::jsonb)
    into v_proveedores
    from public.co_proveedores x
    where lower(coalesce(x.estado,'activo'))<>'inactivo';

    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
    into v_solicitudes
    from public.solicitudes_compra x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
    into v_cotizaciones
    from public.co_cotizaciones x;

    return jsonb_build_object(
        'proveedores',v_proveedores,
        'solicitudes',v_solicitudes,
        'cotizaciones',v_cotizaciones
    );
end;
$$;

revoke all on function public.crm_sky_direccion_compras() from public,anon;
grant execute on function public.crm_sky_direccion_compras() to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V41-SKY-DIRECCION-VEHICULOS-2026-08-11',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;
