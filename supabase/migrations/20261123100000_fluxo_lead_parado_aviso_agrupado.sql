-- Aviso agrupado no gatilho "lead parado" dos fluxos do CRM (Fabrício, 23/11/2026: "pode mudar").
-- Em 20/11 os leads levados em lote pro funil Resgate completaram 3 dias parados juntos e o fluxo
-- "Lead parado 3 dias" mandou 136 avisos (sino e WhatsApp) e criou 134 tarefas, que ainda puxaram
-- "Ligação pendente" e "Tarefa atrasada". Agora, quando mais de 10 leads da mesma varredura chegariam
-- no bloco "Avisar pessoas", sai UM aviso com a lista e esses leads não ganham aviso nem tarefa individual.
-- Até 10 por varredura, tudo como antes.

-- Bloco "Avisar pessoas" que o lead alcançaria andando só por gatilho, nota e condições. Devolve o id
-- do bloco, ou null quando o caminho passa por qualquer outra ação antes (aí o fluxo roda normal).
create or replace function public.crm_flow_aviso_previsto(_flow public.crm_flows, _lead uuid, _ctx jsonb)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _nid text; _n jsonb; _t text; _passos int := 0;
begin
  select n->>'id' into _nid from jsonb_array_elements(_flow.nodes) n where n->>'type' = 'trigger' limit 1;
  while _nid is not null and _passos < 25 loop
    _passos := _passos + 1;
    _n := crm_flow_node(_flow, _nid);
    _t := _n->>'type';
    if _t = 'notify' then return _nid; end if;
    if _t in ('trigger', 'note') then
      _nid := crm_flow_next(_flow, _nid, 'default');
    elsif _t = 'condition' then
      _nid := crm_flow_next(_flow, _nid, case when crm_flow_condition_ok(_lead, coalesce(_n->'data', '{}'::jsonb), _ctx) then 'yes' else 'no' end);
    else
      return null;
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.crm_flow_aviso_previsto(public.crm_flows, uuid, jsonb) from public, anon, authenticated;

-- Um aviso por pessoa e por bloco, com a lista dos leads (sino e/ou WhatsApp, como o bloco manda).
create or replace function public.crm_flow_aviso_agrupado(_flow public.crm_flows, _leads uuid[], _nos text[], _dias int)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _nid text; _c jsonb; _canal text; _p uuid; _total int; _lista text; _resto int; _txt text; _n int := 0;
begin
  for _nid in select distinct n from unnest(_nos) n where n <> '' loop
    _c := coalesce(crm_flow_node(_flow, _nid)->'data', '{}'::jsonb);
    _canal := coalesce(nullif(_c->>'channel', ''), 'app');
    for _p, _total, _lista in
      with alvo as (
        select l.id, l.name, l.opportunity_value, s.name as etapa,
               crm_flow_people(_flow.tenant_id, l.owner_staff_id, _c, _flow.id, _nid, true) as pessoas
          from unnest(_leads, _nos) as u(lead_id, no)
          join crm_leads l on l.id = u.lead_id
          left join crm_stages s on s.id = l.stage_id
         where u.no = _nid
      ), por_pessoa as (
        select p as pessoa, a.name, a.opportunity_value, a.etapa,
               row_number() over (partition by p order by a.opportunity_value desc nulls last, a.name) as ordem,
               count(*) over (partition by p) as total
          from alvo a cross join lateral unnest(a.pessoas) p
      )
      select pessoa, max(total)::int,
             string_agg(format('%s (%s)%s', coalesce(name, 'Contato'), crm_flow_money(coalesce(opportunity_value, 0)),
                               case when etapa is null then '' else ' em ' || etapa end), E'\n' order by ordem) filter (where ordem <= 25)
        from por_pessoa group by pessoa
    loop
      _resto := greatest(_total - 25, 0);
      _txt := format('%s leads completaram %s %s sem movimento ao mesmo tempo. Por isso o aviso veio agrupado e nenhuma tarefa individual foi criada.',
                     _total, _dias, case when _dias = 1 then 'dia' else 'dias' end)
              || E'\n\n' || _lista || case when _resto > 0 then format(E'\ne mais %s.', _resto) else '' end;
      if _canal in ('app', 'both') then
        insert into onboarding_notifications (staff_id, type, title, message, reference_type, is_read, action_url)
        values (_p, 'crm_flow', format('%s: %s leads de uma vez', _flow.name, _total), _txt, 'crm_flow', false, '/crm');
      end if;
      if _canal in ('whatsapp', 'both') then
        insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload)
        values (_flow.tenant_id, 'staff_whatsapp', null, _flow.id, null, _nid, jsonb_build_object(
          'staff_id', _p, 'message', format(E'*%s: %s leads de uma vez*\n\n%s', _flow.name, _total, _txt),
          'instance_id', nullif(_c->>'instance_id', ''), 'manual', false));
      end if;
      _n := _n + 1;
    end loop;
  end loop;
  return _n;
end $$;
revoke all on function public.crm_flow_aviso_agrupado(public.crm_flows, uuid[], text[], int) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_flow_exec_node(_run crm_flow_runs, _flow crm_flows, _node jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _t text := _node->>'type'; _c jsonb := coalesce(_node->'data', '{}'::jsonb); _nid text := _node->>'id';
  _lead uuid := _run.lead_id; _tenant uuid := _flow.tenant_id; _ctx jsonb := _run.context; _dry boolean := _run.is_dry;
  _owner uuid; _people uuid[]; _p uuid; _txt text; _title text; _lead_name text; _stage uuid; _pipe uuid;
  _val text; _n numeric; _m numeric; _num numeric; _field text; _resume timestamptz; _hh text; _type text;
  _body text; _fields jsonb; _when timestamptz; _ok boolean; _x jsonb;
begin
  select owner_staff_id, name into _owner, _lead_name from crm_leads where id = _lead;
  _lead_name := coalesce(_lead_name, 'Contato');

  if _t in ('trigger', 'end', 'note') then
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tipo', _t));

  elsif _t = 'condition' then
    if crm_flow_condition_ok(_lead, _c, _ctx) then
      return jsonb_build_object('next', 'yes', 'detail', jsonb_build_object('resultado', 'sim'));
    end if;
    return jsonb_build_object('next', 'no', 'detail', jsonb_build_object('resultado', 'não'));

  elsif _t = 'split' then
    _num := coalesce(crm_flow_num(_c->>'percent_a'), 50);
    if random() * 100 < _num then
      return jsonb_build_object('next', 'a', 'detail', jsonb_build_object('lado', 'A'));
    end if;
    return jsonb_build_object('next', 'b', 'detail', jsonb_build_object('lado', 'B'));

  elsif _t = 'wait' then
    if coalesce(_c->>'mode', 'duration') = 'business' then
      _resume := crm_flow_window_next(now());
    elsif coalesce(_c->>'mode', 'duration') = 'time' then
      _hh := coalesce(nullif(_c->>'until_time', ''), '09:00');
      _resume := ((now() at time zone 'America/Sao_Paulo')::date + _hh::time) at time zone 'America/Sao_Paulo';
      if _resume <= now() then _resume := _resume + interval '1 day'; end if;
    else
      _resume := now() + case coalesce(_c->>'unit', 'minutes')
        when 'minutes' then make_interval(mins => greatest(coalesce(nullif(_c->>'value', '')::int, 5), 0))
        when 'hours' then make_interval(hours => greatest(coalesce(nullif(_c->>'value', '')::int, 1), 0))
        else make_interval(days => greatest(coalesce(nullif(_c->>'value', '')::int, 1), 0)) end;
    end if;
    if coalesce((_c->>'respect_window')::boolean, false) then _resume := crm_flow_window_next(_resume); end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'ate', _resume));
    end if;
    if _resume <= now() then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'já está no horário, seguiu direto'));
    end if;
    return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'delay', 'resume_at', _resume),
                              'detail', jsonb_build_object('ate', _resume));

  elsif _t = 'wait_reply' then
    _resume := now() + make_interval(hours => greatest(coalesce(nullif(_c->>'hours', '')::int, 24), 1));
    if _dry then
      return jsonb_build_object('next', 'timeout', 'detail', jsonb_build_object('simulado', true, 'estoura_em', _resume,
                                'resultado', 'na simulação segue por Não respondeu'));
    end if;
    return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'reply', 'resume_at', _resume),
                              'detail', jsonb_build_object('estoura_em', _resume));

  elsif _t = 'send_whatsapp' then
    _txt := crm_flow_render(_c->>'message', _lead, _ctx);
    _when := case when coalesce((_c->>'respect_window')::boolean, true) then crm_flow_window_next(now()) else now() end;
    if btrim(_txt) = '' then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'mensagem vazia'));
    end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'mensagem', _txt, 'envio_em', _when));
    end if;
    insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload, scheduled_at)
    values (_tenant, 'lead_whatsapp', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
      'message', _txt,
      'instance_mode', coalesce(nullif(_c->>'instance_mode', ''), 'conversation'),
      'instance_kind', coalesce(nullif(_c->>'instance_kind', ''), 'evolution'),
      'instance_id', nullif(_c->>'instance_id', ''),
      'manual', _run.trigger_type = 'manual'), _when);
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'na fila de envio', 'mensagem', _txt, 'envio_em', _when));

  elsif _t = 'create_task' then
    -- lead que entrou no aviso agrupado (muitos parados ao mesmo tempo): sem tarefa individual
    if nullif(_ctx->>'lote_no', '') is not null and not _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('em_lote', true, 'tarefa', 'não criada: o lead entrou no aviso agrupado'));
    end if;
    _title := crm_flow_render(coalesce(nullif(_c->>'title', ''), _flow.name), _lead, _ctx);
    _type := coalesce(nullif(_c->>'activity_type', ''), 'followup');
    if _type not in ('call', 'whatsapp', 'email', 'meeting', 'followup', 'proposal', 'other', 'note') then _type := 'followup'; end if;
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    _when := now() + make_interval(days => coalesce(nullif(_c->>'days', '')::int, 0), hours => coalesce(nullif(_c->>'hours', '')::int, 0));
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'tarefa', _title, 'pessoas', to_jsonb(_people), 'para', _when));
    end if;
    if array_length(_people, 1) is null then _people := array[null::uuid]; end if;
    foreach _p in array _people loop
      insert into crm_activities (lead_id, type, title, description, scheduled_at, status, responsible_staff_id, is_automation, automation_config)
      values (_lead, _type, _title, nullif(crm_flow_render(_c->>'description', _lead, _ctx), ''), _when, 'pending', _p, false,
              jsonb_build_object('source', 'flow', 'flow_id', _flow.id, 'run_id', _run.id));
      if _p is not null and coalesce((_c->>'notify')::boolean, true) then
        insert into onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, is_read)
        values (_p, 'task_assigned', 'Nova tarefa automática', format('%s: "%s" no lead %s.', _flow.name, _title, _lead_name), _lead, 'crm_lead', false);
      end if;
    end loop;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tarefa', _title, 'pessoas', to_jsonb(_people), 'para', _when));

  elsif _t = 'notify' then
    -- lead que entrou no aviso agrupado: quem avisa é a varredura, uma vez só, com a lista
    if _ctx->>'lote_no' = _nid and not _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('em_lote', true, 'aviso', 'saiu no aviso agrupado'));
    end if;
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    _txt := crm_flow_render(coalesce(nullif(_c->>'message', ''), _flow.name || ': {lead_name}'), _lead, _ctx);
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'pessoas', to_jsonb(coalesce(_people, '{}'::uuid[])), 'mensagem', _txt, 'canal', coalesce(nullif(_c->>'channel', ''), 'app')));
    end if;
    foreach _p in array coalesce(_people, '{}'::uuid[]) loop
      if coalesce(nullif(_c->>'channel', ''), 'app') in ('app', 'both') then
        -- 16/10/2026: o link do lead sai do texto (ficava cortado na tela) e vira o botão
        -- "Abrir lead" (action_url). No WhatsApp o link continua dentro da mensagem.
        insert into onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, is_read, action_url)
        values (_p, 'crm_flow', _flow.name,
                btrim(regexp_replace(regexp_replace(_txt, '\s*https?://\S+', '', 'g'), '\s+([.,;:])', '\1', 'g')),
                _lead, 'crm_lead', false, case when _lead is null then null else '/crm/leads/' || _lead end);
      end if;
      if coalesce(nullif(_c->>'channel', ''), 'app') in ('whatsapp', 'both') then
        insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload)
        values (_tenant, 'staff_whatsapp', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
          'staff_id', _p, 'message', format(E'*%s*\n\n%s', _flow.name, _txt),
          'instance_id', nullif(_c->>'instance_id', ''), 'manual', _run.trigger_type = 'manual'));
      end if;
    end loop;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('pessoas', to_jsonb(coalesce(_people, '{}'::uuid[])), 'mensagem', _txt));

  elsif _t = 'move_stage' then
    select id, pipeline_id into _stage, _pipe from crm_stages where id = nullif(_c->>'stage_id', '')::uuid;
    if _stage is null then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'etapa não existe mais'));
    end if;
    if not _dry then
      update crm_leads set stage_id = _stage, pipeline_id = _pipe where id = _lead and stage_id is distinct from _stage;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('etapa', _stage, 'simulado', _dry));

  elsif _t = 'add_tag' then
    if nullif(_c->>'tag_id', '') is not null and not _dry then
      insert into crm_lead_tags (lead_id, tag_id) values (_lead, (_c->>'tag_id')::uuid)
      on conflict (lead_id, tag_id) do nothing;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tag', _c->>'tag_id', 'simulado', _dry));

  elsif _t = 'remove_tag' then
    if not _dry then
      delete from crm_lead_tags where lead_id = _lead and tag_id = nullif(_c->>'tag_id', '')::uuid;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tag', _c->>'tag_id', 'simulado', _dry));

  elsif _t = 'assign_owner' then
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    if array_length(_people, 1) is null then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'nenhuma pessoa ativa pra assumir'));
    end if;
    if not _dry then
      update crm_leads set owner_staff_id = _people[1] where id = _lead and owner_staff_id is distinct from _people[1];
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('dono', _people[1], 'simulado', _dry));

  elsif _t = 'set_field' then
    _field := _c->>'field';
    _val := crm_flow_transform(crm_flow_render(coalesce(_c->>'value', ''), _lead, _ctx), _c->>'transform');
    if _field like 'ctx.%' and length(_field) > 4 then
      _ctx := jsonb_set(_ctx, array['vars', substr(_field, 5)], to_jsonb(_val), true);
      update crm_flow_runs set context = _ctx where id = _run.id;
    elsif _dry then
      null;
    elsif _field in ('name', 'email', 'phone', 'company', 'trade_name', 'document', 'city', 'state', 'segment', 'role', 'notes',
                     'main_pain', 'urgency', 'instagram', 'estimated_revenue', 'employee_count',
                     'utm_source', 'utm_medium', 'utm_campaign') then
      if _field = 'name' and btrim(_val) = '' then
        return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'nome não pode ficar vazio'));
      end if;
      execute format('update crm_leads set %I = $1 where id = $2', _field) using nullif(_val, ''), _lead;
    elsif _field = 'opportunity_value' then
      update crm_leads set opportunity_value = crm_flow_num(_val) where id = _lead;
    elsif _field in ('probability', 'fit_score') then
      execute format('update crm_leads set %I = $1 where id = $2', _field) using crm_flow_num(_val)::int, _lead;
    else
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'campo não gravável: ' || coalesce(_field, '?')));
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('campo', _field, 'valor', _val, 'simulado', _dry and _field not like 'ctx.%'));

  elsif _t = 'formula' then
    _n := crm_flow_num(crm_flow_render(_c->>'a', _lead, _ctx));
    _m := crm_flow_num(crm_flow_render(_c->>'b', _lead, _ctx));
    _num := case coalesce(_c->>'op', '+') when '+' then _n + _m when '-' then _n - _m when '*' then _n * _m
              when '/' then case when _m = 0 then null else _n / _m end when '%' then _n * _m / 100 else _n end;
    _field := coalesce(nullif(_c->>'result', ''), 'ctx.resultado');
    if _field like 'ctx.%' then
      _ctx := jsonb_set(_ctx, array['vars', substr(_field, 5)], to_jsonb(coalesce(round(_num, 2)::text, '')), true);
      update crm_flow_runs set context = _ctx where id = _run.id;
    elsif _field = 'opportunity_value' and not _dry then
      update crm_leads set opportunity_value = round(_num, 2) where id = _lead;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('a', _n, 'b', _m, 'resultado', round(_num, 2)));

  elsif _t = 'webhook' then
    if coalesce(_c->>'url', '') !~* '^https?://' then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'URL inválida'));
    end if;
    -- corpo: mapeamento campo -> valor, JSON próprio, ou o lead completo (montado pela edge)
    _body := null; _fields := null;
    if coalesce(_c->>'body_mode', 'lead') = 'fields' then
      select coalesce(jsonb_object_agg(x->>'key', crm_flow_render(x->>'value', _lead, _ctx)), '{}'::jsonb) into _fields
        from jsonb_array_elements(coalesce(_c->'fields', '[]'::jsonb)) x where nullif(x->>'key', '') is not null;
    elsif coalesce(_c->>'body_mode', 'lead') = 'raw' and nullif(_c->>'body', '') is not null then
      _body := crm_flow_render(_c->>'body', _lead, _ctx, true);
    end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'url', _c->>'url',
                                'metodo', coalesce(nullif(_c->>'method', ''), 'POST'), 'corpo', coalesce(_fields, to_jsonb(_body))));
    end if;
    insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload)
    values (_tenant, 'webhook', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
      'url', _c->>'url', 'method', coalesce(nullif(_c->>'method', ''), 'POST'), 'headers', coalesce(_c->'headers', '[]'::jsonb),
      'body', _body, 'fields', _fields, 'trigger', _run.trigger_type, 'flow_name', _flow.name, 'vars', coalesce(_ctx->'vars', '{}'::jsonb),
      'wait_response', coalesce((_c->>'wait_response')::boolean, false), 'manual', _run.trigger_type = 'manual'));
    if coalesce((_c->>'wait_response')::boolean, false) then
      return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'webhook', 'resume_at', now() + interval '1 hour'),
                                'detail', jsonb_build_object('resultado', 'aguardando resposta do webhook'));
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'webhook na fila'));

  elsif _t = 'enroll_cadence' then
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'cadencia', _c->>'cadence_id'));
    end if;
    _ok := crm_flow_cadence_enroll(nullif(_c->>'cadence_id', '')::uuid, _lead);
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('cadencia', _c->>'cadence_id',
                              'resultado', case when _ok then 'inscrito' else 'já estava na cadência ou ela está desligada' end));

  elsif _t = 'stop_cadence' then
    if not _dry then
      update crm_cadence_enrollments set status = 'stopped', stopped_reason = 'flow', next_run_at = null, updated_at = now()
       where lead_id = _lead and status in ('active', 'paused')
         and (nullif(_c->>'cadence_id', '') is null or cadence_id = (_c->>'cadence_id')::uuid);
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'cadências paradas', 'simulado', _dry));

  elsif _t = 'start_flow' then
    if nullif(_c->>'flow_id', '') is not null and (_c->>'flow_id')::uuid <> _flow.id then
      perform crm_flow_start((_c->>'flow_id')::uuid, _lead, 'flow:' || (_c->>'flow_id') || ':from:' || _run.id, 'manual',
                             jsonb_build_object('vars', coalesce(_ctx->'vars', '{}'::jsonb), 'from_run', _run.id), _run.depth + 1, _dry, _run.started_by);
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('fluxo', _c->>'flow_id'));

  else
    return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'bloco desconhecido: ' || coalesce(_t, '?')));
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.crm_flow_scan_time()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f public.crm_flows; x record; _n int := 0; _k int; _cfg jsonb; _only_new boolean; _since timestamptz;
  _days int; _hours int; _mins int; _lento boolean;
  _w0 timestamptz; _w1 timestamptz; _cur_ts timestamptz; _cur_id uuid; _touch timestamptz; _seen int; _cheio boolean;
  _ids uuid[]; _tcs timestamptz[]; _nos text[]; _lote_ids uuid[]; _lote_nos text[]; _i int; _em_lote boolean; _ctx0 jsonb;
begin
  for f in select * from crm_flows where is_active and trigger_type in ('lead_idle', 'activity_overdue', 'no_reply', 'lead_no_reply') loop
    -- gatilhos medidos em dias varrem a cada 5 min; os de minutos/horas, todo ciclo
    _lento := f.trigger_type in ('lead_idle', 'lead_no_reply');
    continue when _lento and f.last_scan_at is not null and f.last_scan_at > now() - interval '5 minutes';
    _cfg := coalesce(f.trigger_config, '{}'::jsonb);
    _only_new := coalesce((_cfg->>'only_new')::boolean, true);
    _since := coalesce(f.activated_at, f.created_at);
    _k := 0;
    begin
      if f.trigger_type = 'lead_idle' then
        -- parado = N dias sem movimento (entrada na etapa, atividade concluída ou mensagem).
        -- Dispara uma vez por "parada": se alguém mexer e o lead parar de novo, conta outra vez.
        -- A busca parte de quem cruzou a marca dos N dias nos últimos 3 dias (três índices pequenos),
        -- nunca dos 118 mil leads.
        _days := greatest(coalesce(nullif(_cfg->>'days', '')::int, 3), 1);
        _ids := '{}'; _tcs := '{}'; _nos := '{}';
        _w1 := now() - make_interval(days => _days);
        _w0 := greatest(_since - make_interval(days => _days), _w1 - interval '3 days');
        for x in
          with cand as (
            select l.id from crm_leads l where l.stage_entered_at >= _w0 and l.stage_entered_at <= _w1
            union
            select a.lead_id from crm_activities a where a.completed_at >= _w0 and a.completed_at <= _w1
            union
            select c.lead_id from crm_whatsapp_conversations c
             where c.lead_id is not null and c.last_message_at >= _w0 and c.last_message_at <= _w1
          )
          select l.id, t.touch
            from cand
            join crm_leads l on l.id = cand.id
            join crm_stages s on s.id = l.stage_id and not coalesce(s.is_final, false)
            cross join lateral (select crm_flow_lead_touch(l.id) as touch) t
           where l.tenant_id is not distinct from f.tenant_id
             and (nullif(_cfg->>'stage_id', '') is null or l.stage_id = (_cfg->>'stage_id')::uuid)
             and t.touch >= _w0 and t.touch <= _w1
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'idle:' || f.id || ':' || l.id || ':' || extract(epoch from t.touch)::bigint)
           order by t.touch desc
           limit 200
        loop
          continue when not crm_flow_filters_match(f.filters, x.id);
          _ctx0 := jsonb_build_object('vars', jsonb_build_object('parado_desde', to_char(x.touch at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'dias_parado', _days::text));
          _ids := _ids || x.id; _tcs := _tcs || x.touch;
          _nos := _nos || coalesce(crm_flow_aviso_previsto(f, x.id, _ctx0), '');
          exit when coalesce(array_length(_ids, 1), 0) >= 50;
        end loop;
        -- Aviso agrupado (Fabrício, 23/11/2026): quando mais de 10 leads desta varredura chegariam no
        -- bloco "Avisar pessoas", eles não geram aviso nem tarefa um por um; sai uma mensagem só com a
        -- lista. Mudança de etapa em lote fazia todo mundo completar os N dias junto (136 avisos em 20/11).
        _em_lote := (select count(*) from unnest(_nos) n where n <> '') > 10;
        _lote_ids := '{}'; _lote_nos := '{}';
        for _i in 1 .. coalesce(array_length(_ids, 1), 0) loop
          _ctx0 := jsonb_build_object('vars', jsonb_build_object('parado_desde', to_char(_tcs[_i] at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'dias_parado', _days::text))
                   || case when _em_lote and _nos[_i] <> '' then jsonb_build_object('lote_no', _nos[_i]) else '{}'::jsonb end;
          if crm_flow_start(f.id, _ids[_i], 'idle:' || f.id || ':' || _ids[_i] || ':' || extract(epoch from _tcs[_i])::bigint, 'lead_idle', _ctx0) is not null then
            _k := _k + 1;
            if _em_lote and _nos[_i] <> '' then _lote_ids := _lote_ids || _ids[_i]; _lote_nos := _lote_nos || _nos[_i]; end if;
          end if;
        end loop;
        if coalesce(array_length(_lote_ids, 1), 0) > 0 then
          perform crm_flow_aviso_agrupado(f, _lote_ids, _lote_nos, _days);
        end if;

        -- "Pegar também quem já estava parado": drena o passado aos poucos, do mais recente pro
        -- mais antigo, com um cursor guardado no fluxo (50 disparos por varredura, no máximo).
        if not _only_new and _k < 50 and not coalesce((f.scan_state->>'backlog_done')::boolean, false) then
          _cur_ts := coalesce((f.scan_state->>'cursor_ts')::timestamptz, _since - make_interval(days => _days));
          _cur_id := coalesce((f.scan_state->>'cursor_id')::uuid, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
          _seen := 0; _cheio := false;
          -- a subconsulta só anda no índice de stage_entered_at (3.000 por vez); os filtros vêm depois,
          -- pra que o cursor avance mesmo quando o lote inteiro é de outro funil
          for x in
            select l.id, l.stage_entered_at,
                   (s.id is not null and not coalesce(s.is_final, false)
                    and l.tenant_id is not distinct from f.tenant_id
                    and (nullif(_cfg->>'stage_id', '') is null or l.stage_id = (_cfg->>'stage_id')::uuid)
                    and (nullif(f.filters->>'pipeline_id', '') is null or l.pipeline_id = (f.filters->>'pipeline_id')::uuid)
                    and (nullif(f.filters->>'stage_id', '') is null or l.stage_id = (f.filters->>'stage_id')::uuid)) as serve
              from (select l0.id, l0.stage_entered_at, l0.stage_id, l0.pipeline_id, l0.tenant_id
                      from crm_leads l0
                     where l0.stage_entered_at <= _cur_ts and (l0.stage_entered_at < _cur_ts or l0.id < _cur_id)
                     order by l0.stage_entered_at desc, l0.id desc
                     limit 3000) l
              left join crm_stages s on s.id = l.stage_id
             order by l.stage_entered_at desc, l.id desc
          loop
            _seen := _seen + 1; _cur_ts := x.stage_entered_at; _cur_id := x.id;
            continue when not x.serve;
            _touch := crm_flow_lead_touch(x.id);
            continue when _touch is null or _touch > _w1;
            continue when not crm_flow_filters_match(f.filters, x.id);
            if crm_flow_start(f.id, x.id, 'idle:' || f.id || ':' || x.id || ':' || extract(epoch from _touch)::bigint, 'lead_idle',
                 jsonb_build_object('vars', jsonb_build_object('parado_desde', to_char(_touch at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'dias_parado', _days::text))) is not null then
              _k := _k + 1;
            end if;
            if _k >= 50 then _cheio := true; exit; end if;
          end loop;
          update crm_flows set scan_state = jsonb_build_object('cursor_ts', _cur_ts, 'cursor_id', _cur_id,
                 'backlog_done', (not _cheio and _seen < 3000)) where id = f.id;
        end if;

      elsif f.trigger_type = 'activity_overdue' then
        _hours := greatest(coalesce(nullif(_cfg->>'hours', '')::int, 1), 0);
        for x in
          select a.id, a.lead_id, a.title, a.scheduled_at, a.responsible_staff_id
            from crm_activities a
            join crm_leads l on l.id = a.lead_id and l.tenant_id is not distinct from f.tenant_id
           where a.status = 'pending'
             and a.scheduled_at < now() - make_interval(hours => _hours)
             and a.scheduled_at > now() - interval '7 days'
             and (nullif(_cfg->>'activity_type', '') is null or a.type = _cfg->>'activity_type')
             and (not _only_new or a.scheduled_at + make_interval(hours => _hours) >= _since)
             and coalesce(a.automation_config->>'flow_id', '') <> f.id::text   -- tarefa que o próprio fluxo criou não realimenta
             and not exists (select 1 from crm_flow_runs r where r.dedupe_key = 'overdue:' || f.id || ':' || a.id)
           order by a.scheduled_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'overdue:' || f.id || ':' || x.id, 'activity_overdue',
               jsonb_build_object('activity_id', x.id, 'vars', jsonb_build_object('tarefa', coalesce(x.title, ''),
                 'tarefa_data', to_char(x.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
                 'tarefa_responsavel', coalesce((select name from onboarding_staff where id = x.responsible_staff_id), '')))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;

      elsif f.trigger_type = 'no_reply' then
        -- SLA: o cliente escreveu e ninguém respondeu em N minutos (úteis, se pedido)
        _mins := greatest(coalesce(nullif(_cfg->>'minutes', '')::int, 15), 1);
        for x in
          select c.id, c.lead_id, c.last_inbound_at
            from crm_whatsapp_conversations c
            join crm_leads l on l.id = c.lead_id and l.tenant_id is not distinct from f.tenant_id
            left join crm_whatsapp_contacts ct on ct.id = c.contact_id
           where c.last_message_direction = 'inbound'
             and c.project_id is null and c.merged_into is null
             and coalesce(c.status, 'open') <> 'closed'
             and c.last_inbound_at < now() - make_interval(mins => _mins)
             and c.last_inbound_at > now() - interval '3 days'
             and (nullif(_cfg->>'instance_id', '') is null or c.instance_id = (_cfg->>'instance_id')::uuid
                  or c.official_instance_id = (_cfg->>'instance_id')::uuid)
             and (not _only_new or c.last_inbound_at >= _since)
             and coalesce(ct.phone, '') !~ '[@-]'   -- grupo não entra
             and (not coalesce((_cfg->>'business_hours')::boolean, false)
                  or crm_business_seconds_between(c.last_inbound_at, now()) >= _mins * 60)
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'sla:' || f.id || ':' || c.id || ':' || extract(epoch from c.last_inbound_at)::bigint)
           order by c.last_inbound_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'sla:' || f.id || ':' || x.id || ':' || extract(epoch from x.last_inbound_at)::bigint, 'no_reply',
               jsonb_build_object('conversation_id', x.id, 'vars', jsonb_build_object(
                 'esperando_desde', to_char(x.last_inbound_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'minutos_sla', _mins::text))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;

      elsif f.trigger_type = 'lead_no_reply' then
        -- a última mensagem foi nossa e o lead está há N dias sem responder
        _days := greatest(coalesce(nullif(_cfg->>'days', '')::int, 2), 1);
        for x in
          select c.id, c.lead_id, c.last_message_at
            from crm_whatsapp_conversations c
            join crm_leads l on l.id = c.lead_id and l.tenant_id is not distinct from f.tenant_id
            join crm_stages s on s.id = l.stage_id and not coalesce(s.is_final, false)
            left join crm_whatsapp_contacts ct on ct.id = c.contact_id
           where c.last_message_direction = 'outbound'
             and c.project_id is null and c.merged_into is null
             and c.last_message_at < now() - make_interval(days => _days)
             and c.last_message_at > now() - make_interval(days => _days + 7)
             and (not _only_new or c.last_message_at + make_interval(days => _days) >= _since)
             and coalesce(ct.phone, '') !~ '[@-]'
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'lnr:' || f.id || ':' || c.id || ':' || extract(epoch from c.last_message_at)::bigint)
           order by c.last_message_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'lnr:' || f.id || ':' || x.id || ':' || extract(epoch from x.last_message_at)::bigint, 'lead_no_reply',
               jsonb_build_object('conversation_id', x.id, 'vars', jsonb_build_object(
                 'ultima_mensagem', to_char(x.last_message_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'dias_sem_resposta', _days::text))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;
      end if;
    exception when others then
      raise warning 'crm_flow_scan_time fluxo %: %', f.id, sqlerrm;
    end;
    if _lento then update crm_flows set last_scan_at = now() where id = f.id; end if;
    _n := _n + _k;
  end loop;
  return _n;
end $function$;
