-- Valor da venda acompanha o valor do negócio do lead ganho (Fabrício, 27/10/2026: "ajustar o valor
-- do lead e mudar no dash"). A venda (crm_sales) nasce no ganho com o valor daquele momento e editar o
-- lead depois não mudava o dashboard (caso Rosiane: lead 6k, venda 12k).
create or replace function public.crm_sale_sync_valor_lead()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_won boolean; v_qtd int;
begin
  if NEW.opportunity_value is null or NEW.opportunity_value <= 0
     or NEW.opportunity_value is not distinct from OLD.opportunity_value then
    return NEW;
  end if;
  select (final_type = 'won') into v_won from crm_stages where id = NEW.stage_id;
  if not coalesce(v_won, false) then return NEW; end if;
  select count(*) into v_qtd from crm_sales where lead_id = NEW.id;
  if v_qtd <> 1 then return NEW; end if; -- mais de uma venda: não dá pra saber qual corrigir
  update crm_sales
     set billing_value = NEW.opportunity_value,
         -- receita igual ao faturamento acompanha; se alguém separou os dois de propósito, preserva
         revenue_value = case when revenue_value = billing_value then NEW.opportunity_value else revenue_value end,
         notes = coalesce(notes || E'\n', '') || '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
                 || '] valor ajustado pelo lead: ' || coalesce(billing_value::text, '-') || ' → ' || NEW.opportunity_value::text,
         updated_at = now()
   where lead_id = NEW.id and billing_value is distinct from NEW.opportunity_value;
  return NEW;
exception when others then
  raise warning 'crm_sale_sync_valor_lead: %', sqlerrm;
  return NEW; -- nunca trava a edição do lead
end $$;
drop trigger if exists crm_sale_sync_valor_lead on public.crm_leads;
create trigger crm_sale_sync_valor_lead after update of opportunity_value on public.crm_leads
  for each row execute function public.crm_sale_sync_valor_lead();
