-- ============================================================
-- V136 · SKILL POR PERFIL + VALIDACION EJECUTIVA DE OC
-- ============================================================
begin;

create or replace function public.crm_skill_perfil_consultar_v136(p_fuente text,p_filtro text default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  v_role text; v_fuente text:=lower(btrim(coalesce(p_fuente,''))); v_filtro text:=nullif(btrim(coalesce(p_filtro,'')),''); v_result jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
  select lower(btrim(rol)) into v_role from public.perfiles_usuario where id=auth.uid() and activo=true;
  if v_role is null then raise exception using errcode='42501',message='Tu perfil no está activo para Skill.'; end if;
  v_fuente:=case v_fuente when 'projectdetails' then 'proyectos' when 'purchases' then 'compras' when 'suppliers' then 'proveedores' when 'quotations' then 'cotizaciones' else v_fuente end;
  if v_role not in ('gerente_general','subgerente') then
    if v_role='administrador' and v_fuente not in ('') then raise exception using errcode='42501',message='Skill Administración no consulta datos operativos de otros perfiles.'; end if;
    if v_role='sky_demo' then raise exception using errcode='42501',message='Skill Presentación no tiene acceso transversal a datos operativos.'; end if;
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

create or replace function public.co_ordenes_pendientes_firma_ejecutiva_v136()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare v_role text; v_result jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='La sesión no está activa.'; end if;
  select lower(btrim(rol)) into v_role from public.perfiles_usuario where id=auth.uid() and activo=true;
  if v_role not in ('gerente_general','subgerente') then raise exception using errcode='42501',message='Solo Gerencia General y Subgerencia pueden validar órdenes de compra.'; end if;
  with orders as (
    select coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) orden_compra,
      max(s.fecha_orden_compra)::text fecha,max(nullif(btrim(s.proveedor),'')) proveedor,max(nullif(btrim(s.referencia),'')) referencia,max(nullif(btrim(s.solicitado_por),'')) solicitado_por,
      count(*)::integer materiales,sum(greatest(coalesce(s.cantidad_solicitada,0)-coalesce(s.cantidad_recibida,0),0)*coalesce(s.precio_cotizado,0)) total,max(coalesce(nullif(btrim(s.moneda),''),'MXN')) moneda,
      max(nullif(btrim(s.pdf_url),'')) pdf_url,max(nullif(btrim(s.pdf_nombre),'')) pdf_nombre
    from public.solicitudes_compra s where coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) is not null group by 1
  ), sig as (
    select lower(btrim(f.orden_compra)) k,count(*) filter(where nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null)::integer firmadas_count,
      bool_or(f.tipo='reviso' and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) reviso_firmado,
      bool_or(f.tipo='aprobo' and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) aprobo_firmado,
      bool_or(f.user_id=auth.uid() and f.tipo in ('reviso','aprobo') and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) mi_firma_ejecutiva
    from public.co_orden_firmas f group by lower(btrim(f.orden_compra))
  )
  select coalesce(jsonb_agg(jsonb_build_object('orden_compra',o.orden_compra,'fecha',o.fecha,'proveedor',o.proveedor,'referencia',o.referencia,'solicitado_por',o.solicitado_por,'materiales',o.materiales,'total',o.total,'moneda',o.moneda,'pdf_url',o.pdf_url,'pdf_nombre',o.pdf_nombre,'firmadas_count',coalesce(s.firmadas_count,0),'reviso_firmado',coalesce(s.reviso_firmado,false),'aprobo_firmado',coalesce(s.aprobo_firmado,false),'mi_firma_ejecutiva',coalesce(s.mi_firma_ejecutiva,false),'pendientes_ejecutivas',to_jsonb(array_remove(array[case when not coalesce(s.reviso_firmado,false) then 'Revisó' end,case when not coalesce(s.aprobo_firmado,false) then 'Aprobó' end],null))) order by o.fecha desc nulls last,o.orden_compra desc),'[]'::jsonb)
  into v_result from orders o left join sig s on s.k=lower(btrim(o.orden_compra)) where (not coalesce(s.reviso_firmado,false) or not coalesce(s.aprobo_firmado,false)) and not coalesce(s.mi_firma_ejecutiva,false);
  return v_result;
end; $$;

revoke all on function public.crm_skill_perfil_consultar_v136(text,text) from public,anon;
revoke all on function public.co_ordenes_pendientes_firma_ejecutiva_v136() from public,anon;
grant execute on function public.crm_skill_perfil_consultar_v136(text,text) to authenticated;
grant execute on function public.co_ordenes_pendientes_firma_ejecutiva_v136() to authenticated;


-- ============================================================
-- V136 · ENDURECIMIENTO FINAL DE DIRECCION Y REUNIONES
-- ============================================================
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
          and lower(btrim(coalesce(p.rol,''))) in ('gerente_general','subgerente')
    );
$$;
revoke all on function public.crm_es_direccion() from public,anon;
grant execute on function public.crm_es_direccion() to authenticated;

drop policy if exists skill_reuniones_select_v105 on public.skill_reuniones;
create policy skill_reuniones_select_v105 on public.skill_reuniones
for select to authenticated
using (
    creador_id=auth.uid()
    or exists(
        select 1
        from public.perfiles_usuario p
        where p.id=auth.uid()
          and p.activo=true
          and lower(btrim(coalesce(p.rol,''))) in ('gerente_general','subgerente')
    )
);

drop policy if exists skill_reunion_intervenciones_select_v105 on public.skill_reunion_intervenciones;
create policy skill_reunion_intervenciones_select_v105 on public.skill_reunion_intervenciones
for select to authenticated
using (
    exists(
        select 1
        from public.skill_reuniones r
        where r.id=reunion_id
          and (
              r.creador_id=auth.uid()
              or exists(
                  select 1 from public.perfiles_usuario p
                  where p.id=auth.uid()
                    and p.activo=true
                    and lower(btrim(coalesce(p.rol,''))) in ('gerente_general','subgerente')
              )
          )
    )
);

create or replace function public.crm_skill_reuniones_listar_v105(p_limite integer default 20)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v_role text;
    v_limit integer:=least(100,greatest(1,coalesce(p_limite,20)));
    v_result jsonb:='[]'::jsonb;
begin
    if auth.uid() is null then
        raise exception using errcode='42501',message='La sesión no está activa.';
    end if;
    select lower(btrim(coalesce(p.rol,''))) into v_role
      from public.perfiles_usuario p
     where p.id=auth.uid() and p.activo=true;
    if v_role is null or v_role='' then
        raise exception using errcode='42501',message='Tu perfil no está activo para SKILL Reuniones.';
    end if;

    select coalesce(jsonb_agg(x.item order by x.creado_at desc),'[]'::jsonb)
      into v_result
      from (
        select r.creado_at,
               jsonb_build_object(
                   'id',r.id,
                   'titulo',r.titulo,
                   'perfil',r.perfil,
                   'participantes',r.participantes,
                   'inicio_at',r.inicio_at,
                   'fin_at',r.fin_at,
                   'duracion_seg',r.duracion_seg,
                   'resumen',r.resumen,
                   'acuerdos',r.acuerdos,
                   'estado',r.estado,
                   'creado_at',r.creado_at,
                   'creador_id',r.creador_id,
                   'intervenciones',(select count(*) from public.skill_reunion_intervenciones i where i.reunion_id=r.id)
               ) item
          from public.skill_reuniones r
         where r.creador_id=auth.uid()
            or v_role in ('gerente_general','subgerente')
         order by r.creado_at desc
         limit v_limit
      ) x;
    return coalesce(v_result,'[]'::jsonb);
end;
$$;
revoke all on function public.crm_skill_reuniones_listar_v105(integer) from public,anon;
grant execute on function public.crm_skill_reuniones_listar_v105(integer) to authenticated;

insert into public.crm_migraciones(version,aplicada_at) values('CRM-V136-SKILL-PERFIL-REUNIONES-Y-VALIDACION-OC-2026-08-25',now()) on conflict(version) do update set aplicada_at=excluded.aplicada_at;
notify pgrst,'reload schema';
commit;
select 'OK' estado,'CRM-V136-SKILL-PERFIL-REUNIONES-Y-VALIDACION-OC-2026-08-25' revision;
