alter table public.whatsapp_official_instances add column if not exists business_id text;
update public.whatsapp_official_instances set business_id='2259975504183394' where waba_id='1821212722562228' and business_id is null;
notify pgrst, 'reload schema';
select display_name, waba_id, business_id from whatsapp_official_instances;
