begin;

alter table public.perfiles_usuario drop constraint if exists perfiles_usuario_rol_check;
alter table public.perfiles_usuario add constraint perfiles_usuario_rol_check
check (rol in ('administrador','jefe_almacen','almacen','compras','proyectos','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'));

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
    if p_rol not in ('administrador','jefe_almacen','almacen','compras','proyectos','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta') then raise exception 'Rol no válido: %',p_rol; end if;
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

create or replace function public.crm_es_direccion()
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
    select auth.uid() is not null and exists(
        select 1
        from public.perfiles_usuario p
        where p.id=auth.uid()
          and p.activo=true
          and p.rol in ('administrador','gerente_general','subgerente','sky_demo')
    );
$$;
revoke all on function public.crm_es_direccion() from public,anon;
grant execute on function public.crm_es_direccion() to authenticated;

create or replace function public.crm_resumen_ejecutivo_proyectos()
returns table(
    proyecto text,nombre text,cliente text,responsable text,estado text,fecha_inicio date,fecha_entrega date,
    material_planeado numeric,material_real numeric,nomina_planeada numeric,nomina_real numeric,total_planeado numeric,total_real numeric,desviacion_total numeric
)
language plpgsql
security definer
set search_path=public
as $$
begin
    if not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente','sky_demo')) then
        raise exception using errcode='42501',message='Este resumen está disponible solo para Dirección.';
    end if;
    return query
    with plan_lines as (
        select pm.proyecto_numero,pm.material_codigo codigo,coalesce(pm.cantidad_planeada,0)::numeric cantidad,
               coalesce(nullif(pm.precio_unitario,0),m.precio,0)::numeric precio
        from public.proyecto_materiales pm left join public.materiales m on m.codigo=pm.material_codigo
        union all
        select pn.proyecto_numero,pn.codigo_manual,coalesce(pn.cantidad_planeada,0)::numeric,
               coalesce(pn.precio_unitario,0)::numeric
        from public.proyecto_materiales_no_listados pn
    ), material_plan as (
        select proyecto_numero,sum(cantidad*precio)::numeric material_planeado from plan_lines group by proyecto_numero
    ), move_code as (
        select mv.proyecto proyecto_numero,coalesce(nullif(mv.material_codigo,''),nullif(mv.codigo_manual,'')) codigo,
               sum(case when lower(coalesce(mv.tipo,''))='entrada' then coalesce(mv.cantidad,0) else 0 end)::numeric entrada,
               sum(case when lower(coalesce(mv.tipo,''))='salida' then coalesce(mv.cantidad,0)
                        when lower(coalesce(mv.tipo,''))='reingreso' then -coalesce(mv.cantidad,0)
                        when lower(coalesce(mv.tipo,''))='ajuste' and lower(coalesce(mv.ajuste_accion,''))='disminuir' then coalesce(mv.cantidad,0)
                        else 0 end)::numeric entregado,
               max(coalesce(nullif(mv.precio_unitario,0),m.precio,0))::numeric precio
        from public.movimientos mv left join public.materiales m on m.codigo=mv.material_codigo
        where nullif(btrim(coalesce(mv.proyecto,'')),'') is not null
        group by mv.proyecto,coalesce(nullif(mv.material_codigo,''),nullif(mv.codigo_manual,''))
    ), material_real as (
        select proyecto_numero,sum(greatest(coalesce(entrada,0),greatest(coalesce(entregado,0),0))*coalesce(precio,0))::numeric material_real
        from move_code group by proyecto_numero
    ), payroll as (
        select a.proyecto_numero,
          sum((case when rp.esquema_pago='hora' then coalesce(rp.tarifa_pago,0)*greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0)
                    else coalesce(nullif(rp.salario_semanal_calculado,0),rp.tarifa_pago,rp.salario,0)/greatest(coalesce(rp.dias_laborales_semana,6),1) end)
              * greatest(0,(coalesce(a.fecha_fin,p.fecha_entrega,current_date)-a.fecha_inicio+1)) * greatest(coalesce(rp.dias_laborales_semana,6),1)/7.0
              * coalesce(a.porcentaje_dedicacion,100)/100.0)::numeric nomina_planeada,
          sum((case when rp.esquema_pago='hora' then coalesce(rp.tarifa_pago,0)*greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0)
                    else coalesce(nullif(rp.salario_semanal_calculado,0),rp.tarifa_pago,rp.salario,0)/greatest(coalesce(rp.dias_laborales_semana,6),1) end)
              * greatest(0,(least(current_date,coalesce(a.fecha_fin,p.fecha_entrega,current_date))-a.fecha_inicio+1)) * greatest(coalesce(rp.dias_laborales_semana,6),1)/7.0
              * coalesce(a.porcentaje_dedicacion,100)/100.0)::numeric nomina_real
        from public.rh_proyecto_asignaciones a join public.rh_personal rp on rp.id=a.personal_id join public.proyectos p on p.numero_proyecto=a.proyecto_numero
        where a.estado<>'cancelado'
        group by a.proyecto_numero
    )
    select p.numero_proyecto,p.nombre_proyecto,p.cliente,p.responsable_skilled,p.estado,p.fecha_asignacion,p.fecha_entrega,
      coalesce(nullif(p.presupuesto_materiales,0),nullif(case when p.tipo_control='presupuesto' then p.presupuesto_planeado else 0 end,0),mp.material_planeado,0),
      coalesce(mr.material_real,0),
      coalesce(nullif(p.presupuesto_sueldos,0),py.nomina_planeada,0),coalesce(py.nomina_real,0),
      coalesce(nullif(p.presupuesto_materiales,0),nullif(case when p.tipo_control='presupuesto' then p.presupuesto_planeado else 0 end,0),mp.material_planeado,0)+coalesce(nullif(p.presupuesto_sueldos,0),py.nomina_planeada,0),
      coalesce(mr.material_real,0)+coalesce(py.nomina_real,0),
      (coalesce(mr.material_real,0)+coalesce(py.nomina_real,0))-(coalesce(nullif(p.presupuesto_materiales,0),nullif(case when p.tipo_control='presupuesto' then p.presupuesto_planeado else 0 end,0),mp.material_planeado,0)+coalesce(nullif(p.presupuesto_sueldos,0),py.nomina_planeada,0))
    from public.proyectos p left join material_plan mp on mp.proyecto_numero=p.numero_proyecto left join material_real mr on mr.proyecto_numero=p.numero_proyecto left join payroll py on py.proyecto_numero=p.numero_proyecto
    order by p.fecha_entrega nulls last,p.numero_proyecto;
end;
$$;
revoke all on function public.crm_resumen_ejecutivo_proyectos() from public,anon;
grant execute on function public.crm_resumen_ejecutivo_proyectos() to authenticated;

create or replace function public.crm_detalle_ejecutivo_proyecto(p_proyecto text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_summary record; v_materiales jsonb; v_personal jsonb;
begin
    if not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente','sky_demo')) then
        raise exception using errcode='42501',message='Este detalle está disponible solo para Dirección.';
    end if;
    select * into v_summary from public.crm_resumen_ejecutivo_proyectos() s where s.proyecto=p_proyecto;
    if not found then raise exception 'No se encontró el proyecto %.',p_proyecto; end if;

    with plan_lines as (
        select pm.material_codigo codigo,coalesce(m.descripcion,pm.material_codigo) descripcion,coalesce(pm.cantidad_planeada,0)::numeric cantidad_planeada,
               coalesce(nullif(pm.precio_unitario,0),m.precio,0)::numeric precio from public.proyecto_materiales pm left join public.materiales m on m.codigo=pm.material_codigo where pm.proyecto_numero=p_proyecto
        union all
        select pn.codigo_manual,coalesce(nullif(pn.descripcion,''),pn.codigo_manual),coalesce(pn.cantidad_planeada,0)::numeric,coalesce(pn.precio_unitario,0)::numeric from public.proyecto_materiales_no_listados pn where pn.proyecto_numero=p_proyecto
    ), moves as (
        select coalesce(nullif(mv.material_codigo,''),nullif(mv.codigo_manual,'')) codigo,
               sum(case when lower(coalesce(mv.tipo,''))='entrada' then coalesce(mv.cantidad,0) else 0 end)::numeric entrada,
               sum(case when lower(coalesce(mv.tipo,''))='salida' then coalesce(mv.cantidad,0) when lower(coalesce(mv.tipo,''))='reingreso' then -coalesce(mv.cantidad,0) when lower(coalesce(mv.tipo,''))='ajuste' and lower(coalesce(mv.ajuste_accion,''))='disminuir' then coalesce(mv.cantidad,0) else 0 end)::numeric entregado,
               max(coalesce(nullif(mv.precio_unitario,0),m.precio,0))::numeric precio
        from public.movimientos mv left join public.materiales m on m.codigo=mv.material_codigo where mv.proyecto=p_proyecto
        group by coalesce(nullif(mv.material_codigo,''),nullif(mv.codigo_manual,''))
    ), combined as (
        select coalesce(pl.codigo,mv.codigo) codigo,coalesce(pl.descripcion,coalesce(mat.descripcion,mv.codigo)) descripcion,coalesce(pl.cantidad_planeada,0) cantidad_planeada,
               greatest(coalesce(mv.entrada,0),greatest(coalesce(mv.entregado,0),0)) cantidad_real,
               coalesce(pl.precio,mv.precio,0) precio_plan,coalesce(mv.precio,pl.precio,0) precio_real
        from plan_lines pl full join moves mv on lower(mv.codigo)=lower(pl.codigo) left join public.materiales mat on mat.codigo=mv.codigo
    )
    select coalesce(jsonb_agg(jsonb_build_object('codigo',codigo,'descripcion',descripcion,'cantidad_planeada',cantidad_planeada,'cantidad_real',cantidad_real,'costo_planeado',cantidad_planeada*precio_plan,'costo_real',cantidad_real*precio_real,'diferencia',(cantidad_real*precio_real)-(cantidad_planeada*precio_plan)) order by codigo),'[]'::jsonb) into v_materiales from combined;

    select coalesce(jsonb_agg(jsonb_build_object(
        'numero_empleado',rp.numero_empleado,'nombre',btrim(rp.nombre||' '||rp.apellidos),'puesto',rp.puesto,'rol_proyecto',a.rol_proyecto,'fecha_inicio',a.fecha_inicio,
        'fecha_fin',coalesce(a.fecha_fin,p.fecha_entrega),'porcentaje_dedicacion',coalesce(a.porcentaje_dedicacion,100),
        'costo_planeado',(case when rp.esquema_pago='hora' then coalesce(rp.tarifa_pago,0)*greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0) else coalesce(nullif(rp.salario_semanal_calculado,0),rp.tarifa_pago,rp.salario,0)/greatest(coalesce(rp.dias_laborales_semana,6),1) end)*greatest(0,(coalesce(a.fecha_fin,p.fecha_entrega,current_date)-a.fecha_inicio+1))*greatest(coalesce(rp.dias_laborales_semana,6),1)/7.0*coalesce(a.porcentaje_dedicacion,100)/100.0,
        'costo_real',(case when rp.esquema_pago='hora' then coalesce(rp.tarifa_pago,0)*greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0) else coalesce(nullif(rp.salario_semanal_calculado,0),rp.tarifa_pago,rp.salario,0)/greatest(coalesce(rp.dias_laborales_semana,6),1) end)*greatest(0,(least(current_date,coalesce(a.fecha_fin,p.fecha_entrega,current_date))-a.fecha_inicio+1))*greatest(coalesce(rp.dias_laborales_semana,6),1)/7.0*coalesce(a.porcentaje_dedicacion,100)/100.0
    ) order by rp.apellidos,rp.nombre),'[]'::jsonb) into v_personal
    from public.rh_proyecto_asignaciones a join public.rh_personal rp on rp.id=a.personal_id join public.proyectos p on p.numero_proyecto=a.proyecto_numero
    where a.proyecto_numero=p_proyecto and a.estado<>'cancelado';

    return jsonb_build_object('proyecto',v_summary.proyecto,'nombre',v_summary.nombre,'cliente',v_summary.cliente,'responsable',v_summary.responsable,'estado',v_summary.estado,
      'material_planeado',v_summary.material_planeado,'material_real',v_summary.material_real,'nomina_planeada',v_summary.nomina_planeada,'nomina_real',v_summary.nomina_real,
      'total_planeado',v_summary.total_planeado,'total_real',v_summary.total_real,'desviacion_total',v_summary.desviacion_total,'materiales',v_materiales,'personal',v_personal);
end;
$$;
revoke all on function public.crm_detalle_ejecutivo_proyecto(text) from public,anon;
grant execute on function public.crm_detalle_ejecutivo_proyecto(text) to authenticated;

create or replace function public.crm_sky_direccion_activos_oficina()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare v_activos jsonb;v_asignaciones jsonb;
begin
    if not exists(select 1 from public.perfiles_usuario p where p.id=auth.uid() and p.activo=true and p.rol in ('administrador','gerente_general','subgerente','sky_demo')) then raise exception using errcode='42501',message='Esta consulta de Sky está disponible solo para Dirección.';end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'codigo',x.codigo,'nombre',x.nombre,'categoria',x.categoria,'marca',x.marca,'modelo',x.modelo,'numeroSerie',x.numero_serie,'unidad',x.unidad,'cantidadTotal',x.cantidad_total,'asignado',x.asignado,'noDisponible',x.no_disponible,'disponible',greatest(x.cantidad_total-x.no_disponible,0),'ubicacion',x.ubicacion,'estado',x.estado) order by x.nombre),'[]'::jsonb) into v_activos from (select a.*,coalesce(sum(r.cantidad) filter(where r.estado='asignado'),0) asignado,coalesce(sum(r.cantidad) filter(where r.estado in ('asignado','danado','perdido')),0) no_disponible from public.rh_activos_oficina a left join public.rh_activos_asignaciones r on r.activo_id=a.id group by a.id)x;
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'activoId',a.id,'activoCodigo',a.codigo,'activoNombre',a.nombre,'categoria',a.categoria,'marca',a.marca,'modelo',a.modelo,'numeroSerie',a.numero_serie,'unidad',a.unidad,'personalId',p.id,'personalNumero',p.numero_empleado,'personalNombre',btrim(coalesce(p.nombre,'')||' '||coalesce(p.apellidos,'')),'puesto',p.puesto,'departamento',p.departamento,'cantidad',r.cantidad,'fechaAsignacion',r.fecha_asignacion,'fechaDevolucion',r.fecha_devolucion,'estado',r.estado,'condicionEntrega',r.condicion_entrega,'condicionDevolucion',r.condicion_devolucion,'responsableEntrega',r.responsable_entrega,'responsableRecepcion',r.responsable_recepcion) order by r.fecha_asignacion desc,r.id desc),'[]'::jsonb) into v_asignaciones from public.rh_activos_asignaciones r join public.rh_activos_oficina a on a.id=r.activo_id join public.rh_personal p on p.id=r.personal_id;
    return jsonb_build_object('activos',v_activos,'asignaciones',v_asignaciones);
end;
$$;
revoke all on function public.crm_sky_direccion_activos_oficina() from public,anon;
grant execute on function public.crm_sky_direccion_activos_oficina() to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V48-SKY-PRESENTACION-2026-08-11',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select
    'OK' as estado,
    'CRM-V48-SKY-PRESENTACION-2026-08-11' as version,
    case when to_regprocedure('public.crm_sky_direccion_consultar(text,text)') is not null then 'OK' else 'FALTA' end as sky_consulta_transversal,
    case when to_regprocedure('public.crm_sky_direccion_activos_oficina()') is not null then 'OK' else 'FALTA' end as sky_resguardos,
    case when to_regprocedure('public.crm_resumen_ejecutivo_proyectos()') is not null then 'OK' else 'FALTA' end as sky_proyectos,
    case when to_regprocedure('public.crm_asignar_rol_por_correo(text,text,boolean)') is not null then 'OK' else 'FALTA' end as asignacion_rol;
