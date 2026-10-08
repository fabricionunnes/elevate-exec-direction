// Tela de detalhe: chama painel_controle_detalhe(bloco, filtro) e lista os
// registros individuais. Cada linha com id abre o registro de verdade no Nexus.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Combo, Lk, Nd, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, dataHoraBR, eventoLabel, fp, fp2, mesLabel, nivelLabel, num, papelLabel, projetoLabel, tendLabel, usd } from "./fmt";
import { LINK, esc, soma, abrirNexus } from "./util";
import type { Detalhe as DetalheT, Filtro } from "./tipos";

type Tipo = "brl" | "brlfull" | "usd" | "num" | "int" | "data" | "datahora" | "pct" | "txt" | "nivel" | "evento" | "papel" | "proj" | "bool" | "dias" | "horas" | "tend" | "pct2" | "img";
type ColSpec = { h: string; k: string; t?: Tipo; link?: "lead" | "empresa" | "conversa"; tl?: boolean; idk?: string; /** troca o código pelo rótulo */ map?: Record<string, string> };
/** pra onde a linha leva: outro bloco de detalhe, um nível abaixo */
type Drill = { bloco: string; filtro: Filtro; titulo: string };
type Spec = {
  titulo: string; sub: string; cols: ColSpec[]; resumo?: (d: DetalheT) => { label: string; valor: string; sub?: string }[]; nexus?: string;
  drill?: (l: Record<string, any>, filtro: Filtro) => Drill | null; drillTxt?: string;
  /** blocos "pra frente" vêm de painel_frente_detalhe, não de painel_controle_detalhe */
  rpc?: "painel_frente_detalhe";
};

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
  mrr: S("MRR, cobrança por cobrança", "Só o que fatura todo mês: cobrança mensal ativa, de empresa ativa, com fatura a vencer. Parcela única, plano encerrado e empresa inativa ficam na lista Fora do MRR.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Mensalidade", k: "valor", t: "brlfull" }, { h: "Tipo", k: "tipo", map: { parcelado: "plano parcelado", unica: "parcela única", sem_fim: "mensal sem data de fim" } },
    { h: "Parcelas", k: "parcelas", t: "int" }, { h: "A vencer", k: "a_vencer", t: "int" }, { h: "Última parcela", k: "ultima_parcela", t: "data" }, { h: "Consultor", k: "consultor" }, { h: "Início", k: "inicio", t: "data" }, { h: "Projeto", k: "projeto_status", t: "proj" },
    { h: "Por que está fora", k: "motivo_fora", tl: true }, { h: "Cobrança", k: "descricao", tl: true },
  ], { resumo: (d) => [{ label: "Cobranças", valor: num(d.total, 0) }, { label: "Soma por mês", valor: brlFull(d.soma) }, { label: "Clientes", valor: num(new Set(d.linhas.map((l) => l.company_id)).size, 0) }, { label: "Média por cobrança", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }], nexus: LINK.recorrencias }),
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
    { h: "Campanha", k: "nome", tl: true }, { h: "Status", k: "status" }, { h: "Objetivo", k: "objetivo" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" },
  ], { resumo: (d) => [{ label: "Campanhas", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "CPL", valor: brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null) }, { label: "CTR", valor: fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null) }, { label: "Receita no CRM", valor: brl(soma(d.linhas, (l) => l.receita_crm)) }], nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "meta_conjuntos", filtro: { campaign_id: l.campaign_id, dia: f.dia }, titulo: `Conjuntos · ${l.nome}` }), drillTxt: "os conjuntos da campanha" }),
  campanhas_dia: S("Campanha por dia", "Uma linha por campanha por dia.", [
    { h: "Data", k: "data", t: "data" }, { h: "Campanha", k: "campanha", tl: true }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Status", k: "status" },
  ], { resumo: (d) => [{ label: "Linhas", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "CPL", valor: brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null) }, { label: "CTR", valor: fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null) }], nexus: LINK.crm,
    drill: (l) => ({ bloco: "meta_conjuntos", filtro: { campaign_id: l.campaign_id, dia: String(l.data).slice(0, 10) }, titulo: `Conjuntos · ${l.campanha} em ${dataBR(l.data)}` }), drillTxt: "os conjuntos da campanha naquele dia" }),
  meta_dia: S("Meta Ads dia a dia", "Total de todas as campanhas em cada dia.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Campanhas com gasto", k: "campanhas", t: "int" },
  ], { resumo: (d) => [{ label: "Dias com linha", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "CPL", valor: brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null) }, { label: "CTR", valor: fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null) }, { label: "Dias com gasto", valor: num(d.linhas.filter((l) => l.spend > 0).length, 0) }], nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "campanhas_dia", filtro: { dia: String(l.dia).slice(0, 10), campaign_id: f.campaign_id }, titulo: `Campanhas em ${dataBR(l.dia)}` }), drillTxt: "as campanhas do dia" }),
  meta_conjuntos: S("Conjuntos de anúncio", "Conjuntos (públicos) com as mesmas métricas da campanha e o que virou lead e venda no CRM.", [
    { h: "Conjunto", k: "nome", tl: true }, { h: "Campanha", k: "campanha", tl: true }, { h: "Status", k: "status" }, { h: "Orçamento por dia", k: "orcamento_dia", t: "brl" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" },
  ], { resumo: (d) => [{ label: "Conjuntos", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "CPL", valor: brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null) }, { label: "CTR", valor: fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null) }, { label: "Receita no CRM", valor: brl(soma(d.linhas, (l) => l.receita_crm)) }], nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "meta_anuncios", filtro: { adset_id: l.adset_id, dia: f.dia }, titulo: `Anúncios · ${l.nome}` }), drillTxt: "os anúncios do conjunto" }),
  meta_anuncios: S("Anúncios", "Cada criativo com as mesmas métricas e o que virou lead e venda no CRM.", [
    { h: "Criativo", k: "thumb", t: "img", tl: true }, { h: "Anúncio", k: "nome", tl: true }, { h: "Conjunto", k: "conjunto", tl: true }, { h: "Campanha", k: "campanha", tl: true }, { h: "Status", k: "status" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" }, { h: "Título", k: "titulo", tl: true }, { h: "Texto", k: "texto", tl: true },
  ], { resumo: (d) => [{ label: "Anúncios", valor: num(d.total, 0) }, { label: "Gasto", valor: brl(d.soma) }, { label: "Leads Meta", valor: num(soma(d.linhas, (l) => l.leads), 0) }, { label: "CPL", valor: brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null) }, { label: "CTR", valor: fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null) }, { label: "Receita no CRM", valor: brl(soma(d.linhas, (l) => l.receita_crm)) }], nexus: LINK.crm }),
  caixa_movimentos: S("Lançamentos da projeção de caixa", "Cada fatura e cada conta a pagar, com a data e o valor que entram em cada cenário.", [
    { h: "Tipo", k: "tipo", map: { entrada: "Entra", saida: "Sai" } }, { h: "Quem", k: "nome", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Valor", k: "valor", t: "brlfull" },
    { h: "Situação", k: "classe", map: { a_vencer: "A vencer", vencida_recente: "Vencida há até 30 dias", vencida_antiga: "Vencida há mais de 30 dias", renovacao: "Renovação presumida" } }, { h: "Atraso", k: "dias_atraso", t: "dias" },
    { h: "Data no contratado", k: "data_c", t: "data" }, { h: "Valor no contratado", k: "valor_c", t: "brlfull" }, { h: "Data no realista", k: "data_r", t: "data" }, { h: "Valor no realista", k: "valor_r", t: "brlfull" }, { h: "Regra", k: "motivo_r", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.financeiro,
    resumo: (d) => { const x = d as any; return [{ label: "Lançamentos", valor: num(d.total, 0) }, { label: "Entra (contratado)", valor: brl(x.entra_c) }, { label: "Entra (realista)", valor: brl(x.entra_r) }, { label: "Sai", valor: brl(x.sai) }, { label: "Saldo do recorte (realista)", valor: brl((x.entra_r ?? 0) - (x.sai ?? 0)) }, ...(x.fora_n ? [{ label: "Fora da projeção", valor: brl(x.fora_valor), sub: `${x.fora_n} vencidos há mais de 30 dias` }] : [])]; } }),
  vendas_grupo: S("Vendas por quem fechou", "Leads ganhos no mês, separados em fundador, time e sem fechador (venda do site).", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Data", k: "data", t: "data" },
    { h: "Quem fechou", k: "grupo", map: { fundador: "Fundador", time: "Time", sem_fechador: "Sem fechador (site)" } }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" }, { h: "Funil", k: "funil" }, { h: "Origem", k: "origem" }, { h: "Produto", k: "produto", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.leads, resumo: (d) => [{ label: "Vendas", valor: num(d.total, 0) }, { label: "Receita", valor: brl(d.soma) }, { label: "Ticket médio", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }] }),
  mrr_clientes: S("Mensalidade por cliente", "Soma das cobranças recorrentes de cada cliente e o peso dele no total.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Mensalidade", k: "valor", t: "brlfull" }, { h: "% do total", k: "pct", t: "pct2" }, { h: "Cobranças", k: "cobrancas", t: "int" }, { h: "Parcelas geradas até", k: "parcelas_ate", t: "data" },
    { h: "Fim do contrato", k: "contrato_fim", t: "data" }, { h: "Plano", k: "plano" }, { h: "Consultor", k: "consultor" }, { h: "Empresa", k: "empresa_status", map: { active: "ativa", inactive: "inativa" } }, { h: "Por que está fora", k: "motivo_fora", tl: true }, { h: "Cobrança", k: "descricao", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.recorrencias, resumo: (d) => [{ label: "Clientes", valor: num(d.total, 0) }, { label: "Mensalidades", valor: brl(d.soma) }, { label: "Média por cliente", valor: brl(d.total ? (d.soma ?? 0) / d.total : null) }] }),
  reunioes_futuras: S("Reuniões na agenda", "Atividades do CRM do tipo reunião, não canceladas, pela data marcada.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Hora", k: "hora" }, { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" },
    { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Valor", k: "valor", t: "brl" }, { h: "Situação", k: "status", map: { pending: "marcada", completed: "feita" } }, { h: "Título", k: "titulo", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.reunioes, resumo: (d) => [{ label: "Reuniões", valor: num(d.total, 0) }, { label: "Closers", valor: num(new Set(d.linhas.map((l) => l.closer)).size, 0) }, { label: "Dias com reunião", valor: num(new Set(d.linhas.map((l) => l.dia)).size, 0) }] }),
  pipeline_aberto: S("Pipeline aberto", "Leads fora de etapa final e com valor.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" },
    { h: "Último movimento", k: "ultimo_movimento", t: "data" }, { h: "Parado há", k: "dias_parado", t: "dias" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Origem", k: "origem" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.pipeline, resumo: (d) => [{ label: "Leads", valor: num(d.total, 0), sub: d.total > d.limite ? `mostrando os ${d.limite} maiores` : undefined }, { label: "Valor", valor: brl(d.soma) }, { label: "Parados há mais de 30 dias", valor: num(d.linhas.filter((l) => l.dias_parado > 30).length, 0) }] }),
  leads_atencao: S("Leads recentes", "Leads dos funis que contam entrada, criados nos últimos 14 dias.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Há", k: "dias", t: "dias" },
    { h: "Origem", k: "origem" }, { h: "Sem dono", k: "sem_dono", t: "bool" }, { h: "Sem atividade", k: "sem_atividade", t: "bool" }, { h: "Telefone", k: "telefone" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.leads, resumo: (d) => [{ label: "Leads", valor: num(d.total, 0) }, { label: "Sem dono", valor: num(d.linhas.filter((l) => l.sem_dono).length, 0) }, { label: "Sem primeira atividade", valor: num(d.linhas.filter((l) => l.sem_atividade).length, 0) }] }),
  mrr_movimentos: S("Movimento do MRR", "O que mudou no faturado recorrente de cada cliente contra o mês anterior.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Movimento", k: "tipo", map: { novo: "Novo", reativacao: "Reativação", expansao: "Expansão", contracao: "Contração", churn: "Churn", mantido: "Manteve" } },
    { h: "Mês anterior", k: "antes", t: "brlfull" }, { h: "Neste mês", k: "depois", t: "brlfull" }, { h: "Diferença", k: "delta", t: "brlfull" }, { h: "Consultor", k: "consultor" }, { h: "Empresa hoje", k: "empresa_status", map: { active: "ativa", inactive: "inativa" } },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.recorrencias, resumo: (d) => [{ label: "Clientes", valor: num(d.total, 0) }, { label: "Saldo do movimento", valor: brl(d.soma) }, { label: "Churn", valor: brl(soma(d.linhas.filter((l) => l.tipo === "churn"), (l) => l.antes)) }, { label: "Novo e reativação", valor: brl(soma(d.linhas.filter((l) => l.tipo === "novo" || l.tipo === "reativacao"), (l) => l.depois)) }] }),
  renovacoes: S("Fim de contrato", "Contratos de clientes ativos que terminam na janela. Plano mensal renova sozinho.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Fim", k: "fim", t: "data" }, { h: "Em", k: "dias", t: "dias" }, { h: "Tipo", k: "grupo", map: { risco: "Com prazo (risco)", mensal: "Mensal (renova sozinho)" } }, { h: "De onde vem", k: "origem", tl: true },
    { h: "Plano", k: "plano" }, { h: "Início", k: "inicio", t: "data" }, { h: "Valor do contrato", k: "valor", t: "brlfull" }, { h: "Mensalidade ativa", k: "mensalidade", t: "brlfull" }, { h: "Consultor", k: "consultor" }, { h: "Projeto", k: "projeto_status", t: "proj" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.empresas, resumo: (d) => [{ label: "Contratos", valor: num(d.total, 0) }, { label: "Com prazo (risco)", valor: num(d.linhas.filter((l) => l.grupo === "risco").length, 0) }, { label: "Valor em risco", valor: brl(d.soma) }] }),
  produto_clientes: S("Clientes por produto", "Projetos de cada produto, com consultor e a mensalidade que fatura.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Produto", k: "produto" }, { h: "Projeto", k: "projeto_status", t: "proj" }, { h: "Consultor", k: "consultor" }, { h: "Mensalidade que fatura", k: "mensalidade", t: "brlfull" },
    { h: "Início", k: "inicio", t: "data" }, { h: "Fim", k: "fim", t: "data" }, { h: "Churn em", k: "churn_em", t: "data" }, { h: "Motivo", k: "churn_motivo", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.empresas, resumo: (d) => [{ label: "Projetos", valor: num(d.total, 0) }, { label: "Clientes", valor: num(new Set(d.linhas.map((l) => l.company_id)).size, 0) }, { label: "Mensalidades", valor: brl(d.soma) }, { label: "Consultores", valor: num(new Set(d.linhas.map((l) => l.consultor).filter(Boolean)).size, 0) }] }),
  produto_receita: S("Faturas pagas por produto", "Cada fatura paga no mês e o produto a que foi atribuída.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Produto atribuído", k: "produto" }, { h: "Descrição da fatura", k: "descricao", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Recorrente", k: "recorrente", t: "bool" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.financeiro, resumo: (d) => [{ label: "Faturas", valor: num(d.total, 0) }, { label: "Recebido", valor: brl(d.soma) }, { label: "Clientes", valor: num(new Set(d.linhas.map((l) => l.company_id)).size, 0) }] }),
  contas_centro: S("Contas pagas por centro de custo", "Contas a pagar quitadas no mês, com centro de custo e categoria.", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Centro de custo", k: "centro" }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Tipo", k: "tipo_custo", map: { fixed: "fixo", variable: "variável" } },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.financeiro, resumo: (d) => [{ label: "Contas", valor: num(d.total, 0) }, { label: "Pago", valor: brl(d.soma) }, { label: "Sem categoria", valor: num(d.linhas.filter((l) => l.categoria === "Sem categoria").length, 0) }] }),
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
    case "pct2": return fp2(Number(v));
    case "img": return <a href={String(v)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Abrir a imagem"><img className="thumb" src={String(v)} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} /></a>;
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

export function Detalhe({ mes, bloco, filtro, titulo, sub, det }: {
  mes: string; bloco: string; filtro?: Filtro; titulo?: string; sub?: string;
  /** empilha outro detalhe (campanha abre conjuntos, conjunto abre anúncios) */
  det?: (bloco: string, filtro?: Filtro, titulo?: string, sub?: string) => void;
}) {
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
      const { data, error } = await (supabase as any).rpc(spec?.rpc ?? "painel_controle_detalhe", { p_month: mes, p_bloco: bloco, p_filtro: filtro ?? {} });
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
  const colsFiltro = (spec?.cols ?? []).filter((c) => !c.t && !c.link && ["closer", "sdr", "funil", "consultor", "atendente", "agente", "responsavel", "categoria", "status", "origem", "tipo", "modo", "outcome", "canal", "dono", "etapa", "plano", "instancia", "numero", "bloco", "nivel", "papel", "forma", "banco", "campanha", "produto", "conjunto", "objetivo", "classe", "motivo_r", "centro", "grupo"].includes(c.k));
  const optsCol = useMemo(() => {
    if (!d) return [] as { value: string; label: string }[];
    const out: { value: string; label: string }[] = [];
    colsFiltro.forEach((c) => {
      const vals = [...new Set(d.linhas.map((l) => l[c.k]).filter((v) => v != null && v !== ""))].map(String).sort();
      if (vals.length > 1 && vals.length <= 60) vals.forEach((v) => out.push({ value: `${c.k}=${v}`, label: `${c.h}: ${v}` }));
    });
    return out;
  }, [d]);

  const abrir = (url: string) => abrirNexus(url);

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
            <div className="h"><b>Registros</b><span>{linhas.length === d.total ? `${d.total} ${d.total === 1 ? "linha" : "linhas"}` : `${linhas.length} de ${d.total} linhas`}{d.total > d.limite ? `. Limite de ${d.limite} por tela` : ""}. {spec.drill && det ? `Clique na linha pra abrir ${spec.drillTxt ?? "o detalhe"}.` : "Clique no nome pra abrir no Nexus."}</span></div>
            <Tabela
              onRow={spec.drill && det ? (i) => { const x = spec.drill!(linhas[i], filtro ?? {}); if (x) det(x.bloco, x.filtro, x.titulo); } : undefined}
              cols={spec.cols.map((c) => ({ h: c.h, tl: c.tl }))}
              rows={linhas.map((l) => spec.cols.map((c) => {
                const v = l[c.k];
                if (c.link && c.idk && l[c.idk]) {
                  const url = c.link === "lead" ? LINK.lead(l[c.idk]) : c.link === "empresa" ? LINK.empresa(l[c.idk]) : LINK.conversa(l[c.idk]);
                  return <Lk ext onClick={() => abrir(url)} title="Abrir no Nexus">{v == null || v === "" ? "(sem nome)" : String(v)}</Lk>;
                }
                if (c.link === "lead" && l.lead_id && c.k !== "nome") return <Lk ext onClick={() => abrir(LINK.lead(l.lead_id))}>{String(v ?? "-")}</Lk>;
                if (c.map && v != null) return c.map[String(v)] ?? String(v);
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
