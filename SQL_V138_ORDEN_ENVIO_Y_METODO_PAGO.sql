begin;

alter table public.co_proveedores add column if not exists whatsapp text;

alter table public.solicitudes_compra
  add column if not exists metodo_pago text,
  add column if not exists condiciones_pago text,
  add column if not exists orden_enviada_at timestamptz,
  add column if not exists orden_enviada_por uuid references auth.users(id) on delete set null,
  add column if not exists orden_envio_canal text,
  add column if not exists orden_envio_destinatario text,
  add column if not exists orden_envio_message_id text;

create or replace function public.co_proteger_contenido_orden_firmada_v123()
returns trigger
language plpgsql
as $$
declare
  v_order text:=coalesce(nullif(btrim(old.orden_compra),''),nullif(btrim(old.grupo_orden),''),'');
  v_old jsonb;
  v_new jsonb;
  v_allowed text[]:=array['estado','cantidad_recibida','estado_compras','fecha_compra','motivo_no_viable','revisada_por','revisada_at','pdf_url','pdf_path','pdf_nombre','pdf_firma_revision_at','orden_enviada_at','orden_enviada_por','orden_envio_canal','orden_envio_destinatario','orden_envio_message_id','updated_at'];
  v_old_method text:=btrim(coalesce(old.metodo_pago,''));
  v_new_method text:=btrim(coalesce(new.metodo_pago,''));
  v_old_terms text:=btrim(coalesce(old.condiciones_pago,''));
  v_new_terms text:=btrim(coalesce(new.condiciones_pago,''));
begin
  if v_order='' then return new; end if;
  if not exists(select 1 from public.co_orden_firmas f where lower(btrim(f.orden_compra))=lower(v_order)) then return new; end if;

  v_old:=to_jsonb(old)-v_allowed-array['metodo_pago','condiciones_pago'];
  v_new:=to_jsonb(new)-v_allowed-array['metodo_pago','condiciones_pago'];
  if v_new is distinct from v_old then
    raise exception 'La orden % ya tiene aprobaciones. Reábrela para cambios; al hacerlo se retirarán todas las firmas y deberá aprobarse nuevamente.',v_order;
  end if;

  if v_old_method<>'' and v_new_method is distinct from v_old_method then
    raise exception 'El método de pago de una orden firmada no puede cambiarse. Reabre la orden para modificarlo.';
  end if;
  if v_old_terms<>'' and v_new_terms is distinct from v_old_terms then
    raise exception 'Las condiciones de pago de una orden firmada no pueden cambiarse. Reabre la orden para modificarlas.';
  end if;
  if v_old_method='' and v_new_method='' then
    null;
  elsif v_old_method='' and v_new_method<>'' then
    null;
  end if;
  if v_old_terms='' and v_new_terms='' then
    null;
  elsif v_old_terms='' and v_new_terms<>'' then
    null;
  end if;
  return new;
end;
$$;

create or replace function public.co_datos_envio_orden_v138(p_orden text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_order text:=btrim(coalesce(p_orden,''));
  v_profile public.perfiles_usuario%rowtype;
  v_first public.solicitudes_compra%rowtype;
  v_provider public.co_proveedores%rowtype;
  v_signatures integer:=0;
  v_missing text[]:=array[]::text[];
  v_method text;
  v_terms text;
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  select * into v_profile from public.perfiles_usuario where id=auth.uid() and activo=true;
  if not found or lower(coalesce(v_profile.rol,'')) not in ('administrador','compras') then
    raise exception using errcode='42501',message='Solo Compras o Administrador puede enviar órdenes de compra.';
  end if;
  if v_order='' then raise exception 'Orden no válida.'; end if;

  select * into v_first
  from public.solicitudes_compra s
  where lower(btrim(coalesce(s.orden_compra,'')))=lower(v_order)
     or lower(btrim(coalesce(s.grupo_orden,'')))=lower(v_order)
  order by s.id
  limit 1;
  if not found then raise exception 'No se encontró la orden de compra.'; end if;

  select count(distinct f.tipo) into v_signatures
  from public.co_orden_firmas f
  where lower(btrim(f.orden_compra))=lower(v_order)
    and f.tipo in ('solicito','elaboro','reviso','aprobo')
    and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null;

  v_method:=btrim(coalesce(v_first.metodo_pago,''));
  v_terms:=btrim(coalesce(v_first.condiciones_pago,''));
  if v_first.proveedor_id is not null then select * into v_provider from public.co_proveedores where id=v_first.proveedor_id; end if;
  if v_provider.id is null and nullif(btrim(coalesce(v_first.proveedor,'')),'') is not null then
    select * into v_provider from public.co_proveedores p where lower(btrim(coalesce(p.nombre_comercial,p.razon_social,'')))=lower(btrim(v_first.proveedor)) or lower(btrim(coalesce(p.razon_social,'')))=lower(btrim(v_first.proveedor)) order by p.id limit 1;
  end if;

  if v_signatures<4 then v_missing:=array_append(v_missing,'Faltan firmas de autorización.'); end if;
  if v_method='' then v_missing:=array_append(v_missing,'Falta especificar el método de pago.'); end if;
  if nullif(btrim(coalesce(v_first.pdf_url,'')),'') is null and nullif(btrim(coalesce(v_first.pdf_path,'')),'') is null then v_missing:=array_append(v_missing,'Falta generar el PDF final de la orden.'); end if;
  if nullif(btrim(coalesce(v_first.proveedor,'')),'') is null then v_missing:=array_append(v_missing,'Falta definir el proveedor.'); end if;
  if nullif(btrim(coalesce(v_provider.email,'')),'') is null and nullif(btrim(coalesce(v_provider.whatsapp,'')),'') is null and nullif(btrim(coalesce(v_provider.telefono,'')),'') is null then v_missing:=array_append(v_missing,'El proveedor no tiene correo ni teléfono/WhatsApp registrado.'); end if;

  return jsonb_build_object(
    'ok',true,'lista',cardinality(v_missing)=0,'orden_compra',v_order,'firmas',v_signatures,
    'metodo_pago',v_method,'condiciones_pago',v_terms,
    'proveedor_id',v_first.proveedor_id,'proveedor',coalesce(nullif(btrim(v_provider.nombre_comercial),''),nullif(btrim(v_provider.razon_social),''),v_first.proveedor,''),
    'contacto',coalesce(nullif(btrim(v_provider.contacto),''),v_first.contacto_proveedor,''),'email',coalesce(v_provider.email,''),'telefono',coalesce(v_provider.telefono,''),'whatsapp',coalesce(nullif(btrim(v_provider.whatsapp),''),v_provider.telefono,''),
    'pdf_url',coalesce(v_first.pdf_url,''),'pdf_path',coalesce(v_first.pdf_path,''),'pdf_nombre',coalesce(v_first.pdf_nombre,''),
    'orden_enviada_at',v_first.orden_enviada_at,'orden_envio_canal',coalesce(v_first.orden_envio_canal,''),'orden_envio_destinatario',coalesce(v_first.orden_envio_destinatario,''),
    'faltantes',to_jsonb(v_missing)
  );
end;
$$;

create or replace function public.co_marcar_orden_enviada_v138(p_orden text,p_canal text default 'manual',p_destinatario text default null,p_message_id text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_order text:=btrim(coalesce(p_orden,''));
  v_profile public.perfiles_usuario%rowtype;
  v_signatures integer:=0;
  v_method text;
  v_count integer:=0;
  v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  select * into v_profile from public.perfiles_usuario where id=auth.uid() and activo=true;
  if not found or lower(coalesce(v_profile.rol,'')) not in ('administrador','compras') then raise exception using errcode='42501',message='Solo Compras o Administrador puede registrar el envío de una orden.'; end if;
  if v_order='' then raise exception 'Orden no válida.'; end if;
  select count(distinct tipo) into v_signatures from public.co_orden_firmas where lower(btrim(orden_compra))=lower(v_order) and tipo in ('solicito','elaboro','reviso','aprobo') and nullif(btrim(coalesce(firma_data_url,'')),'') is not null;
  if v_signatures<4 then raise exception 'La orden requiere las cuatro firmas antes de enviarse.'; end if;
  select nullif(btrim(coalesce(metodo_pago,'')),'') into v_method from public.solicitudes_compra where lower(btrim(coalesce(orden_compra,'')))=lower(v_order) or lower(btrim(coalesce(grupo_orden,'')))=lower(v_order) order by id limit 1;
  if v_method is null then raise exception 'Especifica el método de pago antes de enviar la orden.'; end if;
  update public.solicitudes_compra
  set orden_enviada_at=v_now,orden_enviada_por=auth.uid(),orden_envio_canal=nullif(btrim(coalesce(p_canal,'')),''),orden_envio_destinatario=nullif(btrim(coalesce(p_destinatario,'')),''),orden_envio_message_id=nullif(btrim(coalesce(p_message_id,'')),''),estado=case when estado in ('recibida','cancelada') then estado else 'ordenada' end,estado_compras=case when estado_compras='no_viable' then estado_compras else 'compra_realizada' end,fecha_compra=coalesce(fecha_compra,current_date),updated_at=v_now
  where lower(btrim(coalesce(orden_compra,'')))=lower(v_order) or lower(btrim(coalesce(grupo_orden,'')))=lower(v_order);
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'No se encontró la orden de compra.'; end if;
  return jsonb_build_object('ok',true,'orden_compra',v_order,'actualizados',v_count,'enviada_at',v_now,'canal',p_canal,'destinatario',p_destinatario,'message_id',p_message_id);
end;
$$;

revoke all on function public.co_datos_envio_orden_v138(text) from public,anon;
revoke all on function public.co_marcar_orden_enviada_v138(text,text,text,text) from public,anon;
grant execute on function public.co_datos_envio_orden_v138(text) to authenticated;
grant execute on function public.co_marcar_orden_enviada_v138(text,text,text,text) to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V138-OC-METODO-PAGO-ENVIO-Y-CIERRE-PDF-2026-08-25',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select 'OK' as estado,'CRM-V138-OC-METODO-PAGO-ENVIO-Y-CIERRE-PDF-2026-08-25' as version,
       case when to_regprocedure('public.co_datos_envio_orden_v138(text)') is not null then 'OK' else 'FALTA' end as datos_envio,
       case when to_regprocedure('public.co_marcar_orden_enviada_v138(text,text,text,text)') is not null then 'OK' else 'FALTA' end as marcar_envio;
