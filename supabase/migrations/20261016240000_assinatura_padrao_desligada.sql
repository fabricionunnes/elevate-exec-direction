-- Assinatura nas conversas DESLIGADA por padrão (Fabrício, 16/10/2026):
-- "se eu quiser enviar assinatura aí eu marco o botão". Antes nascia ligada pra todo
-- mundo e a assinatura do perfil ia na frente de toda mensagem sem ninguém pedir.
alter table public.onboarding_staff alter column wa_signature_default set default false;
update public.onboarding_staff set wa_signature_default = false where wa_signature_default is distinct from false;
-- zera as escolhas por conversa: tudo começa desligado, e quem quiser liga na caneta
update public.crm_whatsapp_conversations set signature_enabled = null where signature_enabled is not null;

-- Vigia da IA: separa o check da Anthropic do check de transcrição de áudio no mesmo log
alter table public.ai_health_log add column if not exists tipo text not null default 'anthropic';
create index if not exists ai_health_log_tipo_idx on public.ai_health_log (tipo, checked_at desc);
