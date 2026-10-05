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
          [<Lk onClick={() => c.go({ view: "caixa" })}>Projeção de caixa (13 semanas)</Lk>, "financial_banks, company_invoices, financial_payables", "saldo dos bancos + faturas em aberto pelo vencimento, menos contas a pagar em aberto pelo vencimento, dia a dia por 91 dias. Recorrência não se soma por cima: ela já nasce com as parcelas geradas como fatura. Vencido há até 30 dias entra hoje; há mais de 30 dias fica fora (tem chave na tela). Venda nova não entra.", ok],
          ["Cenário realista do caixa", "company_invoices (histórico)", "fatura a vencer vale valor x taxa de recebimento (valor das faturas dos últimos 3 meses pago até 7 dias depois do vencimento) e chega no vencimento + atraso médio. Empresa inativa ou vencimento depois do fim do aviso: fora. Vencida há 8 a 90 dias vale valor x taxa de recuperação (quanto das que passaram de 7 dias de atraso foi pago). Mais de 90 dias: fora. Saída é igual nos dois cenários.", parcial],
          ["Recebíveis antigos (financial_receivables)", "financial_receivables", "legado importado, vencidos de 2024 a jan/2026 e sem empresa ligada. Não são as faturas dos clientes e ficam fora da projeção; o total aparece na tela do caixa.", sem],
          [<Lk onClick={() => c.go({ view: "fundador" })}>Dependência do fundador</Lk>, "crm_leads + crm_stages, crm_meeting_events", "parte da receita e das vendas do mês fechada pelo staff master. Quem fechou = closer_staff_id do lead ganho; se vazio, owner_staff_id. Venda sem os dois (checkout do site) fica em 'sem fechador' e conta no total. Reunião por ele = evento realized cujo dono do lead é ele (ou quem foi creditado, se o dono está vazio).", ok],
          [<Lk onClick={() => c.det("mrr_clientes", { grupo: "base" }, "Mensalidade por cliente")}>Concentração da carteira</Lk>, "company_recurring_charges + company_invoices", "mensalidade por cliente: cobrança ativa, de empresa ativa e com fatura a vencer. Cobrança ativa que não fatura mais fica fora e aparece separada; o MRR do topo ainda conta essas, por isso os dois totais diferem.", parcial],
          [<Lk onClick={() => c.go({ view: "antecedentes" })}>Reuniões na agenda</Lk>, "crm_activities", "atividade tipo reunião, não cancelada, pela data marcada: próximos 7 e 14 dias contra a média semanal dos últimos 28 dias. crm_meeting_events não serve pra isso: guarda quando o evento foi registrado, não a data da reunião.", ok],
          [<Lk onClick={() => c.det("pipeline_aberto", { grupo: "vivo" }, "Pipeline aberto")}>Pipeline aberto e ponderado</Lk>, "crm_leads, crm_stages, crm_lead_history", "lead fora de etapa final, com valor e com movimento nos últimos 90 dias. Ponderado = valor x conversão histórica da etapa (dos leads que entraram nela nos últimos 180 dias, quantos estão ganhos). Usa a taxa da etapa no funil com 15 entradas ou mais; senão a da etapa em todos os funis; senão 5% fixo. O campo de probabilidade do lead está vazio em todos e não é usado.", parcial],
          ["Cobertura do pipeline", "crm_goal_values (tipo Vendas)", "ponderado dividido pelo que falta da meta de vendas do mês corrente (meta de staff ativo que não é head, menos o já vendido no mês por todos). Quem vende e não tem meta cadastrada aparece nominalmente na tela.", parcial],
          [<Lk onClick={() => c.det("leads_atencao", { tipo: "sem_atividade" }, "Leads sem primeira atividade")}>Leads novos, sem dono e sem primeira atividade</Lk>, "crm_leads, crm_activities, crm_lead_history, crm_whatsapp_conversations", "funis que contam entrada. Novos: últimos 7 dias contra a média das 4 semanas anteriores. Sem dono e sem atividade: criados nos últimos 14 dias e ainda abertos. Sem atividade = sem atividade registrada, sem mudança de etapa feita por pessoa e sem mensagem enviada na conversa do lead.", ok],
          [<Lk onClick={() => c.det("mrr")}>MRR</Lk>, "company_recurring_charges", "cobranças mensais ativas. Não usa contract_value do cadastro (mistura anual e cadastros errados).", ok],
          [<Lk onClick={() => c.det("vendas")}>Vendas e receita vendida</Lk>, "crm_leads + crm_stages", "lead em estágio final won com closed_at no mês; valor = opportunity_value.", ok],
          [<Lk onClick={() => c.det("reunioes")}>Reuniões</Lk>, "crm_meeting_events", "scheduled, realized, no_show e out_of_icp por event_date. Quem agendou = credited_staff_id; closer = owner_staff_id.", ok],
          [<Lk onClick={() => c.det("leads")}>Leads</Lk>, "crm_leads + crm_pipelines", "created_at no mês. 'Funis que contam' = counts_lead_inflow. Prospecção B2B entra só no total.", ok],
          [<Lk onClick={() => c.det("campanhas")}>Gasto, CPL, CTR, CPC, CPM</Lk>, "crm_meta_ads_campaigns, crm_meta_ads_adsets, crm_meta_ads_ads", "conta do Meta Ads conectada no CRM (aba Tráfego Pago). Linhas diárias por campanha, conjunto e anúncio. O banco sincroniza sozinho de 2 em 2 horas (3 dias) e uma vez por dia (35 dias); o botão Atualizar agora força na hora.", ok],
          [<Lk onClick={() => c.det("meta_anuncios")}>Leads e vendas por campanha, conjunto e anúncio</Lk>, "crm_leads", "lead que guardou meta_campaign_id, meta_adset_id e meta_ad_id. Lead pago que entrou sem esses campos não aparece por campanha.", parcial],
          [<Lk onClick={() => c.go({ view: "trafego" })}>Saldo no Meta, situação da conta e forma de pagamento</Lk>, "crm_meta_ads_accounts", "a edge crm-meta-ads-balance pergunta pra Meta de hora em hora e grava saldo disponível, se a conta é pré-paga, a média de gasto por dia (últimos 7 dias com entrega) e o nível (ok, baixo, crítico, zerado). Dias de saldo = saldo dividido pela média. O botão Atualizar agora confere na hora.", ok],
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
