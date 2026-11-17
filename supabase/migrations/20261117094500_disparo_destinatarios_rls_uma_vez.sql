-- 17/11/2026. A leitura de whatsapp_official_campaign_recipients chamava current_user_is_tenant() uma vez
-- por LINHA. Num disparo de 10 mil, cada contagem da barrinha de progresso levava de 2 a 6 s; com dois
-- disparos pausados a barrinha repetia isso a cada 5 s e deixou o banco inteiro lento (o Financeiro passou a
-- estourar o tempo limite e a lista de contas a pagar aparecia vazia).
-- A regra é a MESMA: só staff ativo que não é de tenant. A única diferença é o (select ...), que faz o
-- Postgres avaliar a função uma vez por consulta.
alter policy "staff le" on public.whatsapp_official_campaign_recipients
  using ((exists (select 1 from onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active))
         and (not (select current_user_is_tenant())));
alter policy "staff atualiza" on public.whatsapp_official_campaign_recipients
  using ((exists (select 1 from onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active))
         and (not (select current_user_is_tenant())));
