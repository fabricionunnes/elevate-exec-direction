-- Atendimento sumiu (15/10/2026): a carga de conversas passou de 8 s e o banco cancelava.
-- As políticas chamavam funções (get_current_staff_id, is_crm_admin, tenant...) a CADA linha:
-- 6 mil conversas + 4,6 mil contatos + 3 mil leads = dezenas de milhares de chamadas.
-- Mesma regra, mas com (select f()) o Postgres calcula uma vez por consulta (initplan).
-- Nada muda em quem vê o quê.

-- conversas e contatos do WhatsApp
alter policy "Staff can view whatsapp conversations" on public.crm_whatsapp_conversations using ((select get_current_staff_id()) is not null);
alter policy "Staff can update whatsapp conversations" on public.crm_whatsapp_conversations using ((select get_current_staff_id()) is not null);
alter policy "Staff can delete whatsapp conversations" on public.crm_whatsapp_conversations using ((select get_current_staff_id()) is not null);
alter policy "Staff can insert whatsapp conversations" on public.crm_whatsapp_conversations with check ((select get_current_staff_id()) is not null);
alter policy "Staff can view whatsapp contacts" on public.crm_whatsapp_contacts using ((select get_current_staff_id()) is not null);
alter policy "Staff can update whatsapp contacts" on public.crm_whatsapp_contacts using ((select get_current_staff_id()) is not null);
alter policy "Staff can insert whatsapp contacts" on public.crm_whatsapp_contacts with check ((select get_current_staff_id()) is not null);

-- leads
-- crm_lead_hidden_by_pipeline já devolve false pra quem não é staff ou é admin: decide isso antes, uma vez só
alter policy "Acesso por funil (ver)" on public.crm_leads
  using ((select get_current_staff_id()) is null or (select is_crm_admin()) or not crm_lead_hidden_by_pipeline(pipeline_id, owner_staff_id));
alter policy "CRM users can view leads" on public.crm_leads
  using ((select is_crm_admin()) or (select can_view_all_crm_leads()) or ((select has_crm_access()) and owner_staff_id = (select get_current_staff_id())));
alter policy "CRM users can update leads" on public.crm_leads
  using ((select is_crm_admin()) or (select can_view_all_crm_leads()) or ((select has_crm_access()) and owner_staff_id = (select get_current_staff_id())));
-- tenant_matches(x) = x is not distinct from current_user_tenant_id()
alter policy "Tenant isolation" on public.crm_leads
  using (tenant_id is not distinct from (select current_user_tenant_id()))
  with check (tenant_id is not distinct from (select current_user_tenant_id()));
alter policy "dialer client own leads" on public.crm_leads
  using ((select current_user_dialer_tenant_id()) is not null and tenant_id = (select current_user_dialer_tenant_id()))
  with check ((select current_user_dialer_tenant_id()) is not null and tenant_id = (select current_user_dialer_tenant_id()));
alter policy "tenant_iso_select" on public.crm_leads
  using (case when (select is_master_user()) then tenant_id is null
              when (select current_user_tenant_id()) is not null then tenant_id = (select current_user_tenant_id())
              else true end);
alter policy "tenant_iso_modify" on public.crm_leads
  using (case when (select is_master_user()) then tenant_id is null
              when (select current_user_tenant_id()) is not null then tenant_id = (select current_user_tenant_id())
              else true end)
  with check (case when (select is_master_user()) then tenant_id is null
              when (select current_user_tenant_id()) is not null then (tenant_id = (select current_user_tenant_id()) or tenant_id is null)
              else true end);

-- Instagram: mesma ideia (auth.uid() uma vez por consulta, não por linha)
alter policy "Staff can manage instagram conversations" on public.instagram_conversations
  using (exists (select 1 from onboarding_staff os where os.user_id = (select auth.uid()) and os.is_active = true));
alter policy "Staff can view instagram conversations they have access to" on public.instagram_conversations
  using (exists (select 1 from onboarding_staff os where os.user_id = (select auth.uid()) and os.is_active = true
    and (os.role = 'master' or exists (select 1 from instagram_instance_access ia
      where ia.instance_id = instagram_conversations.instance_id and ia.staff_id = os.id and ia.can_view = true))));
alter policy "Staff can manage instagram contacts" on public.instagram_contacts
  using (exists (select 1 from onboarding_staff os where os.user_id = (select auth.uid()) and os.is_active = true));
alter policy "Staff can view instagram contacts" on public.instagram_contacts
  using (exists (select 1 from onboarding_staff os where os.user_id = (select auth.uid()) and os.is_active = true));
