-- Lead que já nasce na etapa Perdido (desqualificado pelo formulário, ex.: UNV Ads faturamento até R$ 25 mil)
-- não é conversão: não manda Lead pro Meta pela CAPI e não consome vaga do rodízio.
CREATE OR REPLACE FUNCTION public.trg_capi_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if exists (select 1 from crm_stages s where s.id = NEW.stage_id and s.final_type = 'lost') then
    return NEW;
  end if;
  if (NEW.fbclid is not null and NEW.fbclid <> '')
     or (NEW.utm_source ~* '(facebook|meta|instagram|\mfb\M|\mig\M)') then
    perform public.fire_capi(NEW.id, 'Lead', null);
  end if;
  return NEW;
end; $$;

CREATE OR REPLACE FUNCTION public.crm_distribute_new_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_dist uuid; v_staff uuid;
begin
  if new.owner_staff_id is not null or new.pipeline_id is null then return new; end if;
  if exists (select 1 from crm_stages s where s.id = new.stage_id and s.final_type = 'lost') then return new; end if;
  select id into v_dist from crm_lead_distribution where pipeline_id = new.pipeline_id and is_active;
  if v_dist is null then return new; end if;
  v_staff := crm_pick_distribution_member(v_dist);
  if v_staff is not null then new.owner_staff_id := v_staff; end if;
  return new;
end $$;
