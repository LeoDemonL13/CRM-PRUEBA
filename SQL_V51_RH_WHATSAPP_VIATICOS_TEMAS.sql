begin;

alter table public.perfiles_usuario add column if not exists preferencias_ui jsonb not null default '{}'::jsonb;

create or replace function public.crm_guardar_preferencias_ui(p_preferencias jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
    v jsonb:=coalesce(p_preferencias,'{}'::jsonb);
    v_mode text:=lower(coalesce(v->>'mode','empresa'));
    v_base text:=lower(coalesce(v->>'base','oscuro'));
    k text;
    c text;
begin
    if auth.uid() is null then raise exception 'La sesión no está activa.'; end if;
    if v_mode not in ('empresa','claro','personalizado') then raise exception 'Modo visual no válido.'; end if;
    if v_base not in ('oscuro','claro') then raise exception 'Base visual no válida.'; end if;
    foreach k in array array['primary','primaryBright','accent','background','surface','surface2','border','text','muted'] loop
        c:=coalesce(v->>k,'');
        if c<>'' and c !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Color no válido: %',k; end if;
    end loop;
    update public.perfiles_usuario set preferencias_ui=v where id=auth.uid();
    if not found then raise exception 'No se encontró el perfil del usuario.'; end if;
    return v;
end;
$$;
revoke all on function public.crm_guardar_preferencias_ui(jsonb) from public,anon;
grant execute on function public.crm_guardar_preferencias_ui(jsonb) to authenticated;

alter table public.proyectos add column if not exists es_externo boolean not null default false;
alter table public.proyectos add column if not exists viaticos_habilitados boolean not null default false;
alter table public.proyectos add column if not exists viatico_tipo text not null default 'semanal';
alter table public.proyectos add column if not exists viatico_importe numeric(14,2) not null default 0;
alter table public.proyectos drop constraint if exists proyectos_viatico_tipo_check;
alter table public.proyectos add constraint proyectos_viatico_tipo_check check(viatico_tipo in ('diario','semanal','fijo'));
alter table public.proyectos drop constraint if exists proyectos_viatico_importe_check;
alter table public.proyectos add constraint proyectos_viatico_importe_check check(viatico_importe>=0);

alter table public.rh_proyecto_asignaciones add column if not exists viatico_habilitado boolean;
alter table public.rh_proyecto_asignaciones add column if not exists viatico_tipo text;
alter table public.rh_proyecto_asignaciones add column if not exists viatico_importe numeric(14,2);
alter table public.rh_proyecto_asignaciones drop constraint if exists rh_asignaciones_viatico_tipo_check;
alter table public.rh_proyecto_asignaciones add constraint rh_asignaciones_viatico_tipo_check check(viatico_tipo is null or viatico_tipo in ('diario','semanal','fijo'));
alter table public.rh_proyecto_asignaciones drop constraint if exists rh_asignaciones_viatico_importe_check;
alter table public.rh_proyecto_asignaciones add constraint rh_asignaciones_viatico_importe_check check(viatico_importe is null or viatico_importe>=0);

alter table public.rh_nomina_periodos add column if not exists fecha_pago date;
alter table public.rh_nomina_periodos add column if not exists semana_pago integer;

alter table public.rh_nomina_detalles add column if not exists horas_trabajadas numeric(8,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists horas_extra numeric(8,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists importe_horas_extra numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists infonavit_fonacot numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists viaticos numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists viaticos_inicio date;
alter table public.rh_nomina_detalles add column if not exists viaticos_fin date;
alter table public.rh_nomina_detalles add column if not exists viaticos_proyecto text;
alter table public.rh_nomina_detalles add column if not exists dia_festivo numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists adelanto_inbursa numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists prestamo_personal numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists ajuste_viaticos numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists otros_percepcion numeric(14,2) not null default 0;
alter table public.rh_nomina_detalles add column if not exists otros_deduccion numeric(14,2) not null default 0;

create or replace function public.rh_nomina_recalcular_detalle()
returns trigger
language plpgsql
set search_path=public
as $$
declare
    v_percepciones numeric;
    v_deducciones numeric;
begin
    new.salario_base:=greatest(coalesce(new.salario_base,0),0);
    new.bonos:=greatest(coalesce(new.bonos,0),0);
    new.descuentos:=greatest(coalesce(new.descuentos,0),0);
    new.horas_trabajadas:=greatest(coalesce(new.horas_trabajadas,0),0);
    new.horas_extra:=greatest(coalesce(new.horas_extra,0),0);
    new.importe_horas_extra:=greatest(coalesce(new.importe_horas_extra,0),0);
    new.infonavit_fonacot:=greatest(coalesce(new.infonavit_fonacot,0),0);
    new.viaticos:=greatest(coalesce(new.viaticos,0),0);
    new.dia_festivo:=greatest(coalesce(new.dia_festivo,0),0);
    new.adelanto_inbursa:=greatest(coalesce(new.adelanto_inbursa,0),0);
    new.prestamo_personal:=greatest(coalesce(new.prestamo_personal,0),0);
    new.otros_percepcion:=greatest(coalesce(new.otros_percepcion,0),0);
    new.otros_deduccion:=greatest(coalesce(new.otros_deduccion,0),0);
    new.ajuste_viaticos:=coalesce(new.ajuste_viaticos,0);
    v_percepciones:=new.salario_base+new.bonos+new.importe_horas_extra+new.viaticos+new.dia_festivo+new.otros_percepcion+greatest(new.ajuste_viaticos,0);
    v_deducciones:=new.descuentos+new.infonavit_fonacot+new.adelanto_inbursa+new.prestamo_personal+new.otros_deduccion+greatest(-new.ajuste_viaticos,0);
    new.total_neto:=round(greatest(v_percepciones-v_deducciones,0),2);
    new.updated_at:=now();
    return new;
end;
$$;
drop trigger if exists trg_rh_nomina_recalcular_detalle on public.rh_nomina_detalles;
create trigger trg_rh_nomina_recalcular_detalle before insert or update on public.rh_nomina_detalles for each row execute function public.rh_nomina_recalcular_detalle();

create table if not exists public.rh_nomina_configuracion(
    id smallint primary key default 1 check(id=1),
    dia_inicio_semana smallint not null default 2 check(dia_inicio_semana between 1 and 7),
    dia_fin_semana smallint not null default 1 check(dia_fin_semana between 1 and 7),
    dia_envio smallint not null default 4 check(dia_envio between 1 and 7),
    hora_envio time not null default '09:00',
    zona_horaria text not null default 'America/Mexico_City',
    envio_automatico boolean not null default true,
    generar_automatico boolean not null default true,
    solo_revisada boolean not null default false,
    template_name text not null default 'nomina_informativa_pago',
    template_language text not null default 'es_MX',
    ultimo_envio_local date,
    ultimo_intento_at timestamptz,
    ultimo_resultado jsonb not null default '{}'::jsonb,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);
insert into public.rh_nomina_configuracion(id) values(1) on conflict(id) do nothing;
alter table public.rh_nomina_configuracion enable row level security;
drop policy if exists rh_nomina_config_select on public.rh_nomina_configuracion;
create policy rh_nomina_config_select on public.rh_nomina_configuracion for select to authenticated using(public.crm_usuario_tiene_rol(array['administrador','rh']));
drop policy if exists rh_nomina_config_write on public.rh_nomina_configuracion;
create policy rh_nomina_config_write on public.rh_nomina_configuracion for all to authenticated using(public.crm_usuario_tiene_rol(array['administrador','rh'])) with check(public.crm_usuario_tiene_rol(array['administrador','rh']));
grant select,insert,update on public.rh_nomina_configuracion to authenticated;

create or replace function public.crm_generar_nomina(p_inicio date,p_fin date,p_nombre text default null)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
    v_periodo bigint;
    v_semanas numeric;
    v_pago date;
    v_semana integer;
    v_viatico_inicio date;
    v_viatico_fin date;
begin
    if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and not public.crm_usuario_tiene_rol(array['administrador','rh']) then raise exception 'Tu perfil no puede generar nómina.'; end if;
    if p_inicio is null or p_fin is null or p_fin<p_inicio then raise exception 'El periodo de nómina no es válido.'; end if;
    select id into v_periodo from public.rh_nomina_periodos where fecha_inicio=p_inicio and fecha_fin=p_fin and estado<>'cancelada' order by id desc limit 1;
    if v_periodo is not null then return v_periodo; end if;
    v_semanas:=greatest((p_fin-p_inicio+1)::numeric/7.0,1.0/7.0);
    v_pago:=p_fin+(((4-extract(isodow from p_fin)::int)+7)%7);
    if v_pago=p_fin then v_pago:=v_pago+7; end if;
    v_semana:=extract(week from p_inicio)::int;
    v_viatico_inicio:=v_pago+1;
    v_viatico_fin:=v_pago+7;
    insert into public.rh_nomina_periodos(nombre,fecha_inicio,fecha_fin,fecha_pago,semana_pago)
    values(coalesce(nullif(btrim(p_nombre),''),'Nómina Sem '||v_semana||' · '||to_char(p_inicio,'DD/MM/YYYY')||' - '||to_char(p_fin,'DD/MM/YYYY')),p_inicio,p_fin,v_pago,v_semana)
    returning id into v_periodo;

    insert into public.rh_nomina_detalles(periodo_id,personal_id,salario_base,horas_trabajadas,viaticos,viaticos_inicio,viaticos_fin,viaticos_proyecto,total_neto)
    select v_periodo,rp.id,
           round(greatest(0,case when rp.esquema_pago='hora' then coalesce(rp.tarifa_pago,0)*greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0)*greatest(coalesce(rp.dias_laborales_semana,6),1)*v_semanas else coalesce(nullif(rp.salario_semanal_calculado,0),nullif(rp.tarifa_pago,0),rp.salario,0)*v_semanas end),2),
           round(case when rp.esquema_pago='hora' then greatest(coalesce(rp.horas_jornada_diaria,8)-coalesce(rp.horas_comida_diaria,1),0)*greatest(coalesce(rp.dias_laborales_semana,6),1)*v_semanas else 0 end,2),
           coalesce(vt.importe,0),
           case when coalesce(vt.importe,0)>0 then v_viatico_inicio else null end,
           case when coalesce(vt.importe,0)>0 then v_viatico_fin else null end,
           vt.proyectos,
           0
    from public.rh_personal rp
    left join lateral(
        select round(coalesce(sum(
            case coalesce(a.viatico_tipo,pr.viatico_tipo)
                when 'diario' then coalesce(a.viatico_importe,pr.viatico_importe,0)*greatest(0,(least(coalesce(a.fecha_fin,v_viatico_fin),v_viatico_fin)-greatest(a.fecha_inicio,v_viatico_inicio)+1))
                when 'fijo' then coalesce(a.viatico_importe,pr.viatico_importe,0)
                else coalesce(a.viatico_importe,pr.viatico_importe,0)*greatest(1,ceil(greatest(0,(least(coalesce(a.fecha_fin,v_viatico_fin),v_viatico_fin)-greatest(a.fecha_inicio,v_viatico_inicio)+1))::numeric/7.0))
            end
        ),0),2) importe,
        string_agg(distinct pr.numero_proyecto,', ' order by pr.numero_proyecto) proyectos
        from public.rh_proyecto_asignaciones a
        join public.proyectos pr on pr.numero_proyecto=a.proyecto_numero
        where a.personal_id=rp.id
          and a.estado='activo'
          and a.fecha_inicio<=v_viatico_fin
          and coalesce(a.fecha_fin,v_viatico_fin)>=v_viatico_inicio
          and pr.es_externo=true
          and coalesce(a.viatico_habilitado,pr.viaticos_habilitados)=true
          and coalesce(a.viatico_importe,pr.viatico_importe,0)>0
    ) vt on true
    where rp.estado='activo';
    return v_periodo;
end;
$$;
revoke all on function public.crm_generar_nomina(date,date,text) from public,anon;
grant execute on function public.crm_generar_nomina(date,date,text) to authenticated,service_role;

create or replace function public.crm_generar_nomina_semana_caida(p_fecha_referencia date default current_date)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
    v_fin date;
    v_inicio date;
begin
    if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and not public.crm_usuario_tiene_rol(array['administrador','rh']) then raise exception 'Tu perfil no puede generar nómina.'; end if;
    v_fin:=p_fecha_referencia-((extract(isodow from p_fecha_referencia)::int-1+7)%7);
    v_inicio:=v_fin-6;
    return public.crm_generar_nomina(v_inicio,v_fin,'Nómina Sem '||extract(week from v_inicio)::int||' · '||to_char(v_inicio,'DD/MM/YYYY')||' - '||to_char(v_fin,'DD/MM/YYYY'));
end;
$$;
revoke all on function public.crm_generar_nomina_semana_caida(date) from public,anon;
grant execute on function public.crm_generar_nomina_semana_caida(date) to authenticated,service_role;

update public.rh_nomina_periodos
set semana_pago=coalesce(semana_pago,extract(week from fecha_inicio)::int),
    fecha_pago=coalesce(fecha_pago,case when fecha_fin+(((4-extract(isodow from fecha_fin)::int)+7)%7)=fecha_fin then fecha_fin+7 else fecha_fin+(((4-extract(isodow from fecha_fin)::int)+7)%7) end)
where semana_pago is null or fecha_pago is null;

update public.rh_nomina_detalles set salario_base=salario_base;

commit;

select 'OK' estado,
       (select count(*) from public.rh_nomina_configuracion) configuracion_nomina,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='perfiles_usuario' and column_name='preferencias_ui') preferencias_ui,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='rh_nomina_detalles' and column_name='viaticos') viaticos,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='rh_proyecto_asignaciones' and column_name='viatico_habilitado') viaticos_personalizados;
