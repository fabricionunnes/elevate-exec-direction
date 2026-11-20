-- Assinatura de e-mail com logomarca (Fabrício, 20/11/2026). Uma por caixa: os campos ficam em
-- mail_accounts.signature e o HTML pronto em signature_html (coluna que já existia, sem uso).
-- A tela não tem permissão de escrita em mail_accounts: grava por esta função, só na própria caixa.
alter table public.mail_accounts add column if not exists signature jsonb;

create or replace function public.mail_assinatura_salvar(p_config jsonb, p_html text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if length(coalesce(p_html, '')) > 20000 then raise exception 'assinatura grande demais'; end if;
  update mail_accounts
     set signature = p_config, signature_html = nullif(p_html, ''), updated_at = now()
   where user_id = auth.uid()
  returning id into v_id;
  if v_id is null then raise exception 'caixa de e-mail não conectada'; end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function public.mail_assinatura_salvar(jsonb, text) from public, anon;
grant execute on function public.mail_assinatura_salvar(jsonb, text) to authenticated;
