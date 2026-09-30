// Tipos do payload da RPC painel_controle. Campos numéricos podem vir null
// quando não existe fonte (a tela mostra "-" e "sem fonte").

export type Alerta = { area: string; gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; link: string; view: string };

export type MesSerie = {
  mes: string; recebido: number | null; recebido_n: number; pago: number | null; lucro: number | null;
  vendas: number | null; receita: number | null; leads: number | null; leads_inflow: number | null;
  agendadas: number | null; realizadas: number | null; no_show: number | null;
  spend: number | null; leads_meta: number | null; custo_ia: number | null; churn: number; novos: number; agente_msgs: number | null;
};

export type Painel = {
  mes: string; hoje: string; gerado_em: string;
  financeiro: {
    recebido: number; recebido_n: number; a_receber: number; a_receber_n: number; vencidas: number; vencidas_n: number;
    vencidas_7d: number; vencidas_7d_n: number; pago: number; pago_n: number; a_pagar: number; a_pagar_n: number;
    a_pagar_3d: number; a_pagar_3d_n: number; a_pagar_7d: number; saldo_bancos: number; lucro: number;
    bancos: { nome: string; saldo: number; saldo_provedor: number | null; atualizado_em: string | null }[];
    mrr: number; mrr_n: number; mrr_em_aviso: number;
    vencidas_lista: { empresa: string; company_id: string; valor: number; vencimento: string; dias: number; descricao: string }[];
    a_pagar_lista: { fornecedor: string; descricao: string; valor: number; vencimento: string; status: string }[];
    recebido_por_empresa: { empresa: string; company_id: string; valor: number; n: number }[];
    pago_por_categoria: { categoria: string; valor: number; n: number }[];
  };
  comercial: {
    leads: number; leads_inflow: number; agendadas: number; realizadas: number; no_show: number; fora_icp: number;
    vendas: number; receita: number; ticket: number | null; conv_reuniao_venda: number | null; presenca: number | null; ganhos_sem_valor: number;
    por_closer: { id: string; nome: string; papel: string; realizadas: number; no_show: number; vendas: number; receita: number }[];
    por_sdr: { id: string; nome: string; papel: string; agendadas: number; realizadas: number; no_show: number; fora_icp: number; vendas: number }[];
    por_funil: { id: string; nome: string; conta_entrada: boolean; leads: number; agendadas: number; realizadas: number; no_show: number; vendas: number; receita: number }[];
    vendas_lista: { lead_id: string; nome: string; empresa: string | null; valor: number; data: string; closer: string | null; sdr: string | null; funil: string | null; origem: string | null; pago: boolean }[];
    reunioes_lista: { lead_id: string; nome: string | null; empresa: string | null; tipo: string; data: string; sdr: string | null; closer: string | null; funil: string | null }[];
  };
  trafego: {
    spend: number; tem_dados: boolean; impressoes: number; cliques: number; leads_meta: number; leads_pagos_crm: number;
    vendas_leads_pagos: number; receita_leads_pagos: number; custo_discador: number | null; cpl: number | null; roas: number | null;
    cac: number | null; custo_reuniao_agendada: number | null; custo_reuniao_realizada: number | null;
    campanhas: { nome: string; campaign_id: string; spend: number; leads: number; impressoes: number; cliques: number; status: string }[];
  };
  clientes: {
    ativas: number; em_aviso: number; novos: number; churn_n: number; churn_valor: number; vencendo_30d_n: number;
    novos_lista: { empresa: string; company_id: string; valor: number | null; inicio: string; plano: string | null }[];
    churn_lista: { empresa: string; company_id: string; valor: number | null; data: string; motivo: string | null }[];
    vencendo_30d: { empresa: string; company_id: string; fim: string; plano: string; valor: number | null; dias: number }[];
    health: { media: number | null; n: number; excellent: number; healthy: number; attention: number; at_risk: number; critical: number };
    health_baixo: { empresa: string; company_id: string; score: number; nivel: string; tendencia: string | null; consultor: string | null }[];
    nps: number | null; nps_n: number; nps_baixo_n: number; csat: number | null; csat_n: number;
    tarefas_atrasadas: number;
    tarefas_por_responsavel: { staff_id: string | null; nome: string; n: number; empresas: number }[];
    checkup_pendentes: number; checkup_por_bloco: { bloco: string; n: number }[];
    por_consultor: { staff_id: string; nome: string; papel: string; empresas: number; health_media: number | null; criticas: number; tarefas_atrasadas: number; em_aviso: number; mensalidades: number }[];
  };
  atendimento: {
    conversas: number; recebidas: number; enviadas: number; enviadas_ia: number; esperando: number; esperando_24h: number;
    esperando_lista: { conversation_id: string; lead_id: string | null; nome: string | null; desde: string; horas: number; atendente: string | null; ultima: string | null }[];
    por_atendente: { nome: string; esperando: number; mais_24h: number }[];
  };
  ia: {
    custo_usd: number; teto_dia_usd: number | null; custo_hoje_usd: number; teto_mes_usd: number | null; pct_teto_mes: number | null; pct_teto_hoje: number | null;
    dolar: number | null; custo_brl: number | null; chamadas: number; wa_msgs: number; wa_custo: number; wa_teto: number | null;
    agentes_ativos: number; runs: number; runs_enviadas: number; runs_auto: number; runs_followup: number; runs_opt_out: number;
    por_agente: { nome: string; ativo: boolean; runs: number; enviadas: number; followups: number; opt_out: number }[];
    por_fn: { nome: string; custo: number; chamadas: number }[];
    automacoes_ativas: number; automacoes_runs: number;
  };
  roda_sozinho: {
    agente_respostas: number; agente_followups: number; cobrancas: number; lembretes_reuniao: number; automacoes_crm: number; disparos: number;
    leads_formulario_meta: number; leads_sem_criador: number; followups_personalizados: number; atividades_automaticas: number; mensagens_ia: number;
  };
  equipe: { papel: string; n: number }[];
  alertas: Alerta[];
  serie: MesSerie[];
};

export type Filtro = Record<string, string | boolean | undefined>;

/** Uma tela na pilha de navegação. */
export type Nav = {
  view: "visao" | "financeiro" | "comercial" | "trafego" | "clientes" | "atendimento" | "ia" | "automacoes" | "fontes" | "detalhe";
  titulo?: string;
  /** filtros da tela de área (funil, closer, sdr, consultor) */
  f?: Filtro;
  /** tela de detalhe: qual bloco da RPC de detalhe e com que filtro */
  bloco?: string;
  filtro?: Filtro;
  sub?: string;
};

export type Detalhe = { bloco: string; mes: string; total: number; soma?: number | null; media?: number | null; limite: number; linhas: Record<string, any>[] };
