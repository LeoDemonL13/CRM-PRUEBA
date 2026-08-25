-- ============================================================
-- V135 · FIRMA DIRECTA DE OC + ESTADO ATOMICO
-- ============================================================
begin;

alter table public.co_orden_firmas add column if not exists firma_slot smallint;
alter table public.co_orden_firmas add column if not exists firma_nombre_perfil text;
alter table public.solicitudes_compra add column if not exists pdf_firma_revision_at timestamptz;

create or replace function public.co_estado_firmas_orden_v135(p_orden text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_requested text:=btrim(coalesce(p_orden,''));
  v_order text;
  v_author public.co_orden_autoria%rowtype;
  v_auth jsonb;
  v_signatures jsonb;
  v_count integer:=0;
  v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  if v_requested='' then return jsonb_build_object('revision','V135','firmas','[]'::jsonb,'firmadas_count',0,'autoria',jsonb_build_object('configurada',false)); end if;

  select coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) into v_order
  from public.solicitudes_compra s
  where lower(coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),''),''))=lower(v_requested)
  order by s.id limit 1;
  v_order:=coalesce(nullif(v_order,''),v_requested);

  select * into v_author from public.co_orden_autoria where orden_key=lower(btrim(v_order));
  if found then
    v_auth:=jsonb_build_object(
      'configurada',true,
      'orden_compra',v_author.orden_compra,
      'user_id',v_author.elaborada_por,
      'nombre',v_author.elaborada_por_nombre,
      'elaborada_at',v_author.elaborada_at,
      'origen',v_author.origen,
      'es_mia',v_author.elaborada_por=auth.uid()
    );
  else
    v_auth:=jsonb_build_object('configurada',false,'orden_compra',v_order,'es_mia',false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,
      'orden_compra',f.orden_compra,
      'tipo',f.tipo,
      'nombre',f.nombre,
      'firma_data_url',f.firma_data_url,
      'firma_slot',f.firma_slot,
      'firma_nombre_perfil',f.firma_nombre_perfil,
      'user_id',f.user_id,
      'firmado_at',f.firmado_at,
      'updated_at',f.updated_at
    ) order by f.id),'[]'::jsonb),count(*)::integer,max(f.firmado_at)
  into v_signatures,v_count,v_last
  from public.co_orden_firmas f
  where lower(btrim(f.orden_compra))=lower(btrim(v_order))
    and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null;

  return jsonb_build_object(
    'revision','V135',
    'orden_compra',v_order,
    'firmas',v_signatures,
    'firmadas_count',coalesce(v_count,0),
    'ultima_firma_at',v_last,
    'autoria',v_auth
  );
end;
$$;

create or replace function public.co_firmar_orden_con_mi_firma_v135(p_orden text,p_tipo text,p_firma_slot integer)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_requested text:=btrim(coalesce(p_orden,''));
  v_order text;
  v_type text:=lower(btrim(coalesce(p_tipo,'')));
  v_slot integer:=coalesce(p_firma_slot,0);
  v_profile public.perfiles_usuario%rowtype;
  v_signature text;
  v_signature_name text;
  v_existing public.co_orden_firmas%rowtype;
  v_row public.co_orden_firmas%rowtype;
  v_author public.co_orden_autoria%rowtype;
  v_auth jsonb;
  v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
  if v_requested='' then raise exception 'La orden de compra no tiene número.'; end if;
  if v_type not in ('solicito','elaboro','reviso','aprobo') then raise exception 'El tipo de firma no es válido.'; end if;
  if v_slot not between 1 and 3 then raise exception 'Selecciona una de tus tres firmas personales.'; end if;
  if v_type in ('reviso','aprobo') and not public.crm_usuario_tiene_rol(array['gerente_general','subgerente']) then
    raise exception 'El espacio % solo puede ser firmado por Gerente General o Subgerente.',case when v_type='reviso' then 'Revisó' else 'Aprobó' end;
  end if;

  select coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),'')) into v_order
  from public.solicitudes_compra s
  where lower(coalesce(nullif(btrim(s.orden_compra),''),nullif(btrim(s.grupo_orden),''),''))=lower(v_requested)
  order by s.id limit 1;
  if nullif(v_order,'') is null then raise exception 'No se encontró la orden de compra %.',v_requested; end if;

  perform pg_advisory_xact_lock(hashtext(lower(v_order)||':'||v_type));

  select * into v_profile
  from public.perfiles_usuario
  where id=auth.uid() and activo=true;
  if not found then raise exception 'Tu perfil no está activo.'; end if;

  if v_slot=1 then
    v_signature:=nullif(btrim(coalesce(v_profile.firma_data_url,'')),'');
    v_signature_name:=coalesce(nullif(btrim(v_profile.firma_1_nombre),''),'Firma 1');
  elsif v_slot=2 then
    v_signature:=nullif(btrim(coalesce(v_profile.firma_2_data_url,'')),'');
    v_signature_name:=coalesce(nullif(btrim(v_profile.firma_2_nombre),''),'Firma 2');
  else
    v_signature:=nullif(btrim(coalesce(v_profile.firma_3_data_url,'')),'');
    v_signature_name:=coalesce(nullif(btrim(v_profile.firma_3_nombre),''),'Firma 3');
  end if;

  if v_signature is null then raise exception '% no está configurada en tu perfil.',v_signature_name; end if;
  if v_signature !~ '^data:image/(png|jpeg|jpg|webp);base64,' then raise exception 'La firma guardada no es una imagen válida.'; end if;
  if length(v_signature)<100 then raise exception 'La imagen de firma está incompleta.'; end if;

  if v_type='elaboro' then
    select * into v_author from public.co_orden_autoria where orden_key=lower(btrim(v_order));
    if not found then raise exception 'Esta orden no tiene elaborador registrado.'; end if;
    if v_author.elaborada_por<>auth.uid() then
      raise exception 'El recuadro Elaboró pertenece a %. Solo esa cuenta puede firmarlo.',v_author.elaborada_por_nombre;
    end if;
  end if;

  select * into v_existing
  from public.co_orden_firmas
  where lower(btrim(orden_compra))=lower(btrim(v_order)) and tipo=v_type
  order by id limit 1 for update;

  if found then
    if v_existing.user_id<>auth.uid() then raise exception 'El espacio % ya fue firmado por otra cuenta.',v_type; end if;
    update public.co_orden_firmas
    set orden_compra=v_order,
        nombre=coalesce(nullif(btrim(v_profile.nombre),''),coalesce(auth.jwt()->>'email','Usuario')),
        firma_data_url=v_signature,
        firma_slot=v_slot,
        firma_nombre_perfil=v_signature_name,
        user_id=auth.uid(),
        firmado_at=clock_timestamp(),
        updated_at=clock_timestamp()
    where id=v_existing.id
    returning * into v_row;
  else
    insert into public.co_orden_firmas(
      orden_compra,tipo,nombre,firma_data_url,firma_slot,firma_nombre_perfil,user_id,firmado_at,updated_at
    ) values(
      v_order,v_type,coalesce(nullif(btrim(v_profile.nombre),''),coalesce(auth.jwt()->>'email','Usuario')),
      v_signature,v_slot,v_signature_name,auth.uid(),clock_timestamp(),clock_timestamp()
    ) returning * into v_row;
  end if;

  if v_row.id is null then raise exception 'La firma no pudo guardarse.'; end if;
  if nullif(btrim(coalesce(v_row.firma_data_url,'')),'') is null or length(v_row.firma_data_url)<100 then
    raise exception 'La aprobación se guardó sin la imagen de firma.';
  end if;
  if v_row.firma_data_url<>v_signature then raise exception 'La firma guardada no coincide con la seleccionada.'; end if;

  update public.solicitudes_compra
  set pdf_firma_revision_at=null,updated_at=now()
  where lower(coalesce(nullif(btrim(orden_compra),''),nullif(btrim(grupo_orden),''),''))=lower(v_order);

  select count(*)::integer into v_count
  from public.co_orden_firmas f
  where lower(btrim(f.orden_compra))=lower(btrim(v_order))
    and nullif(btrim(coalesce(f.firma_data_url,'')),'') is not null;

  select * into v_author from public.co_orden_autoria where orden_key=lower(btrim(v_order));
  if found then
    v_auth:=jsonb_build_object(
      'configurada',true,'orden_compra',v_author.orden_compra,'user_id',v_author.elaborada_por,
      'nombre',v_author.elaborada_por_nombre,'elaborada_at',v_author.elaborada_at,'origen',v_author.origen,
      'es_mia',v_author.elaborada_por=auth.uid()
    );
  else
    v_auth:=jsonb_build_object('configurada',false,'orden_compra',v_order,'es_mia',false);
  end if;

  return jsonb_build_object(
    'ok',true,
    'revision','V135',
    'firmadas_count',coalesce(v_count,0),
    'autoria',v_auth,
    'firma',jsonb_build_object(
      'id',v_row.id,
      'orden_compra',v_row.orden_compra,
      'tipo',v_row.tipo,
      'nombre',v_row.nombre,
      'firma_data_url',v_row.firma_data_url,
      'firma_slot',v_row.firma_slot,
      'firma_nombre_perfil',v_row.firma_nombre_perfil,
      'user_id',v_row.user_id,
      'firmado_at',v_row.firmado_at,
      'updated_at',v_row.updated_at
    )
  );
end;
$$;

revoke all on function public.co_estado_firmas_orden_v135(text) from public,anon;
revoke all on function public.co_firmar_orden_con_mi_firma_v135(text,text,integer) from public,anon;
grant execute on function public.co_estado_firmas_orden_v135(text) to authenticated;
grant execute on function public.co_firmar_orden_con_mi_firma_v135(text,text,integer) to authenticated;

insert into public.crm_migraciones(version,aplicada_at)
values('CRM-V135-FIRMA-DIRECTA-OC-ESTADO-ATOMICO-2026-08-25',now())
on conflict(version) do update set aplicada_at=excluded.aplicada_at;

notify pgrst,'reload schema';
commit;

select 'OK' as estado,
       'CRM-V135-FIRMA-DIRECTA-OC-ESTADO-ATOMICO-2026-08-25' as revision,
       case when to_regprocedure('public.co_estado_firmas_orden_v135(text)') is not null then 'OK' else 'FALTA' end as estado_firmas_v135,
       case when to_regprocedure('public.co_firmar_orden_con_mi_firma_v135(text,text,integer)') is not null then 'OK' else 'FALTA' end as firma_oc_v135;
