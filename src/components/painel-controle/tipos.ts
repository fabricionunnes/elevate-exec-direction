// Tipos do payload da RPC painel_controle. Campos numéricos podem vir null
// quando não existe fonte (a tela mostra "-" e "sem fonte").

export type Alerta = { area: string; gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; link: string; view: string };

export type MesSerie = {
  mes: string; recebido: number | null; recebido_n: number; pago: number | null; lucro: number | null;
  vendas: number | null; receita: number | null; leads: number | null; leads_inflow: number | null;
  agendadas: number | null; realizadas: number | null; no_show: number | null;
  spend: number | null; leads_meta: number | null; custo_ia: number | null; churn: number; novos: number; agente_msgs: number | null;
};

type ForaItem = { n: number; valor: number };
type CenarioCaixa = { em30: number; em60: number; em90: number; primeiro_negativo: string | null; pior_valor: number; pior_data: string; entra: number; sai: number };

/** Projeção de caixa de 13 semanas (função painel_caixa_interno). */
export type Caixa = {
  hoje: string; saldo_inicial: number; bancos_n: number;
  taxas: {
    janela_de: string; janela_ate: string; amostra_n: number; amostra_valor: number; pago_7d_valor: number;
    taxa_7d: number | null; atraso_medio_dias: number | null;
    recuperacao_n: number; recuperacao_valor: number; recuperado_valor: number; taxa_recuperacao: number | null; dias_recuperacao: number | null;
  };
  historico: { de: string; ate: string; recebido_mes: number; pago_mes: number; faturado_30d: number; a_pagar_30d: number };
  cenarios: { contratado: CenarioCaixa; realista: CenarioCaixa };
  semanas: { n: number; de: string; ate: string; entra_c: number; entra_r: number; sai: number; saldo_c: number; saldo_r: number; min_c: number; min_r: number; n_entradas: number; n_entradas_r: number; n_saidas: number }[];
  dias: { d: string; c: number; r: number }[];
  fora: { pagar_antigas: ForaItem; receber_antigas: ForaItem; pagar_recentes: ForaItem; receber_recentes: ForaItem; fora_do_realista: ForaItem; renovacoes: ForaItem; recebiveis_legado: ForaItem };
};

/** Blocos "pra frente": o que ainda dá pra mudar. Cada bloco novo entra aqui. */
type MesFundador = {
  mes: string; vendas: number | null; receita: number | null; vendas_fundador: number | null; receita_fundador: number | null;
  vendas_time: number | null; receita_time: number | null; vendas_sem_fechador: number | null; receita_sem_fechador: number | null;
  pct_receita: number | null; pct_vendas: number | null; reunioes: number | null; reunioes_fundador: number | null; pct_reunioes: number | null;
};

export type Frente = {
  caixa?: Caixa;
  /** quanto da receita nova passa pela mão do dono */
  fundador?: {
    staff_id: string; nome: string; mes: MesFundador; pct_receita: number | null; pct_receita_anterior: number | null; delta_pp: number | null;
    nivel: "verde" | "ambar" | "vermelho" | null;
    por_fechador: { id: string | null; nome: string; papel: string | null; grupo: "fundador" | "time" | "sem_fechador"; vendas: number; receita: number }[];
    serie: MesFundador[];
  };
  /** quanto das mensalidades está em poucos clientes */
  concentracao?: {
    mrr_base: number; clientes: number; mrr_todas_ativas: number; fora_valor: number; fora_n: number;
    maior: { empresa: string; company_id: string; valor: number; pct: number } | null; top5_valor: number; top5_pct: number | null;
    top10: { pos: number; company_id: string; empresa: string; valor: number; pct: number; cobrancas: number; parcelas_ate: string | null; contrato_fim: string | null; plano: string | null; consultor: string | null }[];
  };
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
    /** estado da conexão do Meta Ads (conta do CRM) */
    meta: {
      conectada: boolean; conta: string | null; ad_account_id: string | null; account_row_id: string | null;
      ultimo_sync: string | null; horas_desde_sync: number | null; ultimo_dia_com_gasto: string | null; dias_sem_gasto: number | null;
      /** saldo da conta de anúncios, conferido de hora em hora. null = nunca conferido */
      situacao: string | null; pre_paga: boolean | null; saldo: number | null; devido: number | null; forma_pagamento: string | null;
      media_dia: number | null; dias_de_saldo: number | null; saldo_conferido_em: string | null; saldo_erro: string | null;
      nivel_saldo: "ok" | "baixo" | "critico" | "zerado" | null;
    };
    por_dia: { dia: string; spend: number; leads: number; impressoes: number; cliques: number; campanhas: number }[];
    campanhas: {
      nome: string; campaign_id: string; spend: number; leads: number; impressoes: number; cliques: number; status: string;
      objetivo: string | null; dias: number; leads_crm: number; vendas_crm: number; receita_crm: number;
    }[];
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
  frente?: Frente;
};

export type Filtro = Record<string, string | boolean | undefined>;

/** Uma tela na pilha de navegação. */
export type Nav = {
  view: "visao" | "financeiro" | "comercial" | "trafego" | "clientes" | "atendimento" | "ia" | "automacoes" | "fontes" | "detalhe" | "caixa" | "fundador";
  titulo?: string;
  /** filtros da tela de área (funil, closer, sdr, consultor) */
  f?: Filtro;
  /** tela de detalhe: qual bloco da RPC de detalhe e com que filtro */
  bloco?: string;
  filtro?: Filtro;
  sub?: string;
};

export type Detalhe = { bloco: string; mes: string; total: number; soma?: number | null; media?: number | null; limite: number; linhas: Record<string, any>[] };
