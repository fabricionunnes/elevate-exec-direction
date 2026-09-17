-- Segurança 17/09/2026: conversas de WhatsApp do Atendimento estavam legíveis e alteráveis sem login
-- (policies "Staff can ..." criadas TO public USING true). Passam a exigir staff ativo.
alter policy "Staff can view whatsapp messages" on public.crm_whatsapp_messages to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can insert whatsapp messages" on public.crm_whatsapp_messages to authenticated with check (get_current_staff_id() is not null);
alter policy "Staff can update whatsapp messages" on public.crm_whatsapp_messages to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can view whatsapp conversations" on public.crm_whatsapp_conversations to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can insert whatsapp conversations" on public.crm_whatsapp_conversations to authenticated with check (get_current_staff_id() is not null);
alter policy "Staff can update whatsapp conversations" on public.crm_whatsapp_conversations to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can delete whatsapp conversations" on public.crm_whatsapp_conversations to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can view whatsapp contacts" on public.crm_whatsapp_contacts to authenticated using (get_current_staff_id() is not null);
alter policy "Staff can insert whatsapp contacts" on public.crm_whatsapp_contacts to authenticated with check (get_current_staff_id() is not null);
alter policy "Staff can update whatsapp contacts" on public.crm_whatsapp_contacts to authenticated using (get_current_staff_id() is not null);
