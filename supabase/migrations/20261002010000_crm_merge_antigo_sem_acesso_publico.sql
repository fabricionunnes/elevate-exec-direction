-- As duas funções antigas de mesclagem de leads são SECURITY DEFINER, não
-- conferem permissão e estavam executáveis por anon: qualquer um com a chave
-- pública do app podia chamar. A tela não usa mais nenhuma das duas (a mesclagem
-- passou pra crm_leads_bulk / crm_lead_merge_one, que conferem o papel).
revoke all on function public.merge_crm_leads(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.bulk_merge_phone_duplicates(integer, integer) from public, anon, authenticated;
grant execute on function public.merge_crm_leads(uuid, uuid[]) to service_role;
grant execute on function public.bulk_merge_phone_duplicates(integer, integer) to service_role;
