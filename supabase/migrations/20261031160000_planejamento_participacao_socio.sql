-- Participação nos lucros do sócio: apuração trimestral, liberada por gatilho.
-- Não é despesa, é destinação do resultado: fica fora do cálculo do lucro.

alter table planejamento_linhas drop constraint if exists planejamento_linhas_grupo_check;
alter table planejamento_linhas add constraint planejamento_linhas_grupo_check
  check (grupo in ('receita', 'custo', 'reserva', 'indicador', 'distribuicao'));

create table if not exists planejamento_socio (
  ano                integer primary key references planejamento_anos(ano) on delete cascade,
  -- quanto do lucro do trimestre vai para o sócio quando tudo libera
  percentual         numeric not null default 50,
  -- piso de entrega do lucro planejado para liberar a distribuição cheia
  piso_cheio_pct     numeric not null default 90,
  -- entre o piso parcial e o cheio, distribui metade do percentual
  piso_parcial_pct   numeric not null default 70,
  -- meses de custo fixo que precisam sobrar em caixa depois da retirada
  caixa_minimo_meses numeric not null default 1,
  custo_fixo_mes     numeric not null default 0,
  observacao         text,
  atualizado_em      timestamptz not null default now()
);

alter table planejamento_socio enable row level security;
drop policy if exists planejamento_socio_master on planejamento_socio;
create policy planejamento_socio_master on planejamento_socio
  for all to authenticated using (is_master()) with check (is_master());
grant select, insert, update, delete on planejamento_socio to authenticated;

insert into planejamento_socio (ano, percentual, piso_cheio_pct, piso_parcial_pct, caixa_minimo_meses, custo_fixo_mes, observacao)
values (2027, 50, 90, 70, 1, 44180,
  'Apuração trimestral, pagamento no mês seguinte ao fechamento. Custo fixo de R$ 44.180 = time fixo R$ 27.680 + administrativas R$ 16.500.')
on conflict (ano) do update set percentual = excluded.percentual, custo_fixo_mes = excluded.custo_fixo_mes,
  observacao = excluded.observacao, atualizado_em = now();

-- Por trimestre: o que o plano previa, o que o sistema realizou, e se libera.
create or replace function planejamento_participacao_interno(p_ano integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  cfg planejamento_socio%rowtype;
  rz jsonb;
  out jsonb := '[]'::jsonb;
  tri integer;
  m1 integer; m2 integer;
  plan_rec numeric; plan_cus numeric; plan_res numeric;
  real_rec numeric; real_cus numeric;
  lucro_p numeric; lucro_r numeric; atingido numeric; pct numeric; valor numeric;
  situacao text;
  -- receita planejada do mês, para resolver as linhas que são percentual dela
  v_rec_mes numeric[];
begin
  select * into cfg from planejamento_socio where ano = p_ano;
  if not found then return '[]'::jsonb; end if;
  rz := planejamento_realizado_interno(p_ano);

  select array_agg(x order by i) into v_rec_mes
    from generate_series(1, 12) i,
    lateral (select coalesce(sum(l.valores[i]), 0) x from planejamento_linhas l
              where l.ano = p_ano and l.grupo = 'receita') z(x);

  for tri in 1..4 loop
    m1 := (tri - 1) * 3 + 1; m2 := tri * 3;

    select coalesce(sum(case when l.formula = 'pct_receita'
                             then v_rec_mes[i] * l.formula_pct / 100
                             else l.valores[i] end), 0)
      into plan_rec
      from planejamento_linhas l, generate_series(m1, m2) i
     where l.ano = p_ano and l.grupo = 'receita';

    select coalesce(sum(case when l.formula = 'pct_receita'
                             then v_rec_mes[i] * l.formula_pct / 100
                             else l.valores[i] end), 0)
      into plan_cus
      from planejamento_linhas l, generate_series(m1, m2) i
     where l.ano = p_ano and l.grupo = 'custo';

    select coalesce(sum(l.valores[i]), 0) into plan_res
      from planejamento_linhas l, generate_series(m1, m2) i
     where l.ano = p_ano and l.grupo = 'reserva';

    select coalesce(sum((rz #>> array[f.fonte, i::text])::numeric), 0) into real_rec
      from planejamento_linhas f, generate_series(m1, m2) i
     where f.ano = p_ano and f.grupo = 'receita' and f.fonte is not null
       and rz #>> array[f.fonte, i::text] is not null;

    select coalesce(sum((rz #>> array[f.fonte, i::text])::numeric), 0) into real_cus
      from planejamento_linhas f, generate_series(m1, m2) i
     where f.ano = p_ano and f.grupo = 'custo' and f.fonte is not null
       and rz #>> array[f.fonte, i::text] is not null;

    lucro_p := plan_rec - plan_cus - plan_res;
    lucro_r := real_rec - real_cus;
    atingido := case when lucro_p > 0 then lucro_r / lucro_p else null end;

    -- a escada: cheio acima do piso, metade na faixa, nada abaixo
    if atingido is null then
      pct := null; situacao := 'sem_plano';
    elsif atingido >= cfg.piso_cheio_pct / 100 then
      pct := cfg.percentual; situacao := 'liberado';
    elsif atingido >= cfg.piso_parcial_pct / 100 then
      pct := cfg.percentual / 2; situacao := 'parcial';
    else
      pct := 0; situacao := 'bloqueado';
    end if;

    valor := case when pct is null then null
                  else greatest(lucro_r - plan_res, 0) * pct / 100 end;

    out := out || jsonb_build_object(
      'trimestre', tri,
      'rotulo', (array['1º tri (jan-mar)', '2º tri (abr-jun)', '3º tri (jul-set)', '4º tri (out-dez)'])[tri],
      'paga_em', (array['abril', 'julho', 'outubro', 'janeiro de ' || (p_ano + 1)])[tri],
      'lucro_planejado', round(lucro_p, 2),
      'lucro_realizado', round(lucro_r, 2),
      'reserva', round(plan_res, 2),
      'atingido', round(atingido, 4),
      'percentual', pct,
      'situacao', situacao,
      'valor_planejado', round(greatest(lucro_p - 0, 0) * cfg.percentual / 100, 2),
      'valor_realizado', round(valor, 2)
    );
  end loop;

  return jsonb_build_object(
    'config', to_jsonb(cfg),
    'trimestres', out
  );
end $$;

create or replace function planejamento_participacao(p_ano integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_master() then raise exception 'sem permissão'; end if;
  return planejamento_participacao_interno(p_ano);
end $$;

revoke all on function planejamento_participacao_interno(integer) from public, authenticated, anon;
grant execute on function planejamento_participacao(integer) to authenticated;
insert into planejamento_linhas (ano, grupo, linha, fonte, unidade, ordem, acumulacao, valores, observacao) values
 (2027, 'distribuicao', 'Participação nos lucros do sócio', null, 'brl', 10, 'soma',
  array[0,0,0, 28319.00,0,0, 57696.00,0,0, 89425.00,0,0]::numeric[],
  'Apurada por trimestre e paga no mês seguinte: abril, julho e outubro. O 4º trimestre (R$ 120.843) só sai em janeiro de 2028, por isso o ano fecha com R$ 175.439 de desembolso. Não é despesa: é destinação do lucro, fica fora do resultado.');
