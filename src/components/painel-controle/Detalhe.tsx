// Tela de detalhe: chama painel_controle_detalhe(bloco, filtro) e lista os
// registros individuais. Cada linha com id abre o registro de verdade no Nexus.
//
// Regra do dono (Fabrício, 11/10/2026): ao clicar num card, o detalhe mostra EXATAMENTE
// aquilo que foi clicado. O primeiro tile é a contagem do que foi clicado, com o rótulo do
// card de origem; tile que seria zero por construção sob aquele filtro não aparece; e a tabela
// começa pelas colunas que explicam o recorte. Por isso `resumo` e `colsF` recebem o filtro.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Combo, Lk, Nd, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, dataHoraBR, eventoLabel, fp, fp2, mesLabel, nivelLabel, num, papelLabel, projetoLabel, tendLabel, usd } from "./fmt";
import { LINK, esc, grp, soma, abrirNexus } from "./util";
import type { Detalhe as DetalheT, Filtro } from "./tipos";

type Tipo = "brl" | "brlfull" | "usd" | "num" | "int" | "data" | "datahora" | "pct" | "txt" | "nivel" | "evento" | "papel" | "proj" | "bool" | "dias" | "horas" | "tend" | "pct2" | "img";
type ColSpec = { h: string; k: string; t?: Tipo; link?: "lead" | "empresa" | "conversa"; tl?: boolean; idk?: string; /** troca o código pelo rótulo */ map?: Record<string, string> };
/** pra onde a linha leva: outro bloco de detalhe, um nível abaixo */
type Drill = { bloco: string; filtro: Filtro; titulo: string };
type TileT = { label: string; valor: string; sub?: string };
type Linha = Record<string, any>;
type Spec = {
  titulo: string; sub: string; cols: ColSpec[]; resumo?: (d: DetalheT, filtro: Filtro) => TileT[]; nexus?: string;
  /** colunas conforme o filtro clicado (ordem e quais aparecem). Sem isso vale `cols`. */
  colsF?: (filtro: Filtro) => ColSpec[];
  drill?: (l: Linha, filtro: Filtro) => Drill | null; drillTxt?: string;
  /** blocos "pra frente" vêm de painel_frente_detalhe, não de painel_controle_detalhe */
  rpc?: "painel_frente_detalhe";
};

const S = (titulo: string, sub: string, cols: ColSpec[], extra?: Partial<Spec>): Spec => ({ titulo, sub, cols, ...extra });

/* ---------- ajudantes do resumo ---------- */
const T = (label: string, valor: string | number, sub?: string): TileT => ({ label, valor: typeof valor === "number" ? num(valor, 0) : valor, sub });
const uniq = (rows: Linha[], k: string): number => new Set(rows.map((r) => r[k]).filter((v) => v != null && v !== "")).size;
const media = (rows: Linha[], k: string): number | null => {
  const v = rows.map((r) => r[k]).filter((x) => x != null && x !== "" && !Number.isNaN(Number(x))).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const dias = (v: number | null | undefined): string => (v == null || Number.isNaN(Number(v)) ? "-" : `${num(v, 0)} ${Math.round(Number(v)) === 1 ? "dia" : "dias"}`);
const mediaDe = (d: DetalheT): number | null => (d.total ? (d.soma ?? 0) / d.total : null);
/** dias de hoje até uma data ISO (negativo = já passou) */
const emDias = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`).getTime() - h.getTime()) / 864e5);
};
const mesesEntre = (a: string | null | undefined, b: string | null | undefined): number | null => {
  if (!a || !b) return null;
  return (new Date(String(b).slice(0, 10)).getTime() - new Date(String(a).slice(0, 10)).getTime()) / (864e5 * 30.44);
};
const mesesTxt = (v: number | null): string => (v == null ? "-" : `${num(v, 0)} ${Math.round(v) === 1 ? "mês" : "meses"}`);
const nomeCurto = (s: string): string => s.split(" ").slice(0, 2).join(" ");
/** tile de recorte: o maior grupo vai no rótulo e no valor, os próximos no rodapé */
const por = (label: string, rows: Linha[], k: string, f?: (rs: Linha[]) => number, fmt: (v: number) => string = (v) => num(v, 0)): TileT => {
  const g = grp(rows, (r) => (r[k] == null || r[k] === "" ? null : String(r[k])));
  const e = Object.entries(g).map(([nome, rs]) => [nome, f ? f(rs) : rs.length] as const).sort((a, b) => b[1] - a[1]);
  if (!e.length) return T(label, "-");
  const resto = e.slice(1, 4).map(([n, v]) => `${nomeCurto(n)} ${fmt(v)}`).join(", ");
  return T(`${label}: ${nomeCurto(e[0][0])}`, fmt(e[0][1]), resto ? resto + (e.length > 4 ? `, mais ${e.length - 4}` : "") : `único (${e[0][0]})`);
};
const porValor = (label: string, rows: Linha[], k: string, vk: string): TileT => por(label, rows, k, (rs) => soma(rs, (r) => r[vk]), brl);
const subLimite = (d: DetalheT): string | undefined => (d.total > d.limite ? `mostrando ${d.limite}` : undefined);

/* ---------- ajudantes das colunas ---------- */
/** as colunas de `primeiro` vão pra frente (nessa ordem); as de `sem` saem */
const ord = (cols: ColSpec[], primeiro: string[], sem: string[] = []): ColSpec[] => [
  ...primeiro.map((k) => cols.find((c) => c.k === k)).filter((c): c is ColSpec => !!c && !sem.includes(c.k)),
  ...cols.filter((c) => !primeiro.includes(c.k) && !sem.includes(c.k)),
];
/** coluna constante sob o filtro vai pro fim */
const fim = (cols: ColSpec[], ultimo: string[]): ColSpec[] => [...cols.filter((c) => !ultimo.includes(c.k)), ...ultimo.map((k) => cols.find((c) => c.k === k)).filter((c): c is ColSpec => !!c)];
const str = (v: unknown): string => (v == null ? "" : String(v));

/* ---------- colunas base dos blocos que mudam com o filtro ---------- */
const C_REUNIOES: ColSpec[] = [
  { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Evento", k: "tipo", t: "evento" }, { h: "Data", k: "data", t: "datahora" },
  { h: "Marcada para", k: "marcada_para", t: "datahora" }, { h: "Resultado", k: "resultado" }, { h: "SDR", k: "sdr" }, { h: "Closer", k: "closer" }, { h: "Funil", k: "funil" }, { h: "Etapa atual", k: "etapa_atual" }, { h: "Desfecho", k: "desfecho" }, { h: "Valor", k: "valor", t: "brl" },
];
const C_CLIENTES: ColSpec[] = [
  { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Consultor", k: "consultor" }, { h: "Mensalidade", k: "mensalidade", t: "brlfull" }, { h: "Produto", k: "produto", tl: true }, { h: "Projeto", k: "projeto_status", t: "proj" }, { h: "Início", k: "inicio", t: "data" }, { h: "Fim", k: "fim", t: "data" }, { h: "Plano", k: "plano" },
  { h: "Health", k: "score", t: "num" }, { h: "Nível", k: "nivel", t: "nivel" }, { h: "Tendência", k: "tendencia", t: "tend" }, { h: "NPS", k: "nps", t: "int" }, { h: "Tarefas atrasadas", k: "tarefas_atrasadas", t: "int" }, { h: "Vencido", k: "vencido", t: "brl" }, { h: "Churn em", k: "churn_em", t: "data" }, { h: "Motivo", k: "churn_motivo", tl: true },
];
const C_CAIXA: ColSpec[] = [
  { h: "Tipo", k: "tipo", map: { entrada: "Entra", saida: "Sai" } }, { h: "Quem", k: "nome", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Valor", k: "valor", t: "brlfull" },
  { h: "Situação", k: "classe", map: { a_vencer: "A vencer", vencida_recente: "Vencida há até 30 dias", vencida_antiga: "Vencida há mais de 30 dias", renovacao: "Renovação presumida" } }, { h: "Atraso", k: "dias_atraso", t: "dias" },
  { h: "Data no contratado", k: "data_c", t: "data" }, { h: "Valor no contratado", k: "valor_c", t: "brlfull" }, { h: "Data no realista", k: "data_r", t: "data" }, { h: "Valor no realista", k: "valor_r", t: "brlfull" }, { h: "Regra", k: "motivo_r", tl: true },
];
const C_MRR: ColSpec[] = [
  { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Mensalidade", k: "valor", t: "brlfull" }, { h: "Tipo", k: "tipo", map: { parcelado: "plano parcelado", unica: "parcela única", sem_fim: "mensal sem data de fim" } },
  { h: "Parcelas", k: "parcelas", t: "int" }, { h: "A vencer", k: "a_vencer", t: "int" }, { h: "Última parcela", k: "ultima_parcela", t: "data" }, { h: "Consultor", k: "consultor" }, { h: "Início", k: "inicio", t: "data" }, { h: "Projeto", k: "projeto_status", t: "proj" },
  { h: "Empresa hoje", k: "empresa_status", map: { active: "ativa", inactive: "inativa" } }, { h: "Por que está fora", k: "motivo_fora", tl: true }, { h: "Cobrança", k: "descricao", tl: true },
];
const C_VENDAS: ColSpec[] = [
  { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Data", k: "data", t: "data" }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" }, { h: "Funil", k: "funil" }, { h: "Origem", k: "origem" }, { h: "Campanha", k: "campanha", tl: true }, { h: "Pago", k: "pago", t: "bool" }, { h: "Produto", k: "produto", tl: true },
];
const C_LEADS: ColSpec[] = [
  { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Origem", k: "origem" }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Parado há", k: "dias_parado", t: "dias" }, { h: "Valor", k: "valor", t: "brl" }, { h: "Campanha", k: "campanha", tl: true },
];
const C_LEADS_AT: ColSpec[] = [
  { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Há", k: "dias", t: "dias" },
  { h: "Origem", k: "origem" }, { h: "Sem dono", k: "sem_dono", t: "bool" }, { h: "Sem atividade", k: "sem_atividade", t: "bool" }, { h: "Telefone", k: "telefone" },
];
const C_PROD_CLI: ColSpec[] = [
  { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Produto", k: "produto" }, { h: "Projeto", k: "projeto_status", t: "proj" }, { h: "Consultor", k: "consultor" }, { h: "Mensalidade que fatura", k: "mensalidade", t: "brlfull" },
  { h: "Início", k: "inicio", t: "data" }, { h: "Fim", k: "fim", t: "data" }, { h: "Churn em", k: "churn_em", t: "data" }, { h: "Motivo", k: "churn_motivo", tl: true },
];
const ROT_MOV: Record<string, string> = { novo: "Novos", reativacao: "Reativações", expansao: "Expansões", contracao: "Contrações", churn: "Churn", mantido: "Mantiveram" };
const EM_AVISO = ["notice_period", "cancellation_signaled"];
const PIORANDO = ["declining", "falling", "down"];

const SPECS: Record<string, Spec> = {
  faturas_pagas: S("Faturas pagas", "Mensalidades de clientes com pagamento confirmado no mês (paid_at).", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Valor líquido", k: "valor", t: "brlfull" },
    { h: "Valor da fatura", k: "valor_fatura", t: "brlfull" }, { h: "Pago em", k: "data", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Forma", k: "forma" }, { h: "Banco", k: "banco" }, { h: "Parcela", k: "parcela" },
  ], { resumo: (d, f) => [T("Faturas pagas", d.total), T("Recebido", brl(d.soma)), T("Média por fatura", brl(mediaDe(d))), ...(f.company_id ? [T("Pagas em atraso", d.linhas.filter((l) => l.vencimento && l.data && str(l.data) > str(l.vencimento)).length)] : [T("Clientes", uniq(d.linhas, "company_id")), por("Por forma", d.linhas, "forma")])], nexus: LINK.financeiro }),
  faturas_vencidas: S("Faturas vencidas", "Sem pagamento, vencimento antes de hoje. Fatura paga nunca aparece aqui.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Atraso", k: "dias", t: "dias" }, { h: "Descrição", k: "descricao", tl: true },
    { h: "Consultor", k: "consultor" }, { h: "Cobranças", k: "contatos", t: "int" }, { h: "Último contato", k: "ultimo_contato", t: "datahora" }, { h: "Situação", k: "status" },
  ], { resumo: (d, f) => { const a30 = d.linhas.filter((l) => l.dias > 30); return [T("Faturas vencidas", d.total), T("Total vencido", brl(d.soma)), T("Mais de 30 dias", brl(soma(a30, (l) => l.valor)), `${a30.length} faturas`), T("Atraso médio", dias(media(d.linhas, "dias"))), T("Sem nenhuma cobrança", d.linhas.filter((l) => !Number(l.contatos)).length, "nenhuma mensagem da régua"), ...(f.company_id ? [] : [porValor("Por consultor", d.linhas, "consultor", "valor")])]; }, nexus: LINK.financeiro }),
  faturas_a_receber: S("A receber no mês", "Faturas em aberto com vencimento dentro do mês.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Em dias", k: "dias", t: "int" }, { h: "Forma", k: "forma" }, { h: "Consultor", k: "consultor" }, { h: "Situação", k: "status" },
  ], { resumo: (d) => { const s7 = d.linhas.filter((l) => l.dias >= 0 && l.dias <= 7); return [T("Faturas a receber", d.total), T("A receber", brl(d.soma)), T("Vence em até 7 dias", brl(soma(s7, (l) => l.valor)), `${s7.length} faturas`), T("Clientes", uniq(d.linhas, "company_id"))]; }, nexus: LINK.financeiro }),
  contas_pagas: S("Contas pagas", "Contas a pagar quitadas no mês (paid_date).", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Forma", k: "forma" }, { h: "Banco", k: "banco" }, { h: "Tipo", k: "tipo_custo" },
  ], { resumo: (d, f) => [T("Contas pagas", d.total), T("Pago", brl(d.soma)), T("Média por conta", brl(mediaDe(d))), T("Fornecedores", uniq(d.linhas, "fornecedor")), f.categoria ? porValor("Por fornecedor", d.linhas, "fornecedor", "valor") : porValor("Por categoria", d.linhas, "categoria", "valor")],
    colsF: (f) => (f.categoria ? fim(S_COLS("contas_pagas"), ["categoria"]) : S_COLS("contas_pagas")), nexus: LINK.financeiro }),
  contas_a_pagar: S("Contas a pagar", "Em aberto: atrasadas, do mês e dos próximos 7 dias.", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Em dias", k: "dias", t: "int" }, { h: "Situação", k: "status" }, { h: "Recorrente", k: "recorrente", t: "bool" },
  ], { resumo: (d) => { const at = d.linhas.filter((l) => l.dias < 0); const p7 = d.linhas.filter((l) => l.dias >= 0 && l.dias <= 7); return [T("Contas a pagar", d.total), T("Total", brl(d.soma)), T("Atrasadas", brl(soma(at, (l) => l.valor)), `${at.length} contas`), T("Próximos 7 dias", brl(soma(p7, (l) => l.valor)), `${p7.length} contas`), porValor("Por categoria", d.linhas, "categoria", "valor")]; }, nexus: LINK.financeiro }),
  bancos: S("Saldo por banco", "Saldo do Nexus e, quando o provedor informa, o saldo lá (Asaas).", [
    { h: "Banco", k: "nome", tl: true }, { h: "Saldo no Nexus", k: "saldo", t: "brlfull" }, { h: "Saldo no provedor", k: "saldo_provedor", t: "brlfull" }, { h: "Atualizado", k: "atualizado_em", t: "datahora" }, { h: "Movimento no mês", k: "movimento_mes", t: "brlfull" }, { h: "Lançamentos", k: "lancamentos_mes", t: "int" }, { h: "Erro", k: "erro", tl: true },
  ], { resumo: (d) => [T("Bancos", d.total), T("Saldo total", brl(d.soma))], nexus: LINK.financeiro }),
  mrr: S("MRR, cobrança por cobrança", "Só o que fatura todo mês: cobrança mensal ativa, de empresa ativa, com fatura a vencer. Parcela única, plano encerrado e empresa inativa ficam na lista Fora do MRR.", C_MRR, {
    resumo: (d, f) => {
      const L = d.linhas; const cli = T("Clientes", uniq(L, "company_id"));
      if (f.grupo === "fora") return [T("Fora do MRR", d.total), T("Valor cadastrado", brlFull(d.soma), "não entra na receita recorrente"), cli, por("Por motivo", L, "motivo_fora"), T("Empresa inativa", L.filter((l) => l.empresa_status !== "active").length)];
      const base = [T("Soma por mês", brlFull(d.soma)), cli, T("Média por cobrança", brl(mediaDe(d)))];
      const aviso = L.filter((l) => l.em_aviso);
      if (f.tipo_cobranca === "parcelado") { const a60 = L.filter((l) => { const n = emDias(l.ultima_parcela); return n != null && n <= 60; }); return [T("Planos parcelados", d.total), ...base, T("Última parcela em 60 dias", a60.length, brl(soma(a60, (l) => l.valor))), T("Parcelas a vencer", soma(L, (l) => l.a_vencer))]; }
      if (f.tipo_cobranca === "sem_fim") return [T("Mensais sem data de fim", d.total), ...base, T("Em aviso de saída", aviso.length, brl(soma(aviso, (l) => l.valor)))];
      if (f.acaba_em_dias) return [T(`Última parcela em ${f.acaba_em_dias} dias`, d.total), T("Mensalidade que acaba", brlFull(d.soma)), cli, T("Parcelas a vencer", soma(L, (l) => l.a_vencer)), por("Por consultor", L, "consultor")];
      if (f.em_aviso) return [T("Em aviso de saída", d.total), T("Mensalidade em risco", brlFull(d.soma)), cli, porValor("Por consultor", L, "consultor", "valor")];
      const parc = L.filter((l) => l.tipo === "parcelado"); const sf = L.filter((l) => l.tipo === "sem_fim");
      return [T("Cobranças no MRR", d.total), ...base, T("Parcelados", parc.length, brl(soma(parc, (l) => l.valor))), T("Sem data de fim", sf.length, brl(soma(sf, (l) => l.valor))), T("Em aviso de saída", aviso.length, brl(soma(aviso, (l) => l.valor)))];
    },
    colsF: (f) => (f.grupo === "fora" ? ord(C_MRR, ["empresa", "valor", "motivo_fora", "empresa_status", "tipo", "ultima_parcela"], ["a_vencer"]) : ord(C_MRR, [], ["motivo_fora", "empresa_status", ...(f.tipo_cobranca ? ["tipo"] : [])])),
    nexus: LINK.recorrencias }),
  vendas: S("Vendas", "Leads em estágio ganho com fechamento no mês.", C_VENDAS, {
    resumo: (d, f) => { const L = d.linhas; return [T(f.pago ? "Vendas de leads pagos" : "Vendas", d.total), T("Receita vendida", brl(d.soma)), T("Ticket médio", brl(mediaDe(d))), T("Sem valor", L.filter((l) => !l.valor).length, "cadastro incompleto"), f.pago ? porValor("Por campanha", L, "campanha", "valor") : f.closer_id ? porValor("Por funil", L, "funil", "valor") : porValor("Por closer", L, "closer", "valor")]; },
    colsF: (f) => (f.pago ? ord(C_VENDAS, ["nome", "empresa", "valor", "data", "origem", "campanha"], ["pago"]) : f.closer_id ? fim(ord(C_VENDAS, [], ["campanha"]), ["closer"]) : ord(C_VENDAS, [], ["campanha"])),
    nexus: LINK.leads }),
  reunioes: S("Reuniões", "Eventos de reunião do CRM no mês. Pra reunião agendada: a data marcada e o resultado dela.", C_REUNIOES, {
    resumo: (d, f) => {
      const L = d.linhas; const n = (p: (l: Linha) => boolean) => L.filter(p).length;
      const won = n((l) => l.desfecho === "won"); const lost = n((l) => l.desfecho === "lost");
      const quem = f.sdr_id ? por("Por closer", L, "closer") : por("Por SDR", L, "sdr");
      if (f.tipo === "scheduled") {
        // cards pelo resultado de cada reunião agendada, não pelo tipo do evento (a lista só tem agendamentos)
        const r = (x: string) => n((l) => l.resultado === x);
        return [T("Agendadas", d.total), T("Realizadas", r("Realizada"), fp(L.length ? r("Realizada") / L.length : null)), T("No-show", r("No-show")), T("Ainda marcadas", r("Marcada"), r("Cancelada") ? `${r("Cancelada")} cancelada(s)` : undefined), T("Viraram venda", won)];
      }
      if (f.tipo === "realizadas") return [T("Realizadas", d.total), T("Viraram venda", won, fp(L.length ? won / L.length : null)), T("Fora do ICP", n((l) => l.tipo === "realized_out_of_icp")), T("Perdidas", lost), quem];
      if (f.tipo === "no_show") return [T("No-show", d.total), T("Viraram venda depois", won), T("Perdidos", lost), quem, por("Por funil", L, "funil")];
      if (f.tipo === "fora_icp") return [T("Fora do ICP", d.total), T("Realizadas mesmo assim", n((l) => l.tipo === "realized_out_of_icp")), quem, por("Por funil", L, "funil")];
      return [T("Eventos", d.total), T("Agendadas", n((l) => l.tipo === "scheduled")), T("Realizadas", n((l) => str(l.tipo).startsWith("realized"))), T("No-show", n((l) => l.tipo === "no_show")), T("Fora do ICP", n((l) => str(l.tipo).endsWith("out_of_icp"))), T("Viraram venda", won)];
    },
    colsF: (f) => {
      const semQuem = f.sdr_id ? ["sdr"] : f.closer_id ? ["closer"] : [];
      if (f.tipo === "scheduled") return fim(ord(C_REUNIOES.map((c) => (c.k === "data" ? { ...c, h: "Agendada em" } : c)), ["nome", "empresa", "marcada_para", "resultado", "data"], ["tipo"]), semQuem);
      if (f.tipo) return fim(ord(C_REUNIOES, ["nome", "empresa", "data"], ["marcada_para", "resultado", ...(f.tipo === "no_show" ? ["tipo"] : [])]), f.tipo === "realizadas" || f.tipo === "fora_icp" ? [...semQuem, "tipo"] : semQuem);
      return fim(C_REUNIOES, semQuem);
    },
    nexus: LINK.reunioes }),
  leads: S("Leads do mês", "Leads criados no mês, com etapa atual e tempo parado.", C_LEADS, {
    resumo: (d, f) => { const L = d.linhas; const won = L.filter((l) => l.desfecho === "won").length; return [T(f.pago ? "Leads de origem paga" : f.pipeline_id ? "Leads do funil" : "Leads", d.total, subLimite(d)), T("Ganhos", won, fp(L.length ? won / L.length : null)), T("Perdidos", L.filter((l) => l.desfecho === "lost").length), T("Parados +7 dias", L.filter((l) => !l.desfecho && l.dias_parado > 7).length, "ainda abertos"), T("Sem dono", L.filter((l) => !l.dono).length), f.pago ? por("Por campanha", L, "campanha") : f.pipeline_id ? por("Por etapa", L, "etapa") : por("Por origem", L, "origem")]; },
    colsF: (f) => (f.pago ? ord(C_LEADS, ["nome", "empresa", "campanha", "origem", "funil", "etapa"]) : f.pipeline_id ? fim(C_LEADS, ["funil"]) : C_LEADS),
    nexus: LINK.leads }),
  campanhas: S("Campanhas", "Gasto e leads da Meta por campanha, mais o que virou lead e venda no CRM.", [
    { h: "Campanha", k: "nome", tl: true }, { h: "Status", k: "status" }, { h: "Objetivo", k: "objetivo" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" },
  ], { resumo: (d, f) => [T(f.dia ? "Campanhas no dia" : "Campanhas", d.total), T("Gasto", brl(d.soma)), T("Leads Meta", soma(d.linhas, (l) => l.leads)), T("CPL", brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null)), T("CTR", fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null)), T("Receita no CRM", brl(soma(d.linhas, (l) => l.receita_crm)))], nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "meta_conjuntos", filtro: { campaign_id: l.campaign_id, dia: f.dia }, titulo: `Conjuntos · ${l.nome}` }), drillTxt: "os conjuntos da campanha" }),
  campanhas_dia: S("Campanha por dia", "Uma linha por campanha por dia.", [
    { h: "Data", k: "data", t: "data" }, { h: "Campanha", k: "campanha", tl: true }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Status", k: "status" },
  ], { resumo: (d, f) => [T(f.dia ? "Campanhas no dia" : f.campaign_id ? "Dias da campanha" : "Linhas", d.total), T("Gasto", brl(d.soma)), T("Com gasto", d.linhas.filter((l) => l.spend > 0).length), T("Leads Meta", soma(d.linhas, (l) => l.leads)), T("CPL", brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null)), T("CTR", fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null))],
    colsF: (f) => (f.dia ? fim(S_COLS("campanhas_dia"), ["data"]) : f.campaign_id ? fim(S_COLS("campanhas_dia"), ["campanha"]) : S_COLS("campanhas_dia")), nexus: LINK.crm,
    drill: (l) => ({ bloco: "meta_conjuntos", filtro: { campaign_id: l.campaign_id, dia: String(l.data).slice(0, 10) }, titulo: `Conjuntos · ${l.campanha} em ${dataBR(l.data)}` }), drillTxt: "os conjuntos da campanha naquele dia" }),
  meta_dia: S("Meta Ads dia a dia", "Total de todas as campanhas em cada dia.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Campanhas com gasto", k: "campanhas", t: "int" },
  ], { resumo: (d) => [T("Dias com linha", d.total), T("Gasto", brl(d.soma)), T("Leads Meta", soma(d.linhas, (l) => l.leads)), T("CPL", brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null)), T("CTR", fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null)), T("Dias com gasto", d.linhas.filter((l) => l.spend > 0).length)], nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "campanhas_dia", filtro: { dia: String(l.dia).slice(0, 10), campaign_id: f.campaign_id }, titulo: `Campanhas em ${dataBR(l.dia)}` }), drillTxt: "as campanhas do dia" }),
  meta_conjuntos: S("Conjuntos de anúncio", "Conjuntos (públicos) com as mesmas métricas da campanha e o que virou lead e venda no CRM.", [
    { h: "Conjunto", k: "nome", tl: true }, { h: "Campanha", k: "campanha", tl: true }, { h: "Status", k: "status" }, { h: "Orçamento por dia", k: "orcamento_dia", t: "brl" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" },
  ], { resumo: (d, f) => [T(f.campaign_id ? "Conjuntos da campanha" : "Conjuntos", d.total), T("Gasto", brl(d.soma)), T("Leads Meta", soma(d.linhas, (l) => l.leads)), T("CPL", brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null)), T("CTR", fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null)), T("Receita no CRM", brl(soma(d.linhas, (l) => l.receita_crm)))],
    colsF: (f) => (f.campaign_id ? fim(S_COLS("meta_conjuntos"), ["campanha"]) : S_COLS("meta_conjuntos")), nexus: LINK.crm,
    drill: (l, f) => ({ bloco: "meta_anuncios", filtro: { adset_id: l.adset_id, dia: f.dia }, titulo: `Anúncios · ${l.nome}` }), drillTxt: "os anúncios do conjunto" }),
  meta_anuncios: S("Anúncios", "Cada criativo com as mesmas métricas e o que virou lead e venda no CRM.", [
    { h: "Criativo", k: "thumb", t: "img", tl: true }, { h: "Anúncio", k: "nome", tl: true }, { h: "Conjunto", k: "conjunto", tl: true }, { h: "Campanha", k: "campanha", tl: true }, { h: "Status", k: "status" }, { h: "Gasto", k: "spend", t: "brlfull" }, { h: "Impressões", k: "impressoes", t: "int" }, { h: "Cliques", k: "cliques", t: "int" }, { h: "CTR", k: "ctr", t: "pct2" }, { h: "CPC", k: "cpc", t: "brlfull" }, { h: "CPM", k: "cpm", t: "brlfull" }, { h: "Leads Meta", k: "leads", t: "int" }, { h: "CPL", k: "cpl", t: "brlfull" }, { h: "Leads no CRM", k: "leads_crm", t: "int" }, { h: "Vendas", k: "vendas_crm", t: "int" }, { h: "Receita", k: "receita_crm", t: "brl" }, { h: "Dias com gasto", k: "dias", t: "int" }, { h: "Título", k: "titulo", tl: true }, { h: "Texto", k: "texto", tl: true },
  ], { resumo: (d, f) => [T(f.adset_id ? "Anúncios do conjunto" : f.campaign_id ? "Anúncios da campanha" : "Anúncios", d.total), T("Gasto", brl(d.soma)), T("Leads Meta", soma(d.linhas, (l) => l.leads)), T("CPL", brl(soma(d.linhas, (l) => l.leads) ? (d.soma ?? 0) / soma(d.linhas, (l) => l.leads) : null)), T("CTR", fp2(soma(d.linhas, (l) => l.impressoes) ? soma(d.linhas, (l) => l.cliques) / soma(d.linhas, (l) => l.impressoes) : null)), T("Receita no CRM", brl(soma(d.linhas, (l) => l.receita_crm)))],
    colsF: (f) => (f.adset_id ? fim(S_COLS("meta_anuncios"), ["conjunto", "campanha"]) : f.campaign_id ? fim(S_COLS("meta_anuncios"), ["campanha"]) : S_COLS("meta_anuncios")), nexus: LINK.crm }),
  caixa_movimentos: S("Lançamentos da projeção de caixa", "Cada fatura e cada conta a pagar, com a data e o valor que entram em cada cenário.", C_CAIXA, { rpc: "painel_frente_detalhe", nexus: LINK.financeiro,
    resumo: (d, f) => {
      const x = d as any; const L = d.linhas; const atraso = T("Atraso médio", dias(media(L, "dias_atraso")));
      const venc = L.filter((l) => l.dias_atraso > 0);
      if (f.tipo === "saida") {
        if (f.classe === "vencida_antiga") return [T("Contas vencidas há mais de 30 dias", d.total), T("Total", brl(d.soma), "fora da projeção"), atraso, T("Maior atraso", dias(Math.max(0, ...L.map((l) => Number(l.dias_atraso) || 0)))), T("Fornecedores", uniq(L, "nome")), porValor("Por fornecedor", L, "nome", "valor")];
        if (f.classe === "vencida_recente") return [T("Contas vencidas há até 30 dias", d.total), T("Total", brl(d.soma)), T("Sai no contratado", brl(x.sai)), atraso, T("Fornecedores", uniq(L, "nome")), porValor("Por fornecedor", L, "nome", "valor")];
        return [T("Contas a pagar", d.total), T("Total", brl(d.soma)), T("Sai no contratado", brl(x.sai)), T("Vencidas", venc.length, brl(soma(venc, (l) => l.valor))), T("Fornecedores", uniq(L, "nome")), ...(x.fora_n ? [T("Fora da projeção", brl(x.fora_valor), `${x.fora_n} vencidas há mais de 30 dias`)] : [])];
      }
      if (f.tipo === "entrada") {
        if (f.classe === "vencida_antiga") return [T("Faturas vencidas há mais de 30 dias", d.total), T("Total", brl(d.soma), "fora da projeção"), atraso, T("Clientes", uniq(L, "company_id")), porValor("Por cliente", L, "nome", "valor")];
        if (f.classe === "vencida_recente") return [T("Faturas vencidas há até 30 dias", d.total), T("Total", brl(d.soma)), T("Entra (contratado)", brl(x.entra_c)), T("Entra (realista)", brl(x.entra_r)), atraso, T("Clientes", uniq(L, "company_id"))];
        return [T("Entradas previstas", d.total), T("Total", brl(d.soma)), T("Entra (contratado)", brl(x.entra_c)), T("Entra (realista)", brl(x.entra_r)), T("Vencidas", venc.length, brl(soma(venc, (l) => l.valor))), ...(x.fora_n ? [T("Fora da projeção", brl(x.fora_valor), `${x.fora_n} vencidas há mais de 30 dias`)] : [T("Clientes", uniq(L, "company_id"))])];
      }
      return [T(f.de ? "Lançamentos na semana" : "Lançamentos", d.total), T("Entra (contratado)", brl(x.entra_c)), T("Entra (realista)", brl(x.entra_r)), T("Sai", brl(x.sai)), T("Saldo do recorte (realista)", brl((x.entra_r ?? 0) - (x.sai ?? 0))), ...(x.fora_n ? [T("Fora da projeção", brl(x.fora_valor), `${x.fora_n} vencidos há mais de 30 dias`)] : [])];
    },
    colsF: (f) => {
      if (f.classe === "vencida_antiga") return ord(C_CAIXA, ["nome", "descricao", "vencimento", "dias_atraso", "valor"], ["tipo", "classe", "data_c", "valor_c", "data_r", "valor_r"]);
      if (f.classe) return ord(C_CAIXA, ["nome", "descricao", "vencimento", "dias_atraso", "valor"], ["tipo", "classe"]);
      if (f.tipo) return fim(C_CAIXA, ["tipo"]);
      return C_CAIXA;
    } }),
  vendas_grupo: S("Vendas por quem fechou", "Leads ganhos no mês, separados em fundador, time e sem fechador (venda do site).", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Data", k: "data", t: "data" },
    { h: "Quem fechou", k: "grupo", map: { fundador: "Fundador", time: "Time", sem_fechador: "Sem fechador (site)" } }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" }, { h: "Funil", k: "funil" }, { h: "Origem", k: "origem" }, { h: "Produto", k: "produto", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.leads,
    resumo: (d, f) => {
      const L = d.linhas; const base = [T("Receita", brl(d.soma)), T("Ticket médio", brl(mediaDe(d)))];
      if (f.grupo === "fundador") return [T("Vendas do fundador", d.total), ...base, porValor("Por funil", L, "funil", "valor"), porValor("Por origem", L, "origem", "valor")];
      if (f.grupo === "time") return [T("Vendas do time", d.total), ...base, porValor("Por closer", L, "closer", "valor"), porValor("Por funil", L, "funil", "valor")];
      if (f.grupo === "sem_fechador") return [T("Vendas sem fechador", d.total), ...base, porValor("Por origem", L, "origem", "valor"), porValor("Por produto", L, "produto", "valor")];
      const g = (k: string) => L.filter((l) => l.grupo === k);
      return [T("Vendas", d.total), ...base, T("Fundador", g("fundador").length, brl(soma(g("fundador"), (l) => l.valor))), T("Time", g("time").length, brl(soma(g("time"), (l) => l.valor))), T("Sem fechador", g("sem_fechador").length, brl(soma(g("sem_fechador"), (l) => l.valor)))];
    },
    colsF: (f) => (f.grupo ? fim(S_COLS("vendas_grupo"), ["grupo", ...(f.grupo === "sem_fechador" ? ["closer"] : [])]) : S_COLS("vendas_grupo")) }),
  mrr_clientes: S("Mensalidade por cliente", "Soma das cobranças recorrentes de cada cliente e o peso dele no total.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Mensalidade", k: "valor", t: "brlfull" }, { h: "% do total", k: "pct", t: "pct2" }, { h: "Cobranças", k: "cobrancas", t: "int" }, { h: "Parcelas geradas até", k: "parcelas_ate", t: "data" },
    { h: "Fim do contrato", k: "contrato_fim", t: "data" }, { h: "Plano", k: "plano" }, { h: "Consultor", k: "consultor" }, { h: "Empresa", k: "empresa_status", map: { active: "ativa", inactive: "inativa" } }, { h: "Por que está fora", k: "motivo_fora", tl: true }, { h: "Cobrança", k: "descricao", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.recorrencias,
    resumo: (d, f) => { const L = d.linhas; const top5 = L.slice(0, 5); const maior = L[0];
      if (f.grupo === "fora") return [T("Clientes fora do MRR", d.total), T("Valor cadastrado", brl(d.soma)), por("Por motivo", L, "motivo_fora"), T("Empresa inativa", L.filter((l) => l.empresa_status !== "active").length)];
      return [T("Clientes", d.total), T("Mensalidades", brl(d.soma)), T("Média por cliente", brl(mediaDe(d))), T(maior ? `Maior: ${nomeCurto(maior.empresa)}` : "Maior cliente", maior ? fp(maior.pct) : "-", maior ? brl(maior.valor) : undefined), T("Top 5 concentram", fp(top5.length ? soma(top5, (l) => l.pct) : null)), porValor("Por consultor", L, "consultor", "valor")]; },
    colsF: (f) => (f.grupo === "fora" ? ord(S_COLS("mrr_clientes"), ["empresa", "valor", "motivo_fora", "empresa_status", "parcelas_ate"], ["pct"]) : ord(S_COLS("mrr_clientes"), [], ["motivo_fora", "empresa_status"])) }),
  reunioes_futuras: S("Reuniões na agenda", "Atividades do CRM do tipo reunião, não canceladas, pela data marcada.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Hora", k: "hora" }, { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Closer", k: "closer" }, { h: "SDR", k: "sdr" },
    { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Valor", k: "valor", t: "brl" }, { h: "Situação", k: "status", map: { pending: "marcada", completed: "feita" } }, { h: "Título", k: "titulo", tl: true },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.reunioes,
    resumo: (d, f) => { const L = d.linhas; const umDia = !!f.de && f.de === f.ate; return [T(umDia ? "Reuniões no dia" : "Reuniões", d.total), por("Por closer", L, "closer"), ...(umDia ? [] : [T("Dias com reunião", uniq(L, "dia"))]), T("Sem closer", L.filter((l) => !l.closer).length), T("Valor em jogo", brl(soma(L, (l) => l.valor))), por("Por funil", L, "funil")]; },
    colsF: (f) => (f.de && f.de === f.ate ? fim(S_COLS("reunioes_futuras"), ["dia"]) : S_COLS("reunioes_futuras")) }),
  pipeline_aberto: S("Pipeline aberto", "Leads fora de etapa final e com valor.", [
    { h: "Lead", k: "nome", link: "lead", idk: "lead_id", tl: true }, { h: "Empresa", k: "empresa", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Funil", k: "funil" }, { h: "Etapa", k: "etapa" }, { h: "Dono", k: "dono" },
    { h: "Último movimento", k: "ultimo_movimento", t: "data" }, { h: "Parado há", k: "dias_parado", t: "dias" }, { h: "Criado", k: "criado_em", t: "data" }, { h: "Origem", k: "origem" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.pipeline,
    resumo: (d, f) => {
      const L = d.linhas; const sub = d.total > d.limite ? `mostrando os ${d.limite} maiores` : undefined;
      const parados = (n: number) => L.filter((l) => l.dias_parado > n);
      if (f.grupo === "parado") return [T("Leads parados", d.total, sub), T("Valor", brl(d.soma)), T("Parados há mais de 180 dias", parados(180).length, brl(soma(parados(180), (l) => l.valor))), por("Por dono", L, "dono"), porValor("Por funil", L, "funil", "valor")];
      if (f.stage_id) return [T("Leads na etapa", d.total, sub), T("Valor", brl(d.soma)), T("Parados há mais de 30 dias", parados(30).length, brl(soma(parados(30), (l) => l.valor))), T("Sem dono", L.filter((l) => !l.dono).length), porValor("Por dono", L, "dono", "valor")];
      return [T("Leads abertos", d.total, sub), T("Valor", brl(d.soma)), T("Parados há mais de 30 dias", parados(30).length, brl(soma(parados(30), (l) => l.valor))), porValor("Por funil", L, "funil", "valor"), por("Por dono", L, "dono")];
    },
    colsF: (f) => (f.stage_id ? fim(S_COLS("pipeline_aberto"), ["funil", "etapa"]) : f.grupo === "parado" ? ord(S_COLS("pipeline_aberto"), ["nome", "empresa", "valor", "dias_parado", "ultimo_movimento", "dono"]) : S_COLS("pipeline_aberto")) }),
  leads_atencao: S("Leads recentes", "Leads dos funis que contam entrada, criados nos últimos 14 dias.", C_LEADS_AT, { rpc: "painel_frente_detalhe", nexus: LINK.leads,
    resumo: (d, f) => {
      const L = d.linhas; const velhos = T("Há mais de 2 dias", L.filter((l) => l.dias > 2).length, "sem ninguém pegar");
      if (f.tipo === "sem_dono") return [T("Leads sem dono", d.total), velhos, T("Também sem atividade", L.filter((l) => l.sem_atividade).length), por("Por funil", L, "funil"), por("Por origem", L, "origem")];
      if (f.tipo === "sem_atividade") return [T("Sem primeira atividade", d.total), { ...velhos, sub: "sem ninguém agir" }, T("Sem dono", L.filter((l) => l.sem_dono).length), por("Por dono", L, "dono"), por("Por funil", L, "funil")];
      return [T("Leads novos (7 dias)", d.total), T("Sem dono", L.filter((l) => l.sem_dono).length), T("Sem primeira atividade", L.filter((l) => l.sem_atividade).length), por("Por funil", L, "funil"), por("Por origem", L, "origem")];
    },
    colsF: (f) => (f.tipo === "sem_dono" ? ord(C_LEADS_AT, ["nome", "empresa", "dias", "criado_em", "funil", "etapa", "origem", "sem_atividade", "telefone"], ["dono", "sem_dono"])
      : f.tipo === "sem_atividade" ? ord(C_LEADS_AT, ["nome", "empresa", "dias", "criado_em", "dono", "funil", "etapa", "origem", "sem_dono", "telefone"], ["sem_atividade"]) : C_LEADS_AT) }),
  mrr_movimentos: S("Movimento do MRR", "O que mudou no faturado recorrente de cada cliente contra o mês anterior.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Movimento", k: "tipo", map: { novo: "Novo", reativacao: "Reativação", expansao: "Expansão", contracao: "Contração", churn: "Churn", mantido: "Manteve" } },
    { h: "Mês anterior", k: "antes", t: "brlfull" }, { h: "Neste mês", k: "depois", t: "brlfull" }, { h: "Diferença", k: "delta", t: "brlfull" }, { h: "Consultor", k: "consultor" }, { h: "Empresa hoje", k: "empresa_status", map: { active: "ativa", inactive: "inativa" } },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.recorrencias,
    resumo: (d, f) => {
      const L = d.linhas; const t = str(f.tipo); const antes = soma(L, (l) => l.antes); const depois = soma(L, (l) => l.depois);
      if (t === "churn") return [T("Churn", d.total), T("Mensalidade perdida", brl(antes)), T("Média por cliente", brl(d.total ? antes / d.total : null)), T("Empresa ainda ativa", L.filter((l) => l.empresa_status === "active").length, "parou de faturar, cadastro segue ativo"), porValor("Por consultor", L, "consultor", "antes")];
      if (t === "novo" || t === "reativacao") return [T(ROT_MOV[t], d.total), T("Mensalidade nova", brl(depois)), T("Média por cliente", brl(d.total ? depois / d.total : null)), porValor("Por consultor", L, "consultor", "depois")];
      if (t === "expansao" || t === "contracao") return [T(ROT_MOV[t], d.total), T("Diferença", brl(d.soma)), T("Mês anterior", brl(antes)), T("Neste mês", brl(depois)), porValor("Por consultor", L, "consultor", "delta")];
      if (t === "mantido") return [T("Mantiveram", d.total), T("Mensalidade mantida", brl(depois)), T("Média por cliente", brl(d.total ? depois / d.total : null)), porValor("Por consultor", L, "consultor", "depois")];
      const g = (k: string) => L.filter((l) => l.tipo === k);
      return [T("Clientes com movimento", d.total), T("Saldo do movimento", brl(d.soma)), T("Churn", brl(soma(g("churn"), (l) => l.antes)), `${g("churn").length} clientes`), T("Novo e reativação", brl(soma([...g("novo"), ...g("reativacao")], (l) => l.depois)), `${g("novo").length + g("reativacao").length} clientes`), T("Expansão e contração", brl(soma([...g("expansao"), ...g("contracao")], (l) => l.delta)), `${g("expansao").length} e ${g("contracao").length} clientes`)];
    },
    colsF: (f) => (f.tipo ? fim(S_COLS("mrr_movimentos"), ["tipo"]) : S_COLS("mrr_movimentos")) }),
  renovacoes: S("Fim de contrato", "Contratos de clientes ativos que terminam na janela. Plano mensal renova sozinho.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Fim", k: "fim", t: "data" }, { h: "Em", k: "dias", t: "dias" }, { h: "Tipo", k: "grupo", map: { risco: "Com prazo (risco)", mensal: "Mensal (renova sozinho)" } }, { h: "De onde vem", k: "origem", tl: true },
    { h: "Plano", k: "plano" }, { h: "Início", k: "inicio", t: "data" }, { h: "Valor do contrato", k: "valor", t: "brlfull" }, { h: "Mensalidade ativa", k: "mensalidade", t: "brlfull" }, { h: "Consultor", k: "consultor" }, { h: "Projeto", k: "projeto_status", t: "proj" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.empresas,
    resumo: (d, f) => {
      const L = d.linhas; const N = Number(f.dias || 90); const em30 = L.filter((l) => l.dias <= 30); const mens = T("Mensalidade ativa", brl(soma(L, (l) => l.mensalidade)));
      const prox = N > 30 ? [T("Nos próximos 30 dias", em30.length, brl(soma(em30, (l) => l.mensalidade)))] : [];
      if (f.grupo === "mensal") return [T("Planos mensais", d.total, "renovam sozinhos"), mens, ...prox, por("Por consultor", L, "consultor"), por("Por plano", L, "plano")];
      if (f.grupo === "risco") return [T(`Com prazo em ${N} dias`, d.total), T("Valor em risco", brl(d.soma)), mens, ...prox, porValor("Por consultor", L, "consultor", "valor")];
      const r = L.filter((l) => l.grupo === "risco");
      return [T(`Fim de contrato em ${N} dias`, d.total), T("Com prazo (risco)", r.length, brl(d.soma)), T("Mensais (renovam sozinhos)", L.length - r.length), mens, ...prox];
    },
    colsF: (f) => (f.grupo ? fim(S_COLS("renovacoes"), ["grupo"]) : S_COLS("renovacoes")) }),
  produto_clientes: S("Clientes por produto", "Projetos de cada produto, com consultor e a mensalidade que fatura.", C_PROD_CLI, { rpc: "painel_frente_detalhe", nexus: LINK.empresas,
    resumo: (d, f) => {
      const L = d.linhas; const cli = T("Clientes", uniq(L, "company_id"));
      if (f.grupo === "churn") return [T("Churn do mês", d.total), cli, por("Por motivo", L, "churn_motivo"), por("Por consultor", L, "consultor"), ...(f.produto ? [T("Tempo médio de casa", mesesTxt(media(L.map((l) => ({ m: mesesEntre(l.inicio, l.churn_em) })), "m")))] : [por("Por produto", L, "produto")])];
      if (f.produto) return [T("Projetos do produto", d.total), cli, T("Mensalidades", brl(d.soma)), T("Sem mensalidade no MRR", L.filter((l) => !Number(l.mensalidade)).length, "projeto ativo que não fatura recorrente"), porValor("Por consultor", L, "consultor", "mensalidade")];
      return [T("Projetos", d.total), cli, T("Mensalidades", brl(d.soma)), T("Consultores", uniq(L, "consultor")), porValor("Por produto", L, "produto", "mensalidade")];
    },
    colsF: (f) => (f.grupo === "churn" ? ord(C_PROD_CLI, ["empresa", "churn_em", "churn_motivo", "consultor", "produto", "inicio", "fim", "projeto_status"], ["mensalidade", ...(f.produto ? ["produto"] : [])])
      : fim(ord(C_PROD_CLI, [], ["churn_em", "churn_motivo"]), f.produto ? ["produto"] : [])) }),
  produto_receita: S("Faturas pagas por produto", "Cada fatura paga no mês e o produto a que foi atribuída.", [
    { h: "Cliente", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Produto atribuído", k: "produto" }, { h: "Descrição da fatura", k: "descricao", tl: true }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Recorrente", k: "recorrente", t: "bool" },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.financeiro,
    resumo: (d, f) => { const L = d.linhas; const rec = L.filter((l) => l.recorrente); const av = L.filter((l) => !l.recorrente);
      return [T(f.produto === "Não identificado" ? "Faturas sem produto" : f.produto ? "Faturas do produto" : "Faturas pagas", d.total), T("Recebido", brl(d.soma)), T("Clientes", uniq(L, "company_id")), T("Recorrentes", rec.length, brl(soma(rec, (l) => l.valor))), T("Avulsas", av.length, brl(soma(av, (l) => l.valor))), f.produto ? porValor("Por cliente", L, "empresa", "valor") : porValor("Por produto", L, "produto", "valor")]; },
    colsF: (f) => (f.produto === "Não identificado" ? ord(S_COLS("produto_receita"), ["empresa", "descricao", "valor", "pago_em", "recorrente"], ["produto"]) : f.produto ? fim(S_COLS("produto_receita"), ["produto"]) : S_COLS("produto_receita")) }),
  contas_centro: S("Contas pagas por centro de custo", "Contas a pagar quitadas no mês, com centro de custo e categoria.", [
    { h: "Fornecedor", k: "fornecedor", tl: true }, { h: "Descrição", k: "descricao", tl: true }, { h: "Centro de custo", k: "centro" }, { h: "Categoria", k: "categoria" }, { h: "Valor", k: "valor", t: "brlfull" }, { h: "Pago em", k: "pago_em", t: "data" }, { h: "Vencia em", k: "vencimento", t: "data" }, { h: "Tipo", k: "tipo_custo", map: { fixed: "fixo", variable: "variável" } },
  ], { rpc: "painel_frente_detalhe", nexus: LINK.financeiro,
    resumo: (d, f) => { const L = d.linhas; const sc = L.filter((l) => l.categoria === "Sem categoria");
      if (f.grupo === "sem_categoria") return [T("Contas sem categoria", d.total), T("Pago", brl(d.soma)), T("Fornecedores", uniq(L, "fornecedor")), porValor("Por centro", L, "centro", "valor"), porValor("Por fornecedor", L, "fornecedor", "valor")];
      if (f.centro) return [T("Contas do centro", d.total), T("Pago", brl(d.soma)), T("Sem categoria", sc.length, brl(soma(sc, (l) => l.valor))), porValor("Por categoria", L, "categoria", "valor"), porValor("Por fornecedor", L, "fornecedor", "valor")];
      return [T("Contas pagas", d.total), T("Pago", brl(d.soma)), T("Sem categoria", sc.length, brl(soma(sc, (l) => l.valor))), porValor("Por centro", L, "centro", "valor"), porValor("Por categoria", L, "categoria", "valor")]; },
    colsF: (f) => (f.grupo === "sem_categoria" ? ord(S_COLS("contas_centro"), ["fornecedor", "descricao", "centro", "valor"], ["categoria"]) : f.centro ? fim(S_COLS("contas_centro"), ["centro"]) : S_COLS("contas_centro")) }),
  clientes: S("Clientes", "Empresas com consultor, mensalidade, contrato, health score e NPS.", C_CLIENTES, { nexus: LINK.empresas,
    resumo: (d, f) => {
      const L = d.linhas; const t = str(f.tipo) || "ativos";
      const comScore = L.filter((l) => l.score != null); const hm = T("Health médio", num(media(L, "score")), `${comScore.length} com score`);
      const venc = L.filter((l) => l.vencido > 0); const comVenc = T("Com vencido", venc.length, brl(soma(venc, (l) => l.vencido)));
      const cons = f.consultant_id ? [] : [por("Por consultor", L, "consultor")];
      if (t === "novos") return [T("Clientes novos", d.total), T("Mensalidades", brl(d.soma)), T("Média de mensalidade", brl(mediaDe(d))), por("Por produto", L, "produto"), ...cons];
      if (t === "churn") return [T("Churn", d.total), por("Por motivo", L, "churn_motivo"), por("Por produto", L, "produto"), T("Tempo médio de casa", mesesTxt(media(L.map((l) => ({ m: mesesEntre(l.inicio, l.churn_em) })), "m"))), comVenc, ...cons];
      if (t === "em_aviso") return [T("Em aviso de saída", d.total), T("Mensalidade em risco", brl(d.soma)), hm, comVenc, por("Por produto", L, "produto"), ...cons];
      if (t === "vencendo") { const s7 = L.filter((l) => { const n = emDias(l.fim); return n != null && n <= 7; }); return [T("Contratos vencendo", d.total), T("Mensalidades", brl(d.soma)), T("Em até 7 dias", s7.length, brl(soma(s7, (l) => l.mensalidade))), hm, por("Por plano", L, "plano"), ...cons]; }
      if (t === "health_baixo") return [T("Health baixo", d.total), T("Críticos", L.filter((l) => l.nivel === "critical").length), T("Em risco", L.filter((l) => l.nivel === "at_risk").length), T("Piorando", L.filter((l) => PIORANDO.includes(str(l.tendencia))).length), T("Mensalidade em risco", brl(d.soma)), ...cons];
      return [T(f.nivel ? `Clientes ${nivelLabel(str(f.nivel)).toLowerCase()}` : "Clientes ativos", d.total), T("Mensalidades", brl(d.soma)), ...(f.nivel ? [] : [hm]), T("Em aviso de saída", L.filter((l) => EM_AVISO.includes(str(l.projeto_status))).length), comVenc, ...cons];
    },
    colsF: (f) => {
      const t = str(f.tipo) || "ativos"; const semChurn = ["churn_em", "churn_motivo"]; const semCons = f.consultant_id ? ["consultor"] : [];
      if (t === "novos") return fim(ord(C_CLIENTES, ["empresa", "inicio", "produto", "plano", "mensalidade", "consultor", "fim"], semChurn), semCons);
      if (t === "churn") return fim(ord(C_CLIENTES, ["empresa", "churn_em", "churn_motivo", "produto", "consultor", "inicio", "plano", "vencido"], ["mensalidade", "score", "nivel", "tendencia", "tarefas_atrasadas"]), semCons);
      if (t === "em_aviso") return fim(ord(C_CLIENTES, ["empresa", "projeto_status", "mensalidade", "consultor", "produto", "fim", "score", "nivel"], semChurn), semCons);
      if (t === "vencendo") return fim(ord(C_CLIENTES, ["empresa", "fim", "plano", "mensalidade", "consultor", "produto", "score"], semChurn), semCons);
      if (t === "health_baixo") return fim(ord(C_CLIENTES, ["empresa", "score", "nivel", "tendencia", "consultor", "mensalidade", "tarefas_atrasadas", "nps", "vencido"], semChurn), semCons);
      return fim(ord(C_CLIENTES, [], semChurn), [...semCons, ...(f.nivel ? ["nivel"] : [])]);
    } }),
  tarefas_atrasadas: S("Tarefas atrasadas", "Tarefas pendentes ou em andamento com prazo vencido, em clientes ativos.", [
    { h: "Tarefa", k: "titulo", tl: true }, { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Responsável", k: "responsavel" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Atraso", k: "dias", t: "dias" }, { h: "Prioridade", k: "prioridade" }, { h: "Situação", k: "status" },
  ], { resumo: (d, f) => [T("Tarefas atrasadas", d.total), T("Mais de 30 dias", d.linhas.filter((l) => l.dias > 30).length), T("Atraso médio", dias(media(d.linhas, "dias"))), T("Empresas", uniq(d.linhas, "company_id")), f.staff_id ? por("Por empresa", d.linhas, "empresa") : por("Por responsável", d.linhas, "responsavel")],
    colsF: (f) => (f.staff_id ? fim(S_COLS("tarefas_atrasadas"), ["responsavel"]) : S_COLS("tarefas_atrasadas")), nexus: LINK.tarefas }),
  nps: S("NPS do mês", "Respostas de NPS dos clientes.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Nota", k: "nota", t: "int" }, { h: "Data", k: "data", t: "data" }, { h: "Quem", k: "respondente" }, { h: "Consultor", k: "consultor" }, { h: "O que melhorar", k: "melhorar", tl: true }, { h: "Comentário", k: "feedback", tl: true },
  ], { resumo: (d) => [T("Respostas", d.total), T("Média", num(d.media)), T("Detratores (0 a 6)", d.linhas.filter((l) => l.nota <= 6).length), T("Promotores (9 e 10)", d.linhas.filter((l) => l.nota >= 9).length)] }),
  csat: S("CSAT do mês", "Notas de satisfação por reunião (1 a 5).", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Nota", k: "nota", t: "int" }, { h: "Data", k: "data", t: "data" }, { h: "Quem", k: "respondente" }, { h: "Consultor", k: "consultor" }, { h: "Comentário", k: "feedback", tl: true },
  ], { resumo: (d) => [T("Respostas", d.total), T("Média", num(d.media)), T("Nota 3 ou menos", d.linhas.filter((l) => l.nota <= 3).length)] }),
  checkup: S("Checkup do produto, hoje", "Itens do checkup diário: pendentes primeiro.", [
    { h: "Bloco", k: "bloco" }, { h: "Item", k: "titulo", tl: true }, { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Responsável", k: "responsavel" }, { h: "Tratado em", k: "tratado_em", t: "datahora" }, { h: "Nota", k: "nota", tl: true },
  ], { resumo: (d) => [T("Pendentes", d.total), T("Itens no dia", d.linhas.length)], nexus: LINK.checkup }),
  conversas_esperando: S("Conversas esperando resposta", "Última mensagem foi do cliente ou lead e ninguém respondeu.", [
    { h: "Contato", k: "nome", link: "conversa", idk: "conversation_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Esperando há", k: "horas", t: "horas" }, { h: "Desde", k: "desde", t: "datahora" }, { h: "Atendente", k: "atendente" }, { h: "Número", k: "instancia" }, { h: "Funil", k: "funil" }, { h: "Última mensagem", k: "ultima", tl: true },
  ], { resumo: (d, f) => { const L = d.linhas; const h = (n: number) => L.filter((l) => l.horas >= n).length; const semAt = T("Sem atendente", L.filter((l) => !l.atendente).length);
      if (f.mais_24h) return [T("Sem resposta há mais de 24 h", d.total, subLimite(d)), T("Mais de 3 dias", h(72)), T("Mais de 7 dias", h(168)), semAt, por("Por atendente", L, "atendente"), por("Por número", L, "instancia")];
      return [T("Conversas esperando", d.total, subLimite(d)), T("Mais de 24 h", h(24)), T("Mais de 7 dias", h(168)), semAt, por("Por atendente", L, "atendente")]; }, nexus: LINK.inbox }),
  conversas: S("Conversas do mês", "Conversas de WhatsApp com mensagem no mês.", [
    { h: "Contato", k: "nome", link: "conversa", idk: "conversation_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Última em", k: "ultima_em", t: "datahora" }, { h: "Direção", k: "direcao" }, { h: "Atendente", k: "atendente" }, { h: "Número", k: "instancia" }, { h: "Não lidas", k: "nao_lidas", t: "int" }, { h: "Última mensagem", k: "ultima", tl: true },
  ], { resumo: (d) => [T("Conversas", d.total, d.total > d.limite ? `mostrando ${d.limite} mais recentes` : undefined)], nexus: LINK.inbox }),
  ia_dia: S("Custo de IA por dia", "Estimativa em dólar a partir dos tokens medidos.", [
    { h: "Dia", k: "dia", t: "data" }, { h: "Custo", k: "custo", t: "usd" }, { h: "Chamadas", k: "chamadas", t: "int" }, { h: "Tokens entrada", k: "entrada", t: "int" }, { h: "Tokens saída", k: "saida", t: "int" }, { h: "Cache lido", k: "cache_lido", t: "int" }, { h: "Funções", k: "funcoes", tl: true },
  ], { resumo: (d) => [T("Dias", d.total), T("Custo", usd(d.soma)), T("Média por dia", usd(mediaDe(d))), T("Pior dia", usd(Math.max(0, ...d.linhas.map((l) => Number(l.custo) || 0)))), T("Chamadas", soma(d.linhas, (l) => l.chamadas))],
    colsF: (f) => (f.fn ? fim(S_COLS("ia_dia"), ["funcoes"]) : S_COLS("ia_dia")), nexus: LINK.custoIa }),
  agente_runs: S("Ações dos agentes de IA", "Cada execução de agente: resposta automática, follow-up ou resgate.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Agente", k: "agente", tl: true }, { h: "Lead", k: "lead", link: "conversa", idk: "conversation_id", tl: true }, { h: "Canal", k: "canal" }, { h: "Modo", k: "modo" }, { h: "Resultado", k: "outcome" }, { h: "Resposta", k: "resposta", tl: true },
  ], { resumo: (d, f) => {
      const L = d.linhas; const sent = L.filter((l) => str(l.outcome).startsWith("sent")).length;
      const lbl = f.outcome === "opt_out" ? "Pedidos de opt-out" : f.mode === "auto" ? "Respostas automáticas" : f.mode === "followup" ? "Follow-ups enviados" : f.outcome === "sent" ? "Mensagens enviadas" : f.agent_id ? "Ações do agente" : "Execuções";
      const out = [T(lbl, d.total, subLimite(d))];
      if (f.outcome !== "sent" && f.outcome !== "opt_out") out.push(T("Enviadas", sent, fp(L.length ? sent / L.length : null)), T("Com erro", L.filter((l) => l.erro).length));
      out.push(T("Conversas", uniq(L, "conversation_id")));
      if (!f.agent_id) out.push(por("Por agente", L, "agente"));
      if (!f.mode) out.push(por("Por modo", L, "modo"));
      out.push(por("Por canal", L, "canal"));
      return out.slice(0, 6);
    },
    colsF: (f) => fim(S_COLS("agente_runs"), [...(f.agent_id ? ["agente"] : []), ...(f.mode ? ["modo"] : []), ...(f.outcome ? ["outcome"] : [])]), nexus: LINK.agentes }),
  wa_numeros: S("WhatsApp oficial por número", "Mensagens enviadas pela API oficial e custo estimado pelo preço por mensagem.", [
    { h: "Número", k: "nome", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Status", k: "status" }, { h: "Mensagens", k: "msgs", t: "int" }, { h: "Pela IA", k: "msgs_ia", t: "int" }, { h: "Conversas", k: "conversas", t: "int" }, { h: "Preço", k: "preco", t: "brlfull" }, { h: "Custo", k: "custo", t: "brlfull" },
  ], { resumo: (d) => [T("Números", d.total), T("Custo estimado", brl(d.soma)), T("Mensagens", soma(d.linhas, (l) => l.msgs))], nexus: LINK.custoIa }),
  wa_templates: S("Disparos por template", "Campanhas da API oficial criadas no mês.", [
    { h: "Template", k: "template", tl: true }, { h: "Categoria", k: "categoria" }, { h: "Envios", k: "total", t: "int" }, { h: "Status", k: "status" }, { h: "Criado", k: "data", t: "datahora" }, { h: "Terminou", k: "fim", t: "datahora" }, { h: "Por", k: "criado_por" }, { h: "Número", k: "numero" }, { h: "Prévia", k: "previa", tl: true },
  ], { resumo: (d) => [T("Disparos", d.total), T("Envios", num(d.soma, 0))], nexus: LINK.disparos }),
  automacoes: S("Automações e agentes", "Tudo que roda sem passar por você, com execuções no mês.", [
    { h: "Nome", k: "nome", tl: true }, { h: "Tipo", k: "tipo" }, { h: "Gatilho", k: "gatilho", tl: true }, { h: "Ativa", k: "ativa", t: "bool" }, { h: "Execuções no mês", k: "runs_mes", t: "int" }, { h: "Total", k: "runs_total", t: "int" }, { h: "Última", k: "ultima_execucao", t: "datahora" },
  ], { resumo: (d) => [T("Cadastradas", d.total), T("Ativas", d.linhas.filter((l) => l.ativa).length), T("Execuções no mês", soma(d.linhas, (l) => l.runs_mes))], nexus: LINK.automacoes }),
  automacao_runs: S("Execuções de automação", "Automações do CRM e regras do Nexus que rodaram no mês.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Automação", k: "automacao", tl: true }, { h: "Tipo", k: "tipo" }, { h: "Lead", k: "lead", link: "lead", idk: "lead_id", tl: true }, { h: "Atribuído a", k: "atribuido" }, { h: "Resultado", k: "resultado", tl: true },
  ], { resumo: (d) => [T("Execuções", d.total)], nexus: LINK.automacoes }),
  cobrancas: S("Cobranças automáticas", "Mensagens da régua de cobrança enviadas no mês.", [
    { h: "Empresa", k: "empresa", link: "empresa", idk: "company_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Quando", k: "data", t: "datahora" }, { h: "Status", k: "status" }, { h: "Fatura", k: "valor", t: "brlfull" }, { h: "Vencimento", k: "vencimento", t: "data" }, { h: "Fatura hoje", k: "fatura_status" }, { h: "Mensagem", k: "mensagem", tl: true },
  ], { resumo: (d) => [T("Mensagens", d.total), T("Empresas", uniq(d.linhas, "company_id")), T("Faturas já pagas", d.linhas.filter((l) => l.fatura_status === "paid").length)], nexus: LINK.financeiro }),
  lembretes: S("Lembretes de reunião", "Lembretes automáticos enviados ao lead antes da reunião.", [
    { h: "Quando", k: "data", t: "datahora" }, { h: "Lead", k: "lead", link: "lead", idk: "lead_id", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Número", k: "instancia" }, { h: "Status", k: "status" }, { h: "Mensagem", k: "mensagem", tl: true }, { h: "Erro", k: "erro", tl: true },
  ], { resumo: (d) => [T("Lembretes", d.total)] }),
  equipe: S("Equipe", "Staff ativo da UNV.", [
    { h: "Nome", k: "nome", tl: true }, { h: "Papel", k: "papel", t: "papel" }, { h: "E-mail", k: "email", tl: true }, { h: "Telefone", k: "telefone" }, { h: "Admissão", k: "admissao", t: "data" }, { h: "Closer", k: "closer", t: "bool" }, { h: "Clientes", k: "empresas", t: "int" }, { h: "Tarefas atrasadas", k: "tarefas_atrasadas", t: "int" }, { h: "Leads no mês", k: "leads_mes", t: "int" },
  ], { resumo: (d) => [T("Pessoas", d.total)], nexus: LINK.equipe }),
};

/** colunas base de um bloco (pra `colsF` reordenar sem repetir a lista) */
function S_COLS(bloco: string): ColSpec[] { return SPECS[bloco]?.cols ?? []; }

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
  // colunas conforme o que foi clicado: o recorte vem primeiro, coluna constante vai pro fim
  const cols = useMemo<ColSpec[]>(() => (spec?.colsF ? spec.colsF(filtro ?? {}) : spec?.cols ?? []), [bloco, filtroKey]);

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
  const colsFiltro = cols.filter((c) => !c.t && !c.link && ["closer", "sdr", "funil", "consultor", "atendente", "agente", "responsavel", "categoria", "status", "origem", "tipo", "modo", "outcome", "canal", "dono", "etapa", "plano", "instancia", "numero", "bloco", "nivel", "papel", "forma", "banco", "campanha", "produto", "conjunto", "objetivo", "classe", "motivo_r", "centro", "grupo", "resultado", "motivo_fora", "empresa_status", "projeto_status"].includes(c.k));
  const optsCol = useMemo(() => {
    if (!d) return [] as { value: string; label: string }[];
    const out: { value: string; label: string }[] = [];
    colsFiltro.forEach((c) => {
      const vals = [...new Set(d.linhas.map((l) => l[c.k]).filter((v) => v != null && v !== ""))].map(String).sort();
      if (vals.length > 1 && vals.length <= 60) vals.forEach((v) => out.push({ value: `${c.k}=${v}`, label: `${c.h}: ${c.map?.[v] ?? v}` }));
    });
    return out;
  }, [d, cols]);

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
          {spec.resumo && <div className="kg">{spec.resumo(d, filtro ?? {}).map((t, i) => <Tile key={i} label={t.label} valor={t.valor} sub={t.sub} />)}</div>}
          <div className="p wide">
            <div className="h"><b>Registros</b><span>{linhas.length === d.total ? `${d.total} ${d.total === 1 ? "linha" : "linhas"}` : `${linhas.length} de ${d.total} linhas`}{d.total > d.limite ? `. Limite de ${d.limite} por tela` : ""}. {spec.drill && det ? `Clique na linha pra abrir ${spec.drillTxt ?? "o detalhe"}.` : "Clique no nome pra abrir no Nexus."}</span></div>
            <Tabela
              onRow={spec.drill && det ? (i) => { const x = spec.drill!(linhas[i], filtro ?? {}); if (x) det(x.bloco, x.filtro, x.titulo); } : undefined}
              cols={cols.map((c) => ({ h: c.h, tl: c.tl }))}
              rows={linhas.map((l) => cols.map((c) => {
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
