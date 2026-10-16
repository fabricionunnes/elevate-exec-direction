-- Notificação de fluxo (nó "avisar", canal app): link do lead sai do texto e vira action_url.
-- Fabrício, 16/10/2026: "a notificação está aparecendo cortada" (alerta "Lead parado 3 dias"
-- com a URL inteira no texto). Definição tirada do banco em 16/10/2026 e alterada só nesse trecho.
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
end $function$
;
