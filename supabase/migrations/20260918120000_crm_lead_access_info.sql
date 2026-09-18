-- 18/09/2026: closer abre link de lead que está com outra pessoa e via "Erro ao carregar lead".
-- Esta função diz, pra quem é da equipe do CRM, se o lead existe e com quem está (sem abrir os dados dele),
-- pra tela explicar o motivo. Respeita o tenant de quem pergunta.
create or replace function public.crm_lead_access_info(p_lead uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare st record; l record;
begin
  select s.id, s.tenant_id into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null then return jsonb_build_object('exists', false); end if;
  select cl.name, cl.tenant_id, o.name owner_name into l
  from crm_leads cl left join onboarding_staff o on o.id = cl.owner_staff_id where cl.id = p_lead;
  if not found or (l.tenant_id is distinct from st.tenant_id) then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'lead_name', l.name, 'owner_name', l.owner_name);
end $$;
revoke all on function public.crm_lead_access_info(uuid) from public;
grant execute on function public.crm_lead_access_info(uuid) to authenticated;
