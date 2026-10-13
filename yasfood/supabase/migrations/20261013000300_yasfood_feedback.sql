-- Sugestões, reclamações e elogios enviados pelo site. Pode ser com nome e WhatsApp ou anônimo.
create table if not exists yasfood.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'sugestao' check (kind in ('sugestao','reclamacao','elogio')),
  message text not null,
  name text not null default '',
  phone text not null default '',
  anonymous boolean not null default false,
  status text not null default 'novo' check (status in ('novo','lido','resolvido')),
  notes text not null default '',          -- anotação interna da Yasmim
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index if not exists feedback_status_idx on yasfood.feedback (status, created_at desc);

alter table yasfood.feedback enable row level security;
drop policy if exists feedback_admin_all on yasfood.feedback;
create policy feedback_admin_all on yasfood.feedback for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, update, delete on yasfood.feedback to authenticated;

-- Envio público: só pela função (valida tamanho e normaliza telefone). Sem select pra anon.
create or replace function yasfood.send_feedback(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_kind text := coalesce(p->>'kind', 'sugestao');
  v_msg text := trim(coalesce(p->>'message', ''));
  v_anon boolean := coalesce((p->>'anonymous')::boolean, false);
  v_name text := case when v_anon then '' else left(trim(coalesce(p->>'name', '')), 80) end;
  v_phone text := case when v_anon then '' else yasfood.normalize_phone(p->>'phone') end;
  v_id uuid;
begin
  if v_kind not in ('sugestao','reclamacao','elogio') then v_kind := 'sugestao'; end if;
  if length(v_msg) < 5 then raise exception 'DADOS: escreva a mensagem'; end if;
  if length(v_msg) > 2000 then v_msg := left(v_msg, 2000); end if;
  if v_phone <> '' and length(v_phone) < 10 then raise exception 'DADOS: telefone incompleto (DDD + número) ou deixe em branco'; end if;
  -- freio simples contra flood: no máximo 20 mensagens por hora no total
  if (select count(*) from yasfood.feedback where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Muitas mensagens agora. Tente de novo daqui a pouco.';
  end if;
  insert into yasfood.feedback (kind, message, name, phone, anonymous)
  values (v_kind, v_msg, v_name, v_phone, v_anon or (v_name = '' and v_phone = ''))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function yasfood.send_feedback(jsonb) to anon, authenticated;
