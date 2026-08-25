
-- ============================================================
-- V137 · DIRECCION · HISTORIAL DE ORDENES + VISOR INTEGRADO
-- ============================================================
create or replace function public.co_ordenes_validacion_ejecutiva_v137()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_role text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='La sesión no está activa.';
  end if;

  select lower(btrim(coalesce(rol,'')))
  into v_role
  from public.perfiles_usuario
  where id=auth.uid() and activo=true;

  if v_role not in ('gerente_general','subgerente') then
    raise exception using errcode='42501', message='Solo Gerencia General y Subgerencia pueden consultar la validación de órdenes de compra.';
  end if;

  with orders as (
    select
      coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) as orden_compra,
      max(s.fecha_orden_compra)::text as fecha,
      max(nullif(btrim(s.proveedor),'')) as proveedor,
      max(nullif(btrim(s.referencia),'')) as referencia,
      max(nullif(btrim(s.solicitado_por),'')) as solicitado_por,
      count(*)::integer as materiales,
      sum(greatest(coalesce(s.cantidad_solicitada,0)-coalesce(s.cantidad_recibida,0),0)*coalesce(s.precio_cotizado,0)) as total,
      max(coalesce(nullif(btrim(s.moneda),''),'MXN')) as moneda,
      max(nullif(btrim(s.pdf_url),'')) as pdf_url,
      max(nullif(btrim(s.pdf_nombre),'')) as pdf_nombre
    from public.solicitudes_compra s
    where coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) is not null
    group by 1
  ), signatures as (
    select
      lower(btrim(f.orden_compra)) as orden_key,
      count(*) filter(where nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null)::integer as firmadas_count,
      bool_or(f.tipo='reviso' and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) as reviso_firmado,
      bool_or(f.tipo='aprobo' and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) as aprobo_firmado,
      bool_or(f.user_id=auth.uid() and f.tipo in ('reviso','aprobo') and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null) as mi_firma_ejecutiva,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'tipo',f.tipo,
            'nombre',f.nombre,
            'firmado_at',f.firmado_at,
            'user_id',f.user_id,
            'firma_slot',f.firma_slot,
            'firma_nombre_perfil',f.firma_nombre_perfil
          ) order by f.firmado_at nulls last,f.id
        ) filter(where nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null),
        '[]'::jsonb
      ) as firmas_resumen,
      coalesce(
        jsonb_agg(f.tipo order by f.firmado_at nulls last,f.id)
        filter(where f.user_id=auth.uid() and f.tipo in ('reviso','aprobo') and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null),
        '[]'::jsonb
      ) as mis_firmas
    from public.co_orden_firmas f
    group by lower(btrim(f.orden_compra))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'orden_compra',o.orden_compra,
        'fecha',o.fecha,
        'proveedor',o.proveedor,
        'referencia',o.referencia,
        'solicitado_por',o.solicitado_por,
        'materiales',o.materiales,
        'total',o.total,
        'moneda',o.moneda,
        'pdf_url',o.pdf_url,
        'pdf_nombre',o.pdf_nombre,
        'firmadas_count',coalesce(s.firmadas_count,0),
        'reviso_firmado',coalesce(s.reviso_firmado,false),
        'aprobo_firmado',coalesce(s.aprobo_firmado,false),
        'mi_firma_ejecutiva',coalesce(s.mi_firma_ejecutiva,false),
        'mis_firmas',coalesce(s.mis_firmas,'[]'::jsonb),
        'firmas_resumen',coalesce(s.firmas_resumen,'[]'::jsonb),
        'pendientes_ejecutivas',to_jsonb(array_remove(array[
          case when not coalesce(s.reviso_firmado,false) then 'Revisó' end,
          case when not coalesce(s.aprobo_firmado,false) then 'Aprobó' end
        ],null)),
        'estado_ejecutivo',case
          when coalesce(s.reviso_firmado,false) and coalesce(s.aprobo_firmado,false) then 'completa'
          when coalesce(s.mi_firma_ejecutiva,false) then 'firmada_por_mi'
          else 'pendiente'
        end
      )
      order by o.fecha desc nulls last,o.orden_compra desc
    ),
    '[]'::jsonb
  )
  into v_result
  from orders o
  left join signatures s on s.orden_key=lower(btrim(o.orden_compra));

  return v_result;
end;
$$;

revoke all on function public.co_ordenes_validacion_ejecutiva_v137() from public,anon;
grant execute on function public.co_ordenes_validacion_ejecutiva_v137() to authenticated;
