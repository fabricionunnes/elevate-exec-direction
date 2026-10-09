-- Enquetes no site: pergunta com opções, 1 voto por aparelho, resultado público.
create table if not exists yasfood.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text not null default '',
  active boolean not null default true,
  show_results boolean not null default true,   -- mostrar resultado pro cliente após votar
  closes_at date,
  created_at timestamptz not null default now()
);
create table if not exists yasfood.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references yasfood.polls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);
create table if not exists yasfood.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references yasfood.polls(id) on delete cascade,
  option_id uuid not null references yasfood.poll_options(id) on delete cascade,
  voter_key text not null,          -- id anônimo do aparelho (localStorage)
  created_at timestamptz not null default now(),
  unique (poll_id, voter_key)
);
create index if not exists poll_votes_poll_idx on yasfood.poll_votes (poll_id, option_id);

create or replace view yasfood.poll_results as
select o.poll_id, o.id as option_id, o.label, o.sort_order, count(v.id)::int as votes
from yasfood.poll_options o
left join yasfood.poll_votes v on v.option_id = o.id
group by o.poll_id, o.id, o.label, o.sort_order;

-- votar (público): troca o voto se votar de novo no mesmo aparelho
create or replace function yasfood.vote_poll(p_poll_id uuid, p_option_id uuid, p_voter_key text)
returns void
language plpgsql security definer set search_path = yasfood, public as $$
declare v_poll yasfood.polls%rowtype;
begin
  if length(coalesce(p_voter_key,'')) < 8 then raise exception 'ENQUETE: identificação inválida'; end if;
  select * into v_poll from yasfood.polls where id = p_poll_id;
  if not found or not v_poll.active or (v_poll.closes_at is not null and v_poll.closes_at < yasfood.today_br()) then
    raise exception 'ENQUETE: enquete encerrada';
  end if;
  if not exists (select 1 from yasfood.poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'ENQUETE: opção inválida';
  end if;
  insert into yasfood.poll_votes (poll_id, option_id, voter_key) values (p_poll_id, p_option_id, left(p_voter_key, 80))
  on conflict (poll_id, voter_key) do update set option_id = excluded.option_id, created_at = now();
end $$;

alter table yasfood.polls enable row level security;
alter table yasfood.poll_options enable row level security;
alter table yasfood.poll_votes enable row level security;

drop policy if exists polls_public_read on yasfood.polls;
create policy polls_public_read on yasfood.polls for select using (yasfood.is_admin() or (active and (closes_at is null or closes_at >= yasfood.today_br())));
drop policy if exists polls_admin_all on yasfood.polls;
create policy polls_admin_all on yasfood.polls for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists poll_options_public_read on yasfood.poll_options;
create policy poll_options_public_read on yasfood.poll_options for select using (true);
drop policy if exists poll_options_admin_all on yasfood.poll_options;
create policy poll_options_admin_all on yasfood.poll_options for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists poll_votes_admin_all on yasfood.poll_votes;
create policy poll_votes_admin_all on yasfood.poll_votes for all using (yasfood.is_admin()) with check (yasfood.is_admin());

grant select on yasfood.polls, yasfood.poll_options, yasfood.poll_results to anon;
grant select, insert, update, delete on yasfood.polls, yasfood.poll_options, yasfood.poll_votes to authenticated;
grant select on yasfood.poll_results to authenticated;
grant execute on function yasfood.vote_poll(uuid, uuid, text) to anon, authenticated;
