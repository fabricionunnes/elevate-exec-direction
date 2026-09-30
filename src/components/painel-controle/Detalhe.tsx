// Tela de detalhe: chama painel_controle_detalhe(bloco, filtro) e lista os
// registros individuais. Cada linha com id abre o registro de verdade no Nexus.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Combo, Lk, Nd, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, dataHoraBR, eventoLabel, fp, mesLabel, nivelLabel, num, papelLabel, projetoLabel, tendLabel, usd } from "./fmt";
import { LINK, esc, soma } from "./util";
import type { Detalhe as DetalheT, Filtro } from "./tipos";

type Tipo = "brl" | "brlfull" | "usd" | "num" | "int" | "data" | "datahora" | "pct" | "txt" | "nivel" | "evento" | "papel" | "proj" | "bool" | "dias" | "horas" | "tend";
type ColSpec = { h: string; k: string; t?: Tipo; link?: "lead" | "empresa" | "conversa"; tl?: boolean; idk?: string };
type Spec = { titulo: string; sub: string; cols: ColSpec[]; resumo?: (d: DetalheT) => { label: string; valor: string; sub?: string }[]; nexus?: string };

const S = (titulo: string, sub: string, cols: ColSpec[], extra?: Partial<Spec>): Spec => ({ titulo, sub, cols, ...extra });

const SPECS: Record<string, Spec> = {
  faturas_pagas: S("Faturas pagas", "Mensalidades de clientes com pagamento confirmado no mês (paid_at).", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Valor líquido", k: "valor", t: "brlfull" },
    { h: "Valor da fatura", k: "valor_fatura", t: "brlfull" }, { h: "Pago em", k: "data", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Forma", k: "forma" }, { h: "Banco", k: "banco" }, { h: "Parcela", k: "parcela" },
  ], { resumo: (d) => [{ label: "Faturas", valor: num(d.total, 0) }, { label: "Recebido", valor: brl(d.soma) }, { label: "Ticket médio", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }], nexus: LINK.financeiro }),
  faturas_vencidas: S("Faturas vencidas", "Sem pagamento, vencimento antes de hoje. Fatura paga nunca aparece aqui.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" },
    { h: "Dias", k: "dias", t: "dias" }, { h: "Consultor", k: "consultor" }, { h: "Cobranças", k: "contatos", t: "int" }, { h: "Último contato", k: "ultimo_contato", t: "datahora" }, { h: "Situação", k: "status" },
  ], { resumo: (d) => [{ label: "Faturas", valor: num(d.total, 0) }, { label: "Total vencido", valor: brl(d.soma) }, { label: "Mais de 30 dias", valor: brl(soma(d.linhas.filter((l) => l.dias > 30), (l) => l.valor)) }], nexus: LINK.financeiro }),
  faturas_a_receber: S("A receber no mês", "Faturas em aberto com vencimento dentro do mês.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Em dias", k: "dias", t: "int" }, { h: "Forma", k: "forma" }, { h: "Consultor", k: "consultor" }, { h: "Situação", k: "status" },
  ], { resumo: (d) => [{ label: "Faturas", valor: num(d.total, 0) }, { label: "A receber", valor: brl(d.soma) }], nexus: LINK.financeiro }),
  contas_pagas: S("Contas pagas", "Contas a pagar quitadas no mês (paid_date).", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Forma", k: "forma" }, { h: "Banco", k: "banco" }, { h: "Tipo", k: "tipo_custo" },
  ], { resumo: (d) => [{ label: "Contas", valor: num(d.total, 0) }, { label: "Pago", valor: brl(d.soma) }], nexus: LINK.financeiro }),
  contas_a_pagar: S("Contas a pagar", "Em aberto: atrasadas, do mês e dos próximos 7 dias.", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Em dias", k: "dias", t: "int" }, { h: "Situação", k: "status" }, { h: "Recorrente", k: "recorrente", t: "bool" },
  ], { resumo: (d) => [{ label: "Contas", valor: num(d.total, 0) }, { label: "Total", valor: brl(d.soma) }, { label: "Atrasadas", valor: brl(soma(d.linhas.filter((l) => l.dias < 0), (l) => l.valor)) }, { label: "Próximos 7 dias", valor: brl(soma(d.linhas.filter((l) => l.dias >= 0 && l.dias <= 7), (l) => l.valor)) }], nexus: LINK.financeiro }),
  bancos: S("Saldo por banco", "Saldo do Nexus e, quando o provedor informa, o saldo lá (Asaas).", [
    { h: "Banco", k: "nome", tl: true }, { h: "Saldo no Nexus", k: "saldo", t: "brlfull" }, { h: "Saldo no provedor", k: "saldo_provedor", t: "brlfull" }, { h: "Atualizado", k: "atualizado_em", t: "datahora" }, { h: "Movimento no mês", k: "movimento_mes", t: "brlfull" }, { h: "Lançamentos", k: "lancamentos_mes", t: "int" }, { h: "Erro", k: "erro", tl: true },
  ], { resumo: (d) => [{ label: "Bancos", valor: num(d.total, 0) }, { label: "Saldo total", valor: brl(d.soma) }], nexus: LINK.financeiro }),
  mrr: S("MRR por cliente", "Cobranças recorrentes mensais ativas.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Mensalidade", k: "valor", t: "brlfull" }, { h: "Próxima cobrança", k: "proxima_cobranca", t: "data" }, { h: "Forma", k: "forma" }, { h: "Consultor", k: "consultor" }, { h: "Início", k: "inicio", t: "data" }, { h: "Projeto", k: "projeto_status", t: "proj" },
  ], { resumo: (d) => [{ label: "Clientes", valor: num(d.total, 0) }, { label: "MRR", valor: brl(d.soma) }, { label: "Mensalidade média", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }], nexus: LINK.recorrencias }),
  vendas: S("Vendas", "Leads em estágio ganho com fechamento no mês.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Data", k: "data", t: "data" }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" }, { h: "Funil", k: "funil" }, { h: "Origem", k: "origem" }, { h: "Pago", k: "pago", t: "bool" }, { h: "Produto", k: "produto", tl: true },
  ], { resumo: (d) => [{ label: "Vendas", valor: num(d.total, 0) }, { label: "Receita vendida", valor: brl(d.soma) }, { label: "Ticket médio", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }, { label: "Sem valor", valor: num(d.linhas.filter((l) => !l.valor).length, 0), sub: "cadastro incompleto" }], nexus: LINK.leads }),
  reunioes: S("Reuniões", "Eventos de reunião do CRM no mês.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Evento", k: "tipo", t: "evento" }, { h: "Data", k: "data", t: "datahora" }, { h: "SDR", k: "sdr" }, { h: "Closer", k: "closer" }, { h: "Funil", k: "funil" }, { h: "Etapa atual", k: "etapa_atual" }, { h: "Desfecho", k: "desfecho" }, { h: "Valor", k: "valor", t: "brl" },
  ], { resumo: (d) => [{ label: "Eventos", valor: num(d.total, 0) }, { label: "Realizadas", valor: num(d.linhas.filter((l) => String(l.tipo).startsWith("realized")).length, 0) }, { label: "No-show", valor: num(d.linhas.filter((l) => l.tipo === "no_show").length, 0) }, { label: "Viraram venda", valor: num(d.linhas.filter((l) => l.desfecho === "won").length, 0) }], nexus: LINK.reunioes }),
  leads: S("Leads do mês", "Leads criados no mês, com etapa atual e tempo parado.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Origem", k: "origem" }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Parado há", k: "dias_parado", t: "dias" }, { h: "Valor", k: "valor", t: "brl" }, { h: "Campanha", k: "campanha", tl: true },
  ], { resumo: (d) => [{ label: "Leads", valor: num(d.total, 0), sub: d.total > d.limite ? `mostrando ${d.limite}` : undefined }, { label: "Ganhos", valor: num(d.linhas.filter((l) => l.desfecho === "won").length, 0) }, { label: "Perdidos", valor: num(d.linhas.filter((l) => l.desfecho === "lost").length, 0) }, { label: "Parados +7 dias", valor: num(d.linhas.filter((l) => !l.desfecho && l.dias_parado > 7).length, 0) }], nexus: LINK.leads }),
  campanhas: S("Campanhas", "Gasto e leads da Meta por campanha, mais o que virou lead e venda no CRM.", [
    { h: "Campanha", k: "nome", tl: true }, { h: "Status", k: "status" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "Dias", k: "dias", t: "int" },
  ], { resumo: (d) => [{ label: "Campanhas", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "Receita no CRM", valor: brl(soma(d.linhas, (l) => l.receita_crm)) }], nexus: LINK.trafego }),
  campanhas_dia: S("Tráfego por dia", "Uma linha por campanha por dia.", [
    { h: "Data", k: "data", t: "data" }, { h: "Campanha", k: "campanha", tl: true }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Leads", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "Status", k: "status" },
  ], { resumo: (d) => [{ label: "Linhas", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads", valor: num(soma(d.linhas, (l) => l.leads), 0) }], nexus: LINK.trafego }),
  clientes: S("Clientes", "Empresas com consultor, mensalidade, contrato, health score e NPS.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Consultor", k: "consultor" }, { h: "Mensalidade", k: "mensalidade", t: "brlfull" }, { h: "Produto", k: "produto", tl: true }, { h: "Projeto", k: "projeto_status", t: "proj" }, { h: "Início", k: "inicio", t: "data" }, { h: "Fim", k: "fim", t: "data" }, { h: "Plano", k: "plano" },
    { h: "Health", k: "score", t: "num" }, { h: "Nível", k: "nivel", t: "nivel" }, { h: "Tendência", k: "tendencia", t: "tend" }, { h: "NPS", k: "nps", t: "int" }, { h: "Tarefas atrasadas", k: "tarefas_atrasadas", t: "int" }, { h: "Vencido", k: "vencido", t: "brl" }, { h: "Churn em", k: "churn_em", t: "data" }, { h: "Motivo", k: "churn_motivo", tl: true },
  ], { resumo: (d) => [{ label: "Empresas", valor: num(d.total, 0) }, { label: "Mensalidades", valor: brl(d.soma) }, { label: "Health médio", valor: num(d.linhas.length ? soma(d.linhas, (l) => l.score) / d.linhas.filter((l) => l.score != null).length : null) }, { label: "Com vencido", valor: num(d.linhas.filter((l) => l.vencido > 0).length, 0) }], nexus: LINK.empresas }),
  tarefas_atrasadas: S("Tarefas atrasadas", "Tarefas pendentes ou em andamento com prazo vencido, em clientes ativos.", [
    { h: "Tarefa", k: "titulo", tl: true }, { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Responsável", k: "responsavel" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Atraso", k: "dias", t: "dias" }, { h: "Prioridade", k: "prioridade" }, { h: "Situação", k: "status" },
  ], { resumo: (d) => [{ label: "Tarefas", valor: num(d.total, 0) }, { label: "Mais de 30 dias", valor: num(d.linhas.filter((l) => l.dias > 30).length, 0) }, { label: "Empresas", valor: num(new Set(d.linhas.map((l) => l.company_id)).size, 0) }], nexus: LINK.tarefas }),
  nps: S("NPS do mês", "Respostas de NPS dos clientes.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Nota", k: "nota", t: "int" }, { h: "Data", k: "data", t: "data" }, { h: "Quem", k: "respondente" }, { h: "Consultor", k: "consultor" }, { h: "O que melhorar", k: "melhorar", tl: true }, { h: "Comentário", k: "feedback", tl: true },
  ], { resumo: (d) => [{ label: "Respostas", valor: num(d.total, 0) }, { label: "Média", valor: num(d.media) }, { label: "Detratores (0 a 6)", valor: num(d.linhas.filter((l) => l.nota <= 6).length, 0) }, { label: "Promotores (9 e 10)", valor: num(d.linhas.filter((l) => l.nota >= 9).length, 0) }] }),
  csat: S("CSAT do mês", "Notas de satisfação por reunião (1 a 5).", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Nota", k: "nota", t: "int" }, { h: "Data", k: "data", t: "data" }, { h: "Quem", k: "respondente" }, { h: "Consultor", k: "consultor" }, { h: "Comentário", k: "feedback", tl: true },
  ], { resumo: (d) => [{ label: "Respostas", valor: num(d.total, 0) }, { label: "Média", valor: num(d.media) }, { label: "Nota 3 ou menos", valor: num(d.linhas.filter((l) => l.nota <= 3).length, 0) }] }),
  checkup: S("Checkup do produto, hoje", "Itens do checkup diário: pendentes primeiro.", [
    { h: "Bloco", k: "bloco" }, { h: "Item", k: "titulo", tl: true }, { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Responsável", k: "responsavel" }, { h: "Tratado em", k: "tratado_em", t: "datahora" }, { h: "Nota", k: "nota", tl: true },
  ], { resumo: (d) => [{ label: "Pendentes", valor: num(d.total, 0) }, { label: "Itens no dia", valor: num(d.linhas.length, 0) }], nexus: LINK.checkup }),
  conversas_esperando: S("Conversas esperando resposta", "Última mensagem foi do cliente ou lead e ninguém respondeu.", [
    { h: "Contato", k: "nome", link: "conversa", idk: "conversation_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Esperando há", k: "horas", t: "horas" }, { h: "Desde", k: "desde", t: "datahora" }, { h: "Atendente", k: "atendente" }, { h: "Número", k: "instancia" }, { h: "Funil", k: "funil" }, { h: "Última mensagem", k: "ultima", tl: true },
  ], { resumo: (d) => [{ label: "Conversas", valor: num(d.total, 0), sub: d.total > d.limite ? `mostrando ${d.limite}` : undefined }, { label: "Mais de 24 h", valor: num(d.linhas.filter((l) => l.horas >= 24).length, 0) }, { label: "Mais de 7 dias", valor: num(d.linhas.filter((l) => l.horas >= 168).length, 0) }, { label: "Sem atendente", valor: num(d.linhas.filter((l) => !l.atendente).length, 0) }], nexus: LINK.inbox }),
  conversas: S("Conversas do mês", "Conversas de WhatsApp com mensagem no mês.", [
    { h: "Contato", k: "nome", link: "conversa", idk: "conversation_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Última em", k: "ultima_em", t: "datahora" }, { h: "Direção", k: "direcao" }, { h: "Atendente", k: "atendente" }, { h: "Número", k: "instancia" }, { h: "Não lidas", k: "nao_lidas", t: "int" }, { h: "Última mensagem", k: "ultima", tl: true },
  ], { resumo: (d) => [{ label: "Conversas", valor: num(d.total, 0), sub: d.total > d.limite ? `mostrando ${d.limite} mais recentes` : undefined }], nexus: LINK.inbox }),
  ia_dia: S("Custo de IA por dia", "Estimativa em dólar a partir dos tokens medidos.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Custo", k: "custo", t: "usd" }, { h: "Chamadas", k: "chamadas", t: "int" }, { h: "Tokens entrada", k: "entrada", t: "int" }, { h: "Tokens saída", k: "saida", t: "int" }, { h: "Cache lido", k: "cache_lido", t: "int" }, { h: "Funções", k: "funcoes", tl: true },
  ], { resumo: (d) => [{ label: "Dias", valor: num(d.total, 0) }, { label: "Custo", valor: usd(d.soma) }, { label: "Pior dia", valor: usd(Math.max(0, ...d.linhas.map((l) => Number(l.custo) || 0))) }], nexus: LINK.custoIa }),
  agente_runs: S("Ações dos agentes de IA", "Cada execução de agente: resposta automática, follow-up ou resgate.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Agente", k: "agente", tl: true }, { h: "Lead", k: "lead", link: "conversa", idk: "conversation_id", tl: true }, { h: "Canal", k: "canal" }, { h: "Modo", k: "modo" }, { h: "Resultado", k: "outcome" }, { h: "Resposta", k: "resposta", tl: true },
  ], { resumo: (d) => [{ label: "Execuções", valor: num(d.total, 0), sub: d.total > d.limite ? `mostrando ${d.limite}` : undefined }, { label: "Enviadas", valor: num(d.linhas.filter((l) => String(l.outcome).startsWith("sent")).length, 0) }, { label: "Com erro", valor: num(d.linhas.filter((l) => l.erro).length, 0) }], nexus: LINK.agentes }),
  wa_numeros: S("WhatsApp oficial por número", "Mensagens enviadas pela API oficial e custo estimado pelo preço por mensagem.", [
    { h: "Número", k: "nome", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Status", k: "status" }, { h: "Mensagens", k: "msgs", t: "int" }, { h: "Pela IA", k: "msgs_ia", t: "int" }, { h: "Conversas", k: "conversas", t: "int" }, { h: "Preço", k: "preco", t: "brlfull" }, { h: "Custo", k: "custo", t: "brlfull" },
  ], { resumo: (d) => [{ label: "Números", valor: num(d.total, 0) }, { label: "Custo estimado", valor: brl(d.soma) }, { label: "Mensagens", valor: num(soma(d.linhas, (l) => l.msgs), 0) }], nexus: LINK.custoIa }),
  wa_templates: S("Disparos por template", "Campanhas da API oficial criadas no mês.", [
    { h: "Template", k: "template", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Envios", k: "total", t: "int" }, { h: "Status", k: "status" }, { h: "Criado", k: "data", t: "datahora" }, { h: "Terminou", k: "fim", t: "datahora" }, { h: "Por", k: "criado_por" }, { h: "Número", k: "numero" }, { h: "Prévia", k: "previa", tl: true },
  ], { resumo: (d) => [{ label: "Disparos", valor: num(d.total, 0) }, { label: "Envios", valor: num(d.soma, 0) }], nexus: LINK.disparos }),
  automacoes: S("Automações e agentes", "Tudo que roda sem passar por você, com execuções no mês.", [
    { h: "Nome", k: "nome", tl: true }, { h: "Tipo", k: "tipo" }, { h: "Gatilho", k: "gatilho", tl: true }, { h: "Ativa", k: "ativa", t: "bool" }, { h: "Execuções no mês", k: "runs_mes", t: "int" }, { h: "Total", k: "runs_total", t: "int" }, { h: "Última", k: "ultima_execucao", t: "datahora" },
  ], { resumo: (d) => [{ label: "Cadastradas", valor: num(d.total, 0) }, { label: "Ativas", valor: num(d.linhas.filter((l) => l.ativa).length, 0) }, { label: "Execuções no mês", valor: num(soma(d.linhas, (l) => l.runs_mes), 0) }], nexus: LINK.automacoes }),
  automacao_runs: S("Execuções de automação", "Automações do CRM e regras do Nexus que rodaram no mês.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Automação", k: "automacao", tl: true }, { h: "Tipo", k: "tipo" }, { h: "Lead", k: "lead", link: "lead", idk: "lead_id", tl: true }, { h: "Atribuído a", k: "atribuido" }, { h: "Resultado", k: "resultado", tl: true },
  ], { resumo: (d) => [{ label: "Execuções", valor: num(d.total, 0) }], nexus: LINK.automacoes }),
  cobrancas: S("Cobranças automáticas", "Mensagens da régua de cobrança enviadas no mês.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Quando", k: "data", t: "datahora" }, { h: "Status", k: "status" }, { h: "Fatura", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Fatura hoje", k: "fatura_status" }, { h: "Mensagem", k: "mensagem", tl: true },
  ], { resumo: (d) => [{ label: "Mensagens", valor: num(d.total, 0) }, { label: "Empresas", valor: num(new Set(d.linhas.map((l) => l.company_id)).size, 0) }, { label: "Faturas já pagas", valor: num(d.linhas.filter((l) => l.fatura_status === "paid").length, 0) }], nexus: LINK.financeiro }),
  lembretes: S("Lembretes de reunião", "Lembretes automáticos enviados ao lead antes da reunião.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Lead", k: "lead", link: "lead", idk: "lead_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Número", k: "instancia" }, { h: "Status", k: "status" }, { h: "Mensagem", k: "mensagem", tl: true }, { h: "Erro", k: "erro", tl: true },
  ], { resumo: (d) => [{ label: "Lembretes", valor: num(d.total, 0) }] }),
  equipe: S("Equipe", "Staff ativo da UNV.", [
    { h: "Nome", k: "nome", tl: true }, { h: "Papel", k: "papel", t: "papel" }, { h: "E-mail", k: "email", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Admissão", k: "admissao", t: "data" }, { h: "Closer", k: "closer", t: "bool" }, { h: "Clientes", k: "empresas", t: "int" }, { h: "Tarefas atrasadas", k: "tarefas_atrasadas", t: "int" }, { h: "Leads no mês", k: "leads_mes", t: "int" },
  ], { resumo: (d) => [{ label: "Pessoas", valor: num(d.total, 0) }], nexus: LINK.equipe }),
};

function cel(v: any, t?: Tipo): ReactNode {
  if (v == null || v === "") return <Nd />;
  switch (t) {
    case "brl": return brl(Number(v));
    case "brlfull": return brlFull(Number(v));
    case "usd": return usd(Number(v));
    case "num": return num(Number(v));
    case "int": return num(Number(v), 0);
    case "data": return dataBR(String(v));
    case "datahora": return dataHoraBR(String(v));
    case "pct": return fp(Number(v));
    case "nivel": return <St ok={v === "excellent" || v === "healthy"} warn={v === "attention"} tg={nivelLabel(v)} tw={nivelLabel(v)} tb={nivelLabel(v)} />;
    case "evento": return eventoLabel(String(v));
    case "papel": return papelLabel(String(v));
    case "proj": return String(v).split(", ").map(projetoLabel).join(", ");
    case "tend": return tendLabel(String(v));
    case "bool": return v ? "sim" : <Nd>não</Nd>;
    case "dias": return `${num(Number(v), 0)} ${Number(v) === 1 ? "dia" : "dias"}`;
    case "horas": { const h = Number(v); return h >= 48 ? `${Math.round(h / 24)} dias` : `${num(h, 0)} h`; }
    default: return String(v);
  }
}

export function Detalhe({ mes, bloco, filtro, titulo, sub }: { mes: string; bloco: string; filtro?: Filtro; titulo?: string; sub?: string }) {
  const [d, setD] = useState<DetalheT | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [colF, setColF] = useState("");
  const spec = SPECS[bloco];
  const filtroKey = JSON.stringify(filtro ?? {});

  useEffect(() => {
    let vivo = true;
    setD(null); setErro(null); setQ(""); setColF("");
    (async () => {
      const { data, error } = await (supabase as any).rpc("painel_controle_detalhe", { p_month: mes, p_bloco: bloco, p_filtro: filtro ?? {} });
      if (!vivo) return;
      if (error) { setErro(error.message); return; }
      setD(data as DetalheT);
    })();
    return () => { vivo = false; };
  }, [mes, bloco, filtroKey]);

  const linhas = useMemo(() => {
    if (!d) return [];
    const t = esc(q);
    return d.linhas.filter((l) => {
      if (colF && String(l[colF.split("=")[0]] ?? "") !== colF.split("=").slice(1).join("=")) return false;
      if (!t) return true;
      return Object.values(l).some((v) => v != null && esc(String(v)).includes(t));
    });
  }, [d, q, colF]);

  // opções de filtro rápido por coluna de texto (closer, sdr, funil, consultor, atendente, agente...)
  const colsFiltro = (spec?.cols ?? []).filter((c) => !c.t && !c.link && ["closer", "sdr", "funil", "consultor", "atendente", "agente", "responsavel", "categoria", "status", "origem", "tipo", "modo", "outcome", "canal", "dono", "etapa", "plano", "instancia", "numero", "bloco", "nivel", "papel", "forma", "banco", "campanha", "produto"].includes(c.k));
  const optsCol = useMemo(() => {
    if (!d) return [] as { value: string; label: string }[];
    const out: { value: string; label: string }[] = [];
    colsFiltro.forEach((c) => {
      const vals = [...new Set(d.linhas.map((l) => l[c.k]).filter((v) => v != null && v !== ""))].map(String).sort();
      if (vals.length > 1 && vals.length <= 60) vals.forEach((v) => out.push({ value: `${c.k}=${v}`, label: `${c.h}: ${v}` }));
    });
    return out;
  }, [d]);

  const abrir = (url: string) => window.open(url, "_blank", "noopener");

  if (!spec) return <div className="err">Bloco de detalhe desconhecido: {bloco}</div>;

  return (
    <>
      <div className="bar2">
        <div className="sub" style={{ maxWidth: 640 }}>{sub ?? spec.sub} {mesLabel(mes)}.</div>
        <div className="fs">
          <div className="cb" style={{ minWidth: 220 }}>
            <label>Buscar nos registros</label>
            <input className="cbb" style={{ cursor: "text" }} placeholder="Digite para filtrar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {optsCol.length > 0 && <Combo k="col" label="Filtro rápido" value={colF} opts={optsCol} todos="Todos" onChange={setColF} />}
          {spec.nexus && <button type="button" className="back" style={{ alignSelf: "flex-end" }} onClick={() => abrir(spec.nexus!)}>Abrir no Nexus</button>}
        </div>
      </div>
      {erro && <div className="err">Não consegui carregar: {erro}</div>}
      {!d && !erro && <div className="load">Carregando registros...</div>}
      {d && (
        <>
          {spec.resumo && <div className="kg">{spec.resumo(d).map((t, i) => <Tile key={i} label={t.label} valor={t.valor} sub={t.sub} />)}</div>}
          <div className="p wide">
            <div className="h"><b>Registros</b><span>{linhas.length === d.total ? `${d.total} linhas` : `${linhas.length} de ${d.total} linhas`}{d.total > d.limite ? `. Limite de ${d.limite} por tela` : ""}. Clique no nome pra abrir no Nexus.</span></div>
            <Tabela
              cols={spec.cols.map((c) => ({ h: c.h, tl: c.tl }))}
              rows={linhas.map((l) => spec.cols.map((c) => {
                const v = l[c.k];
                if (c.link && c.idk && l[c.idk]) {
                  const url = c.link === "lead" ? LINK.lead(l[c.idk]) : c.link === "empresa" ? LINK.empresa(l[c.idk]) : LINK.conversa(l[c.idk]);
                  return <Lk ext onClick={() => abrir(url)} title="Abrir no Nexus">{v == null || v === "" ? "(sem nome)" : String(v)}</Lk>;
                }
                if (c.link === "lead" && l.lead_id && c.k !== "nome") return <Lk ext onClick={() => abrir(LINK.lead(l.lead_id))}>{String(v ?? "-")}</Lk>;
                return cel(v, c.t);
              }))}
              vazio="Nenhum registro com esse filtro."
            />
          </div>
        </>
      )}
    </>
  );
}

export const DETALHE_TITULO = (bloco: string): string => SPECS[bloco]?.titulo ?? bloco;
