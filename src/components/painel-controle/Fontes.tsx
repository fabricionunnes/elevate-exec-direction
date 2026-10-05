// Fontes: de onde vem cada número e o que ainda não tem fonte.
import type { Ctx } from "./ctx";
import { Lk, Panel, St, Tabela } from "./ui";

export function Fontes({ c }: { c: Ctx }) {
  const ok = <St ok tg="conectada" />;
  const parcial = <St ok={false} warn tg="" tw="parcial" />;
  const sem = <St ok={false} tg="" tb="sem fonte" />;
  return (
    <>
      <Panel titulo="De onde vem cada número" sub="tabela do banco e regra de cálculo">
        <Tabela cols={[{ h: "Número", tl: true }, { h: "Fonte", tl: true }, { h: "Regra", tl: true }, "Situação"]} rows={[
          [<Lk onClick={() => c.det("faturas_pagas")}>Recebido</Lk>, "company_invoices", "status paid e paid_at no mês (Brasília). Valor líquido informado pelo Asaas quando existe, senão o valor da fatura.", ok],
          [<Lk onClick={() => c.det("contas_pagas")}>Pago</Lk>, "financial_payables", "status paid e paid_date no mês. Valor pago quando existe, senão o valor da conta.", ok],
          ["Lucro do mês", "cálculo", "recebido menos pago. Regime de caixa. Não é DRE por competência.", ok],
          [<Lk onClick={() => c.det("faturas_vencidas")}>Vencido</Lk>, "company_invoices", "sem paid_at, status pending ou overdue, vencimento antes de hoje. Fatura paga nunca conta.", ok],
          [<Lk onClick={() => c.det("bancos")}>Caixa</Lk>, "financial_banks", "soma de current_balance_cents das contas ativas. Só o Asaas tem saldo confirmado no provedor.", parcial],
          [<Lk onClick={() => c.det("mrr")}>MRR</Lk>, "company_recurring_charges", "cobranças mensais ativas. Não usa contract_value do cadastro (mistura anual e cadastros errados).", ok],
          [<Lk onClick={() => c.det("vendas")}>Vendas e receita vendida</Lk>, "crm_leads + crm_stages", "lead em estágio final won com closed_at no mês; valor = opportunity_value.", ok],
          [<Lk onClick={() => c.det("reunioes")}>Reuniões</Lk>, "crm_meeting_events", "scheduled, realized, no_show e out_of_icp por event_date. Quem agendou = credited_staff_id; closer = owner_staff_id.", ok],
          [<Lk onClick={() => c.det("leads")}>Leads</Lk>, "crm_leads + crm_pipelines", "created_at no mês. 'Funis que contam' = counts_lead_inflow. Prospecção B2B entra só no total.", ok],
          [<Lk onClick={() => c.det("campanhas")}>Gasto, CPL, CTR, CPC, CPM</Lk>, "crm_meta_ads_campaigns, crm_meta_ads_adsets, crm_meta_ads_ads", "conta do Meta Ads conectada no CRM (aba Tráfego Pago). Linhas diárias por campanha, conjunto e anúncio. O banco sincroniza sozinho de 2 em 2 horas (3 dias) e uma vez por dia (35 dias); o botão Atualizar agora força na hora.", ok],
          [<Lk onClick={() => c.det("meta_anuncios")}>Leads e vendas por campanha, conjunto e anúncio</Lk>, "crm_leads", "lead que guardou meta_campaign_id, meta_adset_id e meta_ad_id. Lead pago que entrou sem esses campos não aparece por campanha.", parcial],
          ["Saldo da conta pré-paga do Meta", "Meta Ads", "o saldo da conta de anúncios não vem pro painel. A sincronização só traz gasto e resultado; saldo se confere no gerenciador da Meta.", sem],
          ["ROAS", "cálculo", "receita de leads pagos (meta_campaign_id, meta_lead_id ou utm de Facebook/Instagram) dividida pelo gasto.", parcial],
          ["CAC", "cálculo", "gasto Meta dividido pelas vendas do mês. Sem discador, sem folha do comercial.", parcial],
          ["Custo do discador", "dialer_ledger", "não existe lançamento pra UNV (só 2 ajustes de outros tenants).", sem],
          [<Lk onClick={() => c.det("clientes", { tipo: "ativos" })}>Clientes ativos</Lk>, "onboarding_companies", "status active, sem simulador. Consultor = consultant_id.", ok],
          [<Lk onClick={() => c.det("clientes", { tipo: "churn" })}>Churn</Lk>, "onboarding_projects", "churn_date no mês em projeto closed ou completed. Valor = contract_value da empresa.", ok],
          [<Lk onClick={() => c.det("clientes", { tipo: "vencendo" })}>Contratos vencendo</Lk>, "onboarding_companies", "renewal_plan_type diferente de mensal e contract_end_date nos próximos 30 dias. Mensal renova sozinho.", ok],
          ["Taxa de renovação", "onboarding_companies.renewed_at", "campo vazio em todas as empresas; o fluxo de renovação nunca foi registrado.", sem],
          [<Lk onClick={() => c.det("clientes", { tipo: "health_baixo" })}>Health score</Lk>, "client_health_scores", "último score por projeto ativo.", ok],
          [<Lk onClick={() => c.det("nps")}>NPS</Lk>, "onboarding_nps_responses", "média das respostas do mês. Detrator = 6 ou menos.", ok],
          [<Lk onClick={() => c.det("csat")}>CSAT</Lk>, "csat_responses", "média das notas (1 a 5) respondidas no mês.", ok],
          [<Lk onClick={() => c.det("tarefas_atrasadas")}>Tarefas atrasadas</Lk>, "onboarding_tasks", "pending ou in_progress com due_date antes de hoje, em projeto e empresa ativos.", ok],
          [<Lk onClick={() => c.det("checkup")}>Checkup</Lk>, "produto_checkup_itens", "itens do dia sem tratado_em.", ok],
          [<Lk onClick={() => c.det("conversas")}>Atendimento</Lk>, "crm_whatsapp_messages e conversations", "mensagens por created_at; esperando = conversa aberta com última mensagem inbound (estado de agora).", ok],
          [<Lk onClick={() => c.det("ia_dia")}>Custo de IA</Lk>, "ai_usage_daily + ai_usage_config", "custo estimado por tokens; teto_usd é diário. Dólar salvo na config.", ok],
          [<Lk onClick={() => c.det("wa_numeros")}>WhatsApp oficial</Lk>, "crm_whatsapp_messages + whatsapp_official_instances", "mensagens outbound de instância oficial x preço por mensagem (config ou tarifa UTILITY, senão R$ 0,04).", parcial],
          [<Lk onClick={() => c.det("agente_runs")}>Agentes de IA</Lk>, "crm_ai_agent_runs", "execuções por created_at; enviadas = outcome começa com sent; follow-up = mode followup.", ok],
          [<Lk onClick={() => c.det("automacoes")}>Automações</Lk>, "crm_automations, automation_rules, crm_automation_runs, automation_executions", "ativas e execuções no mês.", ok],
          [<Lk onClick={() => c.det("cobrancas")}>Cobranças automáticas</Lk>, "billing_notification_logs", "mensagens da régua por sent_at.", ok],
          [<Lk onClick={() => c.det("wa_templates")}>Disparos</Lk>, "whatsapp_official_campaigns", "campanhas com status done criadas no mês; total = envios.", ok],
          [<Lk onClick={() => c.det("lembretes")}>Lembretes de reunião</Lk>, "crm_meeting_reminder_runs", "envios no mês, sem erro. Zero até agora.", parcial],
          [<Lk onClick={() => c.det("equipe")}>Equipe</Lk>, "onboarding_staff", "ativos da UNV por papel.", ok],
          ["Margem de contribuição, DRE por competência, retirada do dono", "financial_*", "não estruturado por categoria: quase todas as contas pagas estão sem categoria.", sem],
        ]} />
      </Panel>
      <Panel titulo="Regras fixas" sub="pra não confundir">
        <div className="note" style={{ border: 0, paddingTop: 0 }}>
          Mês = calendário de Brasília. Série de barras = últimos 12 meses terminando no mês atual; clicar numa barra troca o mês do painel inteiro. Alertas de "Exige sua decisão" olham o estado de hoje (vencidas, saldo, conversas paradas, health), não o mês escolhido. Onde aparece "-", não existe registro na fonte; zero só aparece quando a fonte existe e o valor é zero mesmo. Toda lista de detalhe traz no máximo 500 linhas, com o total contado no banco.
        </div>
      </Panel>
    </>
  );
}
