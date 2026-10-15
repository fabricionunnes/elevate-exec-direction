-- Criativos dos clientes UNV Ads: monta no projeto, envia pro grupo do cliente do número de
-- quem enviou, o cliente aprova respondendo/reagindo no grupo, quem enviou é avisado (sistema
-- + WhatsApp), o consultor marca que subiu e vincula os anúncios do Meta pra ver as métricas.

-- id do WhatsApp da mensagem respondida/reagida (o mesmo pra todos os membros do grupo)
alter table public.crm_whatsapp_messages add column if not exists quoted_remote_id text;

create table if not exists public.ads_criativos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  company_id uuid references public.onboarding_companies(id) on delete set null,
  titulo text not null,
  legenda text,                         -- copy do anúncio
  mensagem text,                        -- recado que vai junto pro cliente no grupo
  formato text not null default 'imagem' check (formato in ('imagem','video','carrossel')),
  midias jsonb not null default '[]',   -- [{url, path, tipo: image|video, mime, nome}]
  status text not null default 'rascunho' check (status in ('rascunho','enviado','ajuste','aprovado','reprovado')),
  grupo_jid text,                       -- só dígitos, sem @g.us (igual crm_whatsapp_contacts.phone)
  grupo_nome text,
  enviado_por uuid references public.onboarding_staff(id) on delete set null,
  enviado_em timestamptz,
  instancia_id uuid references public.whatsapp_instances(id) on delete set null,
  wa_ids text[] not null default '{}',  -- ids do WhatsApp das mensagens enviadas
  envios int not null default 0,
  aprovado_em timestamptz,
  aprovado_por_nome text,
  aprovado_por_telefone text,
  resposta_cliente text,
  aprovacao_origem text,                -- resposta | reacao | texto | manual
  ajuste_texto text,
  ajuste_em timestamptz,
  ultimo_remote_id text,                -- dedup: a mesma msg do grupo chega por vários números
  aviso_status text,                    -- último status já avisado por WhatsApp
  no_ar boolean not null default false,
  no_ar_em timestamptz,
  no_ar_por uuid references public.onboarding_staff(id) on delete set null,
  meta_ad_ids text[] not null default '{}',
  metricas jsonb,
  metricas_em timestamptz,
  criado_por uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ads_criativos_projeto_idx on public.ads_criativos (project_id, created_at desc);
create index if not exists ads_criativos_grupo_pendente_idx on public.ads_criativos (grupo_jid) where status in ('enviado','ajuste');

create table if not exists public.ads_criativos_eventos (
  id uuid primary key default gen_random_uuid(),
  criativo_id uuid not null references public.ads_criativos(id) on delete cascade,
  tipo text not null,                   -- criado | enviado | aprovado | ajuste | comentario | no_ar | metricas | desfeito
  texto text,
  autor_nome text,
  staff_id uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ads_criativos_eventos_idx on public.ads_criativos_eventos (criativo_id, created_at);

-- grupo padrão do cliente por projeto (lembrado depois do primeiro envio)
create table if not exists public.ads_criativos_config (
  project_id uuid primary key references public.onboarding_projects(id) on delete cascade,
  grupo_jid text,
  grupo_nome text,
  updated_at timestamptz not null default now()
);

alter table public.ads_criativos enable row level security;
alter table public.ads_criativos_eventos enable row level security;
alter table public.ads_criativos_config enable row level security;
do $$ declare t text; begin
  foreach t in array array['ads_criativos','ads_criativos_eventos','ads_criativos_config'] loop
    execute format('drop policy if exists "staff gerencia" on public.%I', t);
    execute format($p$create policy "staff gerencia" on public.%I for all to authenticated
      using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active))
      with check (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active))$p$, t);
  end loop;
end $$;

create or replace function public.ads_criativos_touch() returns trigger language plpgsql as $$
begin NEW.updated_at := now(); return NEW; end $$;
drop trigger if exists ads_criativos_touch on public.ads_criativos;
create trigger ads_criativos_touch before update on public.ads_criativos for each row execute function public.ads_criativos_touch();

-- arquivos dos criativos: público pra o WhatsApp conseguir buscar a mídia
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads-criativos', 'ads-criativos', true, 104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "ads-criativos leitura" on storage.objects;
create policy "ads-criativos leitura" on storage.objects for select using (bucket_id = 'ads-criativos');
drop policy if exists "ads-criativos staff escreve" on storage.objects;
create policy "ads-criativos staff escreve" on storage.objects for insert to authenticated
  with check (bucket_id = 'ads-criativos' and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));
drop policy if exists "ads-criativos staff apaga" on storage.objects;
create policy "ads-criativos staff apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'ads-criativos' and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));

insert into notification_types (key, audience, category, label, description, default_inapp, default_push, mandatory, sort)
values
  ('ads_criativo_aprovado', 'staff', 'UNV Ads', 'Criativo aprovado pelo cliente', 'O cliente aprovou no grupo um criativo que você enviou.', true, true, false, 300),
  ('ads_criativo_ajuste', 'staff', 'UNV Ads', 'Cliente pediu ajuste no criativo', 'O cliente respondeu no grupo pedindo alteração.', true, true, false, 301)
on conflict (key) do nothing;

-- Lê cada mensagem que chega num grupo com criativo esperando resposta.
-- Reação/resposta em cima do criativo vale sempre; texto solto só com palavra forte e quando
-- há um único criativo pendente no grupo (ou "aprovo todos"). Nunca derruba o webhook.
create or replace function public.ads_criativo_avaliar_msg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text; v_txt text; v_alvos uuid[]; v_cri record; v_n int;
  v_aprova boolean := false; v_ajuste boolean := false; v_origem text; v_sender8 text;
  v_staff_dono uuid; v_titulo text; v_url text;
begin
  begin
    select ct.phone into v_phone
      from crm_whatsapp_conversations cv join crm_whatsapp_contacts ct on ct.id = cv.contact_id
     where cv.id = NEW.conversation_id;
    if v_phone is null or length(v_phone) < 18 then return NEW; end if;
    if not exists (select 1 from ads_criativos where grupo_jid = v_phone and status in ('enviado','ajuste')) then return NEW; end if;

    -- mensagem de alguém do time (outro número nosso no grupo) não é o cliente
    v_sender8 := right(regexp_replace(coalesce(NEW.sender_phone,''), '\D', '', 'g'), 8);
    if length(v_sender8) = 8 and (
         exists (select 1 from whatsapp_instances w where right(regexp_replace(coalesce(w.phone_number,''), '\D', '', 'g'), 8) = v_sender8)
      or exists (select 1 from onboarding_staff s where s.is_active and right(regexp_replace(coalesce(s.phone,''), '\D', '', 'g'), 8) = v_sender8)
    ) then return NEW; end if;

    v_txt := lower(translate(coalesce(NEW.content,''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'));

    if NEW.quoted_remote_id is not null then
      select array_agg(id) into v_alvos from ads_criativos
       where grupo_jid = v_phone and status in ('enviado','ajuste') and NEW.quoted_remote_id = any(wa_ids);
      if v_alvos is null then return NEW; end if;  -- respondeu outra coisa
      if NEW.type = 'reaction' then
        v_origem := 'reacao';
        v_aprova := NEW.content in ('👍','👍🏻','👍🏼','👍🏽','👍🏾','👍🏿','👌','👌🏻','👌🏼','👌🏽','✅','✔️','✔','☑️','🤝','🙌','👏','💯','❤️','❤','😍','🥰','🔥','🤩','💙','💚','🖤');
      else
        v_origem := 'resposta';
        -- pedido de mudança vence ("aprovado, só troca a cor" = ajuste); "não" só pesa sem aprovação clara
        v_ajuste := v_txt ~ '(ajust|alter|\mmud|\mtroc|corrig|\mtira|\mcoloc|refaz|prefiro|errad|faltou|diminu|aument|reprov|nao gostei)'
          or (v_txt ~ '(\mnao\M|\mn\M)' and v_txt !~ '(aprov|pode subir|pode rodar|pode publicar|liberad)');
        v_aprova := not v_ajuste and v_txt ~ '(aprov|pode subir|pode rodar|pode soltar|pode publicar|pode postar|pode ir|manda ver|\mok\M|\mokay\M|perfeit|\mshow\M|\mtop\M|gostei|amei|ficou (otimo|bom|boa|lindo|linda|perfeito|show|top|massa|demais)|\msim\M|fechado|\mbora\M|liberad|\mbeleza\M|\mmassa\M|excelente|maravilh)';
      end if;
    else
      if NEW.type = 'reaction' then return NEW; end if;
      select count(*) into v_n from ads_criativos where grupo_jid = v_phone and status in ('enviado','ajuste') and enviado_em > now() - interval '7 days';
      v_aprova := v_txt ~ '(aprovad|aprovo|aprova |pode subir|pode rodar|pode publicar|pode soltar|liberad)';
      if not v_aprova then return NEW; end if;
      if v_n = 1 or v_txt ~ '(todos|todas|ambos|ambas|os dois|as duas|os tres|tudo)' then
        select array_agg(id) into v_alvos from ads_criativos
         where grupo_jid = v_phone and status in ('enviado','ajuste') and enviado_em > now() - interval '7 days';
        v_origem := 'texto';
      else
        return NEW;  -- vários pendentes e não disse qual: não chuta
      end if;
    end if;

    for v_cri in select * from ads_criativos where id = any(v_alvos) loop
      if v_cri.ultimo_remote_id is not distinct from NEW.remote_id then continue; end if;  -- já lida por outro número
      if v_aprova then
        update ads_criativos set status = 'aprovado', aprovado_em = now(), aprovado_por_nome = NEW.sender_name,
          aprovado_por_telefone = NEW.sender_phone, resposta_cliente = NEW.content, aprovacao_origem = v_origem,
          ultimo_remote_id = NEW.remote_id
         where id = v_cri.id and status in ('enviado','ajuste');
        if not found then continue; end if;
        insert into ads_criativos_eventos (criativo_id, tipo, texto, autor_nome)
        values (v_cri.id, 'aprovado', NEW.content, NEW.sender_name);
        perform app_notify(v_cri.enviado_por, null, 'ads_criativo_aprovado',
          'Criativo aprovado: ' || v_cri.titulo,
          coalesce(NEW.sender_name, 'O cliente') || ' aprovou no grupo' || case when NEW.type = 'reaction' then ' (' || NEW.content || ')' else ': "' || left(NEW.content, 200) || '"' end,
          v_cri.project_id, v_cri.id, 'ads_criativo', '/onboarding-tasks/' || v_cri.project_id || '?tab=criativos', 'high');
      elsif v_ajuste or NEW.type <> 'reaction' then
        update ads_criativos set
          status = case when v_ajuste then 'ajuste' else status end,
          ajuste_texto = case when v_ajuste then NEW.content else ajuste_texto end,
          ajuste_em = case when v_ajuste then now() else ajuste_em end,
          ultimo_remote_id = NEW.remote_id
         where id = v_cri.id and status in ('enviado','ajuste');
        if not found then continue; end if;
        insert into ads_criativos_eventos (criativo_id, tipo, texto, autor_nome)
        values (v_cri.id, case when v_ajuste then 'ajuste' else 'comentario' end, NEW.content, NEW.sender_name);
        if v_ajuste then
          perform app_notify(v_cri.enviado_por, null, 'ads_criativo_ajuste',
            'Ajuste pedido: ' || v_cri.titulo,
            coalesce(NEW.sender_name, 'O cliente') || ': "' || left(NEW.content, 200) || '"',
            v_cri.project_id, v_cri.id, 'ads_criativo', '/onboarding-tasks/' || v_cri.project_id || '?tab=criativos', 'high');
        end if;
      else
        continue;
      end if;
      -- WhatsApp pro número pessoal de quem enviou (a função confere e não repete)
      perform net.http_post(url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/ads-criativos',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('action','avisar','criativo_id', v_cri.id), timeout_milliseconds := 30000);
    end loop;
  exception when others then raise warning 'ads_criativo_avaliar_msg falhou: %', sqlerrm;
  end;
  return NEW;
end $$;

drop trigger if exists zz_ads_criativo_aprovacao on public.crm_whatsapp_messages;
create trigger zz_ads_criativo_aprovacao after insert on public.crm_whatsapp_messages
  for each row when (NEW.direction = 'inbound') execute function public.ads_criativo_avaliar_msg();

-- métricas dos criativos no ar: atualiza todo dia 09:10 BRT
select cron.unschedule('ads-criativos-metricas') where exists (select 1 from cron.job where jobname = 'ads-criativos-metricas');
select cron.schedule('ads-criativos-metricas', '10 12 * * *', $$
  select net.http_post(url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/ads-criativos',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('action','metricas_cron'), timeout_milliseconds := 300000);
$$);

-- tela atualiza sozinha quando a aprovação chega pelo grupo
do $$ begin
  alter publication supabase_realtime add table public.ads_criativos;
exception when duplicate_object then null; end $$;
