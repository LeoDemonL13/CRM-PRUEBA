create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name='rh_nomina_function_url' limit 1;
  if v_id is null then
    perform vault.create_secret('https://cuxnzqbszzrfnrinxbdp.supabase.co/functions/v1/rh-enviar-nomina-whatsapp','rh_nomina_function_url','URL Edge Function nómina RH');
  else
    perform vault.update_secret(v_id,'https://cuxnzqbszzrfnrinxbdp.supabase.co/functions/v1/rh-enviar-nomina-whatsapp','rh_nomina_function_url','URL Edge Function nómina RH');
  end if;
end $$;

do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name='rh_nomina_cron_secret' limit 1;
  if v_id is null then
    perform vault.create_secret('REEMPLAZAR_POR_EL_MISMO_CRON_SHARED_SECRET_DE_EDGE_FUNCTIONS','rh_nomina_cron_secret','Secreto compartido para nómina automática');
  else
    perform vault.update_secret(v_id,'REEMPLAZAR_POR_EL_MISMO_CRON_SHARED_SECRET_DE_EDGE_FUNCTIONS','rh_nomina_cron_secret','Secreto compartido para nómina automática');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname='rh-nomina-informativas-v75';

select cron.schedule(
  'rh-nomina-informativas-v75',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='rh_nomina_function_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='rh_nomina_cron_secret' limit 1)
    ),
    body := '{"mode":"auto"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

select jobid,jobname,schedule,active from cron.job where jobname='rh-nomina-informativas-v75';
