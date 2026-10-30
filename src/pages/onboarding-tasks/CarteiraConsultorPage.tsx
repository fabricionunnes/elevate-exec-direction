// Carteira do consultor: quanto cada empresa vale por mês, com contrato anual
// já dividido pelos meses. Mesma linguagem visual do Painel de Controle.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import "@/components/painel-controle/painel.css";
import { Tile, Panel, Tabela, Barras, BarrasItens, Combo, Lk, Nd, St } from "@/components/painel-controle/ui";
import { brl, brlFull, dataBR, mesAno, plural } from "@/components/painel-controle/fmt";

interface LinhaCarteira {
  consultant_id: string;
  consultant_name: string;
  company_id: string;
  company_name: string;
  project_id: string;
  product_name: string | null;
  monthly_cents: number;
  origem: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_months: number | null;
  commission_max_cents: number;
  project_status: string;
  contrato_vencido: boolean;
  dias_para_vencer: number | null;
  recorrente: boolean;
  proxima_renovacao: string | null;
  plano: string;
  saindo: boolean;
  retido: boolean;
  cancelamento_solicitado: string | null;
  dias_comissionados: number | null;
  dias_do_mes: number | null;
  comissao_cents: number | null;
  comissao_cheia_cents: number | null;
  vence_em_dias: number | null;
  vendido_por: string | null;
  vendido_por_nome: string | null;
  comissao_venda_cents: number | null;
  fator_pago: number | null;
  nao_pago_cents: number | null;
  venda_primeiro_mes: boolean;
  atraso_pago_cents: number | null;
}

// Só o master recebe isso: a RPC devolve vazio para qualquer outro papel.
interface LinhaComissao {
  consultant_id: string;
  consultant_name: string;
  papel: string;
  contratos: number;
  clientes: number;
  saindo: number;
  carteira_cents: number;
  base_cents: number;
  nao_pago_cents: number;
  atraso_pago_cents: number;
  piso_cents: number;
  percentual: number;
  teto_cents: number | null;
  variavel_cents: number;
  variavel_cheia_cents: number;
  perdido_cents: number;
  vendas: number;
  carteira_vendida_cents: number;
  venda_cents: number;
  total_cents: number;
  acima_teto: boolean;
  peso: number | null;
  percentual_venda: number | null;
  percentual_venda_unica: number | null;
}

interface Config {
  id: string;
  consultant_id: string | null;
  piso_cents: number;
  percentual: number;
  teto_cents: number | null;
  percentual_venda: number;
  percentual_venda_unica: number;
  produtos_sem_venda: string[] | null;
}

// chave "padrao" é a regra que vale pra quem não tem ajuste próprio
const PADRAO = "padrao";

interface Fatura {
  company_id: string;
  company_name: string;
  consultant_name: string | null;
  descricao: string;
  valor_cents: number;
  vencimento: string;
  status: string;
  pago_em: string | null;
  dias_atraso: number | null;
}

// Regra do dono: clicou no card, o detalhe mostra EXATAMENTE aquilo que foi
// clicado, nada além. Por isso cada foco carrega o próprio recorte.
type Drill =
  | { tipo: "contratos"; titulo: string; sub: string; linhas: LinhaCarteira[] }
  | { tipo: "faturas"; titulo: string; sub: string; filtro?: (f: Fatura) => boolean }
  | null;

interface LinhaHistorico {
  mes: string;
  faturado_cents: number;
  recebido_cents: number;
  comissao_cents: number;
  clientes: number;
}

// Sinais por contrato pra análise de risco e oportunidade (RPC carteira_analise, 30/10/2026)
interface LinhaAnalise {
  consultant_id: string; company_id: string; company_name: string; project_id: string; product_name: string | null;
  monthly_cents: number; saindo: boolean; retido: boolean; recorrente: boolean; plano: string;
  contract_start_date: string | null; contract_end_date: string | null; vence_em_dias: number | null; tem_success_fee: boolean;
  health_score: number | null; health_risk: string | null; health_trend: string | null;
  churn_prob: number | null; churn_risk: string | null; churn_factors: any; churn_actions: any;
  nps_score: number | null; nps_date: string | null;
  tarefas_atrasadas: number; tarefas_abertas: number;
  ultima_reuniao: string | null; reunioes_90d: number; noshows_90d: number;
  wa_rag: string | null; wa_last: string | null; wa_msgs_7d: number;
  inadimplente_cents: number;
  meta_nome: string | null; meta_alvo: number | null; meta_realizado: number | null;
  produtos: string[]; segmento: string | null; meses_cliente: number;
}

interface EmpresaAnalise {
  id: string; nome: string; consultor: string; consultorId: string; mensal: number; produtos: string[];
  saindo: boolean; risco: number; nivel: "alto" | "atencao" | "ok"; sinais: string[]; acao: string;
  health: number | null; churn: number | null; nps: number | null; atrasadas: number; diasSemReuniao: number | null;
  wa: string | null; inad: number; metaPct: number | null; metaNome: string | null; meses: number; venceEm: number | null;
  temFee: boolean; temMeta: boolean; fatores: string[]; acoesIA: string[]; segmento: string | null;
}

interface Oportunidade {
  empresa: EmpresaAnalise; oferta: string; porque: string; valor: number; tipo: "novo" | "reajuste" | "fee" | "protecao"; produtoVenda: string | null;
}

// preço de referência quando a carteira não tem mediana daquele produto
const REF_PRECO: Record<string, number> = { "UNV Ads": 500, "UNV Social": 1500, "CRM": 400, "UNV Sales Acceleration": 1500, "UNV Partners": 2000 };
// tabela de preço manda sobre a mediana: UNV Social é R$1.500 ou R$2.000 (Fabrício, 30/10); os R$1.000 da carteira são acordos antigos
const TABELA_PRECO: Record<string, number> = { "UNV Social": 1500 };

const diasDesde = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + (d.length === 10 ? "T12:00:00" : "")).getTime()) / 86400000) : null);

const rotuloStatus: Record<string, string> = {
  active: "ativo",
  cancellation_signaled: "sinalizou cancelamento",
  notice_period: "em aviso",
};

export default function CarteiraConsultorPage() {
  const navigate = useNavigate();
  const { currentStaff, isMaster, loading: carregandoPerm } = useStaffPermissions();
  const [linhas, setLinhas] = useState<LinhaCarteira[]>([]);
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const [comissao, setComissao] = useState<LinhaComissao[]>([]);
  const [erroComissao, setErroComissao] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({
    piso: "",
    pct: "",
    pctVenda: "",
    pctVendaUnica: "",
    teto: "",
    semVenda: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [drill, setDrill] = useState<Drill>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [consultor, setConsultor] = useState("");
  const [consultores, setConsultores] = useState<{ value: string; label: string }[]>([]);
  const [mesFoco, setMesFoco] = useState("");
  const [analise, setAnalise] = useState<LinhaAnalise[]>([]);
  const [focoEmpresa, setFocoEmpresa] = useState<string | null>(null);

  const podeFiltrar = isMaster || currentStaff?.role === "admin";

  useEffect(() => {
    if (carregandoPerm || !podeFiltrar) return;
    (async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("is_active", true)
        .in("role", ["consultant", "master", "admin"])
        .order("name");
      setConsultores((data || []).map((s: any) => ({ value: s.id, label: s.name })));
    })();
  }, [carregandoPerm, podeFiltrar]);

  useEffect(() => {
    if (carregandoPerm) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const alvo = consultor || null;
      const [carteira, hist, com, ana] = await Promise.all([
        supabase.rpc("carteira_consultores", { p_consultant_id: alvo }),
        supabase.rpc("carteira_consultores_historico", { p_consultant_id: alvo, p_meses: 12 }),
        supabase.rpc("carteira_comissao_resumo", { p_consultant_id: alvo }),
        (supabase as any).rpc("carteira_analise", { p_consultant_id: alvo }),
      ]);
      if (cancelado) return;
      if (ana.error) console.error("carteira_analise", ana.error);
      setAnalise((ana.data || []) as LinhaAnalise[]);
      setFocoEmpresa(null);
      if (carteira.error) console.error("carteira_consultores", carteira.error);
      if (hist.error) console.error("carteira_consultores_historico", hist.error);
      // a RPC de comissão devolve vazio pra quem não é master. Erro aqui não trava
      // a tela, mas aparece no painel: esconder em silêncio já me custou tempo.
      if (com.error) console.error("carteira_comissao_resumo", com.error);
      setErroComissao(com.error ? com.error.message || String(com.error) : null);
      setComissao((com.data || []) as LinhaComissao[]);
      const h = (hist.data || []) as LinhaHistorico[];
      setLinhas((carteira.data || []) as LinhaCarteira[]);
      setHistorico(h);
      const comDado = h.filter((x) => Number(x.faturado_cents) > 0);
      setMesFoco(comDado.length ? comDado[comDado.length - 1].mes : h[h.length - 1]?.mes || "");
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [consultor, carregandoPerm, recarregar]);

  // Os parâmetros ficam na config: a linha de consultant_id nulo é o padrão e
  // cada consultor pode ter a própria linha por cima. Só o master lê.
  useEffect(() => {
    if (carregandoPerm || !isMaster) return;
    (async () => {
      const { data } = await supabase
        .from("consultant_commission_config" as any)
        .select(
          "id, consultant_id, piso_cents, percentual, teto_cents, percentual_venda, percentual_venda_unica, produtos_sem_venda",
        );
      const mapa: Record<string, Config> = {};
      ((data || []) as Config[]).forEach((c) => {
        mapa[c.consultant_id || PADRAO] = c;
      });
      setConfigs(mapa);
    })();
  }, [carregandoPerm, isMaster, recarregar]);

  const config = configs[PADRAO] || null;

  // lista de produtos pra escolher quais ficam fora da comissão de venda
  useEffect(() => {
    if (carregandoPerm || !isMaster) return;
    (async () => {
      const { data } = await supabase
        .from("onboarding_projects")
        .select("product_name")
        .not("product_name", "is", null);
      const nomes = Array.from(new Set(((data || []) as any[]).map((p) => p.product_name as string)));
      setProdutos(nomes.sort((a, b) => a.localeCompare(b, "pt-BR")));
    })();
  }, [carregandoPerm, isMaster]);

  useEffect(() => {
    if (drill?.tipo !== "faturas") return;
    let cancelado = false;
    (async () => {
      setCarregandoFaturas(true);
      const { data, error } = await supabase.rpc("carteira_faturas", {
        p_consultant_id: consultor || null,
        p_mes: mesFoco || null,
      });
      if (cancelado) return;
      if (error) console.error("carteira_faturas", error);
      setFaturas((data || []) as Fatura[]);
      setCarregandoFaturas(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [drill, consultor, mesFoco]);

  // abre o formulário com o que já vale pra aquela pessoa, mesmo que ela ainda
  // não tenha linha própria: assim o master edita a partir do número real.
  const abrirEdicao = (alvo: string) => {
    const c = configs[alvo] || configs[PADRAO];
    const linha = alvo === PADRAO ? null : comissao.find((x) => x.consultant_id === alvo);
    setForm({
      piso: String(Number(c?.piso_cents ?? (linha ? linha.piso_cents : 0)) / 100),
      pct: String(c?.percentual ?? linha?.percentual ?? ""),
      pctVenda: String(c?.percentual_venda ?? linha?.percentual_venda ?? ""),
      pctVendaUnica: String(c?.percentual_venda_unica ?? linha?.percentual_venda_unica ?? ""),
      teto: c?.teto_cents == null ? "" : String(Number(c.teto_cents) / 100),
      semVenda: (configs[PADRAO]?.produtos_sem_venda || []).join(", "),
    });
    setEditando(alvo);
  };

  const voltarAoPadrao = async (alvo: string) => {
    const atual = configs[alvo];
    if (!atual) return;
    setSalvando(true);
    const { error } = await supabase
      .from("consultant_commission_config" as any)
      .delete()
      .eq("id", atual.id);
    setSalvando(false);
    if (error) {
      console.error("config comissão", error);
      return;
    }
    setEditando(null);
    setRecarregar((n) => n + 1);
  };

  const salvarConfig = async () => {
    if (!editando) return;
    const piso = Math.round(Number(form.piso.replace(",", ".")) * 100);
    const pct = Number(form.pct.replace(",", "."));
    const pctVenda = Number(form.pctVenda.replace(",", "."));
    const pctVendaUnica = Number(form.pctVendaUnica.replace(",", ".") || "0");
    const teto = form.teto.trim() === "" ? null : Math.round(Number(form.teto.replace(",", ".")) * 100);
    if (!Number.isFinite(piso) || !Number.isFinite(pct) || !Number.isFinite(pctVenda)) return;

    const campos: Record<string, unknown> = {
      piso_cents: piso,
      percentual: pct,
      percentual_venda: pctVenda,
      percentual_venda_unica: Number.isFinite(pctVendaUnica) ? pctVendaUnica : 0,
      teto_cents: teto,
      updated_at: new Date().toISOString(),
    };
    // a lista de produtos sem comissão de venda é da empresa toda, não de uma pessoa
    if (editando === PADRAO) {
      campos.produtos_sem_venda = form.semVenda.split(",").map((x) => x.trim()).filter(Boolean);
    }

    setSalvando(true);
    const atual = configs[editando];
    const tabela = supabase.from("consultant_commission_config" as any);
    // upsert não serve: o índice de unicidade do consultor é parcial
    const { error } = atual
      ? await tabela.update(campos).eq("id", atual.id)
      : await tabela.insert({ ...campos, consultant_id: editando });
    setSalvando(false);
    if (error) {
      console.error("config comissão", error);
      return;
    }
    setEditando(null);
    setRecarregar((n) => n + 1);
  };

  const total = useMemo(() => linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100, [linhas]);
  const successFee = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0) / 100,
    [linhas],
  );
  const empresas = useMemo(() => new Set(linhas.map((l) => l.company_id)).size, [linhas]);
  const ticket = linhas.length ? total / linhas.length : 0;
  const vencidos = useMemo(() => linhas.filter((l) => l.contrato_vencido), [linhas]);
  // Fim de contrato nos próximos 30 dias, mensal incluído: o mensal não vence,
  // mas a data de fim dele é a renovação e não pode passar batido.
  const vencendo = useMemo(
    () =>
      linhas
        .filter((l) => l.vence_em_dias !== null && l.vence_em_dias >= 0 && l.vence_em_dias <= 30)
        .sort((a, b) => Number(a.vence_em_dias) - Number(b.vence_em_dias)),
    [linhas],
  );
  const recorrentes = useMemo(() => linhas.filter((l) => l.recorrente).length, [linhas]);
  // quem pediu pra sair e não foi retido. O status do cadastro atrasa, então
  // quem manda é a data do pedido de cancelamento.
  const saindo = useMemo(() => linhas.filter((l) => l.saindo), [linhas]);
  const retidos = useMemo(() => linhas.filter((l) => l.retido), [linhas]);
  const valorEmRisco = useMemo(
    () => saindo.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100,
    [saindo],
  );

  const comissaoTotal = useMemo(
    () => comissao.reduce((s, c) => s + Number(c.total_cents || 0), 0) / 100,
    [comissao],
  );
  const vendaTotal = useMemo(
    () => comissao.reduce((s, c) => s + Number(c.venda_cents || 0), 0) / 100,
    [comissao],
  );
  const perdidoTotal = useMemo(
    () => comissao.reduce((s, c) => s + Number(c.perdido_cents || 0), 0) / 100,
    [comissao],
  );
  // Quem pode ver a comissão é decidido no banco (master, ou consultor com
  // ve_comissao ligado). A tela só reflete: se veio valor, mostra.
  const veComissao = useMemo(
    () => comissao.length > 0 || linhas.some((l) => l.comissao_cents != null),
    [comissao, linhas],
  );
  // A tabela de parâmetros tem RLS de master. Quem não é master lê piso e
  // percentuais da própria linha do resumo, senão a tela escreveria "piso R$ 0".
  const params = useMemo(() => {
    if (config) {
      return {
        piso: Number(config.piso_cents) / 100,
        pct: Number(config.percentual),
        pctVenda: Number(config.percentual_venda ?? 0),
        pctVendaUnica: Number(config.percentual_venda_unica ?? 0),
        semVenda: config.produtos_sem_venda || [],
      };
    }
    const c = comissao[0];
    if (!c) return null;
    return {
      piso: Number(c.piso_cents) / 100,
      pct: Number(c.percentual),
      pctVenda: Number(c.percentual_venda ?? 0),
      pctVendaUnica: Number(c.percentual_venda_unica ?? 0),
      semVenda: [] as string[],
    };
  }, [config, comissao]);

  const soConsultores = useMemo(() => comissao.filter((c) => c.papel === "consultant"), [comissao]);
  const mediaConsultores = soConsultores.length
    ? soConsultores.reduce((s, c) => s + Number(c.total_cents || 0), 0) / 100 / soConsultores.length
    : 0;
  const comissaoPorConsultor = useMemo(() => {
    const m = new Map<string, LinhaComissao>();
    comissao.forEach((c) => m.set(c.consultant_id, c));
    return m;
  }, [comissao]);

  // ---------------------------------------------------------------- análise: risco e oportunidade
  // Fabrício (30/10/2026): "como o consultor faz pra ganhar mais, o que tem que ficar atento pra não
  // perder cliente, e oferecer novos serviços pra aumentar a receita de cada cliente".
  const medianaProduto = useMemo(() => {
    const m = new Map<string, number[]>();
    linhas.forEach((l) => { if (l.product_name && Number(l.monthly_cents) > 0) m.set(l.product_name, [...(m.get(l.product_name) || []), Number(l.monthly_cents) / 100]); });
    const out = new Map<string, number>();
    m.forEach((v, k) => { const s = v.sort((a, b) => a - b); out.set(k, s[Math.floor(s.length / 2)]); });
    return out;
  }, [linhas]);
  const precoRef = (produto: string) => TABELA_PRECO[produto] || medianaProduto.get(produto) || REF_PRECO[produto] || 0;
  // Comissão de uma oportunidade: produto fora da recorrência (UNV Social) paga só venda única, uma vez, no 1º mês;
  // os demais pagam entrega + venda todo mês.
  const comissaoDe = (o: Oportunidade): { mensal: number; unica: number } => {
    if (!params || !o.valor) return { mensal: 0, unica: 0 };
    const semRecorrencia = !!o.produtoVenda && (params.semVenda || []).includes(o.produtoVenda);
    if (semRecorrencia) return { mensal: 0, unica: o.valor * (params.pctVendaUnica || 0) / 100 };
    return { mensal: o.valor * (params.pct + (o.produtoVenda ? params.pctVenda : 0)) / 100, unica: 0 };
  };

  const empresasAnalise = useMemo((): EmpresaAnalise[] => {
    const porEmpresa = new Map<string, LinhaAnalise[]>();
    analise.forEach((a) => porEmpresa.set(a.company_id, [...(porEmpresa.get(a.company_id) || []), a]));
    const out: EmpresaAnalise[] = [];
    porEmpresa.forEach((ls, id) => {
      const vivos = ls.filter((l) => !l.saindo || l.retido);
      const base = vivos.length ? vivos : ls;
      const mensal = base.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100;
      const health = base.reduce<number | null>((m, l) => (l.health_score == null ? m : m == null ? l.health_score : Math.min(m, l.health_score)), null);
      const churn = base.reduce<number | null>((m, l) => (l.churn_prob == null ? m : m == null ? Number(l.churn_prob) : Math.max(m, Number(l.churn_prob))), null);
      const npsL = base.filter((l) => l.nps_score != null).sort((a, b) => (b.nps_date || "").localeCompare(a.nps_date || ""))[0];
      const atrasadas = base.reduce((s, l) => s + Number(l.tarefas_atrasadas || 0), 0);
      const ultReu = base.map((l) => l.ultima_reuniao).filter(Boolean).sort().reverse()[0] || null;
      const diasSemReuniao = diasDesde(ultReu);
      const wa = base[0].wa_rag;
      const inad = Number(base[0].inadimplente_cents || 0) / 100;
      const metaL = base.find((l) => l.meta_alvo != null && Number(l.meta_alvo) > 0);
      const metaPct = metaL ? Math.min(999, (Number(metaL.meta_realizado || 0) / Number(metaL.meta_alvo)) * 100) : null;
      const meses = Math.max(...base.map((l) => Number(l.meses_cliente || 0)));
      const venceEm = base.filter((l) => !l.recorrente && l.vence_em_dias != null && l.vence_em_dias >= 0).map((l) => Number(l.vence_em_dias)).sort((a, b) => a - b)[0] ?? null;
      const saindo = ls.every((l) => l.saindo && !l.retido);
      const produtos = Array.from(new Set(ls.flatMap((l) => l.produtos || [])));
      const fatores: string[] = Array.from(new Set(base.flatMap((l) => Array.isArray(l.churn_factors) ? l.churn_factors.filter((f: any) => Number(f?.score) >= 60).map((f: any) => String(f.details || f.factor)) : [])));
      const acoesIA: string[] = Array.from(new Set(base.flatMap((l) => Array.isArray(l.churn_actions) ? l.churn_actions.map(String) : [])));

      // pontuação de risco: cada sinal pesa de acordo com o quanto costuma anteceder um cancelamento
      let risco = 0; const sinais: string[] = [];
      if (base[0].health_risk === "critical") { risco += 35; sinais.push(`saúde crítica (${health})`); }
      else if (base[0].health_risk === "at_risk") { risco += 25; sinais.push(`saúde em risco (${health})`); }
      else if (base[0].health_risk === "attention") { risco += 12; sinais.push(`saúde em atenção (${health})`); }
      if (churn != null) { if (churn >= 50) { risco += 25; sinais.push(`churn previsto ${Math.round(churn)}%`); } else if (churn >= 35) { risco += 15; sinais.push(`churn previsto ${Math.round(churn)}%`); } else if (churn >= 25) { risco += 8; } }
      if (npsL) { if (npsL.nps_score! <= 6) { risco += 15; sinais.push(`NPS ${npsL.nps_score}`); } else if (npsL.nps_score! <= 8) { risco += 5; sinais.push(`NPS ${npsL.nps_score}`); } }
      else if (meses >= 2) { risco += 4; sinais.push("sem NPS respondido"); }
      if (atrasadas >= 15) { risco += 12; sinais.push(`${atrasadas} tarefas atrasadas`); } else if (atrasadas >= 5) { risco += 6; sinais.push(`${atrasadas} tarefas atrasadas`); }
      if (diasSemReuniao == null) { risco += 10; sinais.push("nenhuma reunião registrada"); }
      else if (diasSemReuniao > 45) { risco += 15; sinais.push(`sem reunião há ${diasSemReuniao} dias`); }
      else if (diasSemReuniao > 30) { risco += 8; sinais.push(`sem reunião há ${diasSemReuniao} dias`); }
      if (wa === "red") { risco += 15; sinais.push("WhatsApp parado"); } else if (wa === "yellow") { risco += 7; sinais.push("WhatsApp esfriando"); }
      if (inad > 0) { risco += 12; sinais.push(`${brl(inad)} vencido sem pagar`); }
      if (metaPct != null && metaPct < 60) { risco += 8; sinais.push(`meta em ${Math.round(metaPct)}%`); }
      if (venceEm != null && venceEm <= 30) { risco += 10; sinais.push(`renova em ${venceEm} dias`); }
      const nivel: EmpresaAnalise["nivel"] = risco >= 55 ? "alto" : risco >= 30 ? "atencao" : "ok";

      // próxima ação: a mais urgente primeiro, e só uma, pra virar tarefa de verdade
      let acao = acoesIA[0] || "Manter a rotina de reunião e acompanhamento da meta";
      if (saindo) acao = "Cliente pediu pra sair: reunião de retenção com o dono ainda esta semana";
      else if (inad > 0) acao = `Resolver os ${brl(inad)} em aberto antes de qualquer conversa comercial`;
      else if (diasSemReuniao == null || diasSemReuniao > 30) acao = "Agendar reunião de resultado com o dono esta semana";
      else if (atrasadas >= 5) acao = `Destravar as ${atrasadas} tarefas atrasadas (ou renegociar os prazos com o cliente)`;
      else if (npsL && npsL.nps_score! <= 6) acao = `Ligar pro dono e entender a nota ${npsL.nps_score} do NPS`;
      else if (wa === "red") acao = "Retomar a conversa no grupo do cliente hoje";
      else if (metaPct != null && metaPct < 60) acao = `Plano de ação pra meta (${Math.round(metaPct)}% do alvo): revisar funil e rotina do time`;
      else if (venceEm != null && venceEm <= 30) acao = `Antecipar a conversa de renovação (vence em ${venceEm} dias) com os resultados na mão`;

      out.push({ id, nome: base[0].company_name, consultor: linhas.find((l) => l.company_id === id)?.consultant_name || "", consultorId: base[0].consultant_id,
        mensal, produtos, saindo, risco, nivel, sinais, acao, health, churn, nps: npsL?.nps_score ?? null, atrasadas, diasSemReuniao, wa, inad, metaPct,
        metaNome: metaL?.meta_nome || null, meses, venceEm, temFee: ls.some((l) => l.tem_success_fee), temMeta: !!metaL, fatores, acoesIA, segmento: base[0].segmento });
    });
    return out.sort((a, b) => (Number(b.saindo) - Number(a.saindo)) || b.risco - a.risco || b.mensal - a.mensal);
  }, [analise, linhas]);

  const oportunidadesTodas = useMemo((): Oportunidade[] => {
    const out: Oportunidade[] = [];
    const tem = (e: EmpresaAnalise, re: RegExp) => e.produtos.some((p) => re.test(p));
    empresasAnalise.forEach((e) => {
      if (e.saindo || e.nivel === "alto") return; // primeiro segura, depois vende
      const temAcc = tem(e, /acceleration|partners|board|advisor/i);
      const temAds = tem(e, /unv ads/i);
      const temSocial = tem(e, /unv social/i);
      const temCrm = tem(e, /^crm$|unv sales$/i);
      const saudavel = (e.health ?? 0) >= 60 && (e.nps == null || e.nps >= 8);
      if (temAcc && !temAds) out.push({ empresa: e, oferta: "UNV Ads", porque: "processo comercial montado; tráfego enche o funil que o time já converte", valor: precoRef("UNV Ads"), tipo: "novo", produtoVenda: "UNV Ads" });
      if (temAcc && !temSocial) out.push({ empresa: e, oferta: "UNV Social", porque: "redes alimentam a prospecção e a autoridade do dono (plano de R$ 1.500 ou R$ 2.000)", valor: precoRef("UNV Social"), tipo: "novo", produtoVenda: "UNV Social" });
      if (!temCrm) out.push({ empresa: e, oferta: "UNV Sales (CRM)", porque: "funil, agentes de IA e disparos num lugar só", valor: precoRef("CRM"), tipo: "novo", produtoVenda: "CRM" });
      if ((temAds || temSocial) && !temAcc) out.push({ empresa: e, oferta: "UNV Sales Acceleration", porque: "já investe em demanda; falta gestão pra virar venda", valor: precoRef("UNV Sales Acceleration"), tipo: "novo", produtoVenda: "UNV Sales Acceleration" });
      // fee é variável e "a combinar": entra na lista, mas não soma no potencial
      if (temAcc && e.temMeta && !e.temFee) out.push({ empresa: e, oferta: "Success fee por meta", porque: e.metaPct != null && e.metaPct >= 100 ? "cliente acima da meta: hora de atrelar parte do ganho ao resultado" : "tem meta, não tem taxa de sucesso: alinha o ganho da UNV ao do cliente", valor: 0, tipo: "fee", produtoVenda: null });
      const prodPrincipal = e.produtos.find((p) => /acceleration|partners/i.test(p));
      const linhaPrincipal = analise.find((a) => a.company_id === e.id && a.product_name === prodPrincipal);
      if (prodPrincipal && linhaPrincipal && saudavel && e.meses >= 6) {
        const med = medianaProduto.get(prodPrincipal) || 0;
        const atual = Number(linhaPrincipal.monthly_cents) / 100;
        if (med && atual < med * 0.85) out.push({ empresa: e, oferta: `Reajuste do ${prodPrincipal}`, porque: `paga ${brl(atual)}; mediana da carteira é ${brl(med)}, ${e.meses} meses de casa, saúde ${e.health}`, valor: med - atual, tipo: "reajuste", produtoVenda: null });
      }
      if (saudavel && e.meses >= 6 && analise.some((a) => a.company_id === e.id && a.recorrente && /mensal/i.test(a.plano || ""))) out.push({ empresa: e, oferta: "Migrar pra plano semestral ou anual", porque: "satisfeito e no mensal: prazo maior protege contra cancelamento por impulso", valor: 0, tipo: "protecao", produtoVenda: null });
    });
    return out.sort((a, b) => b.valor - a.valor || a.empresa.nome.localeCompare(b.empresa.nome));
  }, [empresasAnalise, analise, medianaProduto]);
  // lista exibida: por empresa, no máximo duas com valor (as maiores) e uma "a combinar"
  const oportunidades = useMemo(() => {
    const comValor = new Map<string, number>(), semValor = new Map<string, number>();
    return oportunidadesTodas.filter((o) => {
      const m = o.valor > 0 ? comValor : semValor, lim = o.valor > 0 ? 2 : 1;
      const n = m.get(o.empresa.id) || 0; if (n >= lim) return false; m.set(o.empresa.id, n + 1); return true;
    });
  }, [oportunidadesTodas]);

  // quem pediu pra sair é o risco maior de todos: entra no card junto com o risco alto (Fabrício, 30/10)
  const saindoAnalise = useMemo(() => empresasAnalise.filter((e) => e.saindo), [empresasAnalise]);
  const emRisco = useMemo(() => empresasAnalise.filter((e) => e.saindo || e.nivel === "alto"), [empresasAnalise]);
  const emAtencao = useMemo(() => empresasAnalise.filter((e) => !e.saindo && e.nivel === "atencao"), [empresasAnalise]);
  const valorEmRiscoAlto = emRisco.reduce((s, e) => s + e.mensal, 0);
  const potencial = oportunidadesTodas.reduce((s, o) => s + o.valor, 0);
  // quanto a comissão sobe se as oportunidades fecharem: entrega sempre; venda quando o produto paga venda
  const ganhoComissao = useMemo(() => {
    if (!params) return null;
    return oportunidadesTodas.reduce((s, o) => { const c = comissaoDe(o); return { mensal: s.mensal + c.mensal, unica: s.unica + c.unica }; }, { mensal: 0, unica: 0 });
  }, [oportunidadesTodas, params]);
  // Fabrício (30/10): "mostre o total e o que pode ganhar de cada cliente, e perder também"
  const ganhoPerda = useMemo(() => {
    const linhasGP = empresasAnalise.map((e) => {
      const ops = oportunidadesTodas.filter((o) => o.empresa.id === e.id);
      const ganho = ops.reduce((s, o) => s + o.valor, 0);
      return { e, hoje: e.mensal, ganho, perda: e.mensal, comGanho: ops.reduce((s, o) => s + comissaoDe(o).mensal, 0), comUnica: ops.reduce((s, o) => s + comissaoDe(o).unica, 0), comPerda: params ? e.mensal * params.pct / 100 : 0, ofertas: ops.filter((o) => o.valor > 0).map((o) => o.oferta) };
    }).sort((a, b) => (Number(b.e.saindo) - Number(a.e.saindo)) || b.e.risco - a.e.risco || b.ganho - a.ganho);
    const tot = linhasGP.reduce((t, l) => ({ hoje: t.hoje + l.hoje, ganho: t.ganho + l.ganho, perdaRisco: t.perdaRisco + ((l.e.saindo || l.e.nivel === "alto") ? l.perda : 0), perdaAtencao: t.perdaAtencao + (l.e.nivel === "atencao" ? l.perda : 0), comGanho: t.comGanho + l.comGanho, comUnica: t.comUnica + l.comUnica, comPerdaRisco: t.comPerdaRisco + ((l.e.saindo || l.e.nivel === "alto") ? l.comPerda : 0) }), { hoje: 0, ganho: 0, perdaRisco: 0, perdaAtencao: 0, comGanho: 0, comUnica: 0, comPerdaRisco: 0 });
    return { linhas: linhasGP, tot };
  }, [empresasAnalise, oportunidadesTodas, params]);
  const empresaFoco = useMemo(() => empresasAnalise.find((e) => e.id === focoEmpresa) || null, [empresasAnalise, focoEmpresa]);
  const mostraConsultor = !consultor && empresasAnalise.some((e) => e.consultorId !== empresasAnalise[0]?.consultorId);
  const chipsRisco = (e: EmpresaAnalise) => (
    <span>{e.sinais.length ? e.sinais.slice(0, 4).map((x, i) => <i key={i} className={`tag ${e.nivel === "alto" ? "neg" : e.nivel === "atencao" ? "warn" : ""}`}>{x}</i>) : <Nd>sem sinal de alerta</Nd>}{e.sinais.length > 4 && <i className="tag">+{e.sinais.length - 4}</i>}</span>
  );

  // o componente de barras do painel espera uma serie com campo `mes`
  const serie = useMemo(
    () =>
      historico.map((h) => ({
        mes: h.mes,
        faturado: Number(h.faturado_cents || 0) / 100,
        recebido: Number(h.recebido_cents || 0) / 100,
        fee: Number(h.comissao_cents || 0) / 100,
        clientes: h.clientes,
      })),
    [historico],
  ) as any[];

  const foco = useMemo(() => serie.find((s) => s.mes === mesFoco), [serie, mesFoco]);
  const anterior = useMemo(() => {
    const i = serie.findIndex((s) => s.mes === mesFoco);
    return i > 0 ? serie[i - 1] : null;
  }, [serie, mesFoco]);
  const variacao =
    foco && anterior && anterior.faturado > 0
      ? ((foco.faturado - anterior.faturado) / anterior.faturado) * 100
      : null;

  const inadimplencia = foco && foco.faturado > 0 ? (foco.faturado - foco.recebido) / foco.faturado : null;

  const porProduto = useMemo(() => {
    const mapa = new Map<string, number>();
    linhas.forEach((l) => {
      const k = l.product_name || "sem produto";
      mapa.set(k, (mapa.get(k) || 0) + Number(l.monthly_cents || 0) / 100);
    });
    return Array.from(mapa, ([rot, v]) => ({ k: rot, rot, v, tip: `${rot}: ${brl(v)}` })).sort(
      (a, b) => b.v - a.v,
    );
  }, [linhas]);

  const porConsultor = useMemo(() => {
    const mapa = new Map<string, { nome: string; linhas: LinhaCarteira[] }>();
    linhas.forEach((l) => {
      const atual = mapa.get(l.consultant_id) || { nome: l.consultant_name, linhas: [] };
      atual.linhas.push(l);
      mapa.set(l.consultant_id, atual);
    });
    return Array.from(mapa, ([id, v]) => ({
      id,
      nome: v.nome,
      linhas: v.linhas.sort((a, b) => Number(b.monthly_cents) - Number(a.monthly_cents)),
      total: v.linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100,
      fee: v.linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0) / 100,
    })).sort((a, b) => b.total - a.total);
  }, [linhas]);

  if (carregandoPerm) {
    return (
      <div className="pc">
        <div className="wrap">
          <div className="empty">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pc">
      <div className="wrap">
        <div className="top">
          <button type="button" className="brand" onClick={() => navigate("/onboarding-tasks")}>
            <span className="lg">UNV</span>
            <span className="wm">
              CARTEIRA
              <small>DO CONSULTOR</small>
            </span>
          </button>
          <div className="ctl">
            {podeFiltrar && consultores.length > 0 && (
              <Combo
                k="consultor"
                label="Consultor"
                value={consultor}
                opts={consultores}
                todos="Todos"
                onChange={(v) => {
                  setDrill(null);
                  setConsultor(v);
                }}
              />
            )}
            <button
              type="button"
              className="back"
              onClick={() => (drill ? setDrill(null) : navigate("/onboarding-tasks"))}
            >
              Voltar
            </button>
          </div>
        </div>

        <div className="src">
          Valor mensal de cada empresa. Contrato anual ou semestral entra dividido pelos meses, então
          cliente que pagou no cartão também aparece com o que representa por mês.
        </div>

        {carregando ? (
          <div className="empty">Carregando...</div>
        ) : drill ? (
          <>
            <div className="crumbs">
              <Lk onClick={() => setDrill(null)}>Carteira</Lk>
              <span className="nd"> › {drill.titulo}</span>
            </div>
            {drill.tipo === "contratos" ? (
              <Panel titulo={drill.titulo} sub={drill.sub}>
                <Tabela
                  cols={[
                    { h: "Empresa", tl: true },
                    { h: "Produto", tl: true },
                    { h: "Consultor", tl: true },
                    "Por mês",
                    "Plano",
                    { h: "De onde vem", tl: true },
                    ...(veComissao ? ["Comissão"] : []),
                  ]}
                  rows={drill.linhas
                    .slice()
                    .sort((a, b) => Number(b.monthly_cents) - Number(a.monthly_cents))
                    .map((l) => [
                      <span>
                        {l.company_name}
                        {l.saindo && <i className="tag neg"> saindo</i>}
                        {l.contrato_vencido && <i className="tag warn"> vencido</i>}
                        {Number(l.nao_pago_cents) > 0 && (
                          <i className="tag warn"> não pagou {brl(Number(l.nao_pago_cents) / 100)}</i>
                        )}
                        {Number(l.atraso_pago_cents) > 0 && (
                          <i className="tag pos">
                            {" "}
                            quitou {brl(Number(l.atraso_pago_cents) / 100)} atrasado
                          </i>
                        )}
                      </span>,
                      l.product_name || <Nd />,
                      l.consultant_name,
                      brlFull(Number(l.monthly_cents || 0) / 100),
                      <span>
                        {l.plano}
                        {!l.recorrente && l.dias_para_vencer !== null && (
                          <i className="tag">
                            {" "}
                            {l.dias_para_vencer < 0
                              ? `venceu há ${Math.abs(l.dias_para_vencer)} dias`
                              : `${l.dias_para_vencer} dias`}
                          </i>
                        )}
                      </span>,
                      <small className="nd">{l.origem}</small>,
                      ...(veComissao
                        ? [
                            <span>
                              {brlFull(Number(l.comissao_cents || 0) / 100)}
                              {Number(l.comissao_venda_cents) > 0 && (
                                <i className="tag pos">
                                  {" "}
                                  +{brlFull(Number(l.comissao_venda_cents) / 100)} venda
                                </i>
                              )}
                            </span>,
                          ]
                        : []),
                    ])}
                  vazio="Nada neste recorte."
                />
              </Panel>
            ) : (
              <Panel titulo={drill.titulo} sub={drill.sub}>
                {carregandoFaturas ? (
                  <div className="empty">Carregando...</div>
                ) : (
                  <Tabela
                    cols={[
                      { h: "Empresa", tl: true },
                      { h: "Cobrança", tl: true },
                      { h: "Consultor", tl: true },
                      "Valor",
                      "Vencimento",
                      "Situação",
                    ]}
                    rows={faturas
                      .filter((x) => (drill.filtro ? drill.filtro(x) : true))
                      .map((x) => [
                        x.company_name,
                        <small className="nd">{x.descricao}</small>,
                        x.consultant_name || <Nd />,
                        brlFull(Number(x.valor_cents) / 100),
                        dataBR(x.vencimento),
                        x.status === "pago" ? (
                          <span className="pos">pago {x.pago_em ? dataBR(x.pago_em) : ""}</span>
                        ) : x.status === "vencido" ? (
                          <span className="neg">vencido há {x.dias_atraso} dias</span>
                        ) : (
                          <span className="nd">a vencer</span>
                        ),
                      ])}
                    vazio="Nenhuma cobrança neste recorte."
                  />
                )}
              </Panel>
            )}
          </>
        ) : (
          <>
            <div className={`grid ${veComissao ? "k6" : "k5"}`}>
              <Tile
                main
                label="Carteira por mês"
                valor={brl(total)}
                sub={plural(empresas, "empresa", "empresas")}
                onClick={() =>
                  setDrill({
                    tipo: "contratos",
                    titulo: "Carteira por mês",
                    sub: `${brlFull(total)} em ${plural(linhas.length, "contrato", "contratos")}`,
                    linhas,
                  })
                }
              />
              <Tile
                label="Contratos"
                valor={String(linhas.length)}
                sub={`${recorrentes} recorrentes · ticket ${brl(ticket)}`}
                onClick={() =>
                  setDrill({
                    tipo: "contratos",
                    titulo: "Contratos",
                    sub: `${recorrentes} recorrentes · ticket ${brlFull(ticket)}`,
                    linhas,
                  })
                }
              />
              <Tile
                label="Faturado no mês"
                valor={foco ? brl(foco.faturado) : "-"}
                onClick={() =>
                  setDrill({
                    tipo: "faturas",
                    titulo: "Faturado no mês",
                    sub: mesFoco ? mesAno(mesFoco) : "",
                  })
                }
                sub={
                  <>
                    {mesFoco ? mesAno(mesFoco) : ""}
                    {variacao != null && (
                      <>
                        {" · "}
                        <span className={variacao >= 0 ? "pos" : "neg"}>
                          {variacao >= 0 ? "+" : ""}
                          {variacao.toFixed(0)}% vs anterior
                        </span>
                      </>
                    )}
                  </>
                }
              />
              <Tile
                label="Inadimplência"
                valor={inadimplencia == null ? "-" : `${Math.round(inadimplencia * 100)}%`}
                cls={inadimplencia != null && inadimplencia > 0.15 ? "neg" : undefined}
                sub={foco ? `recebido ${brl(foco.recebido)}` : <Nd />}
                onClick={() =>
                  setDrill({
                    tipo: "faturas",
                    titulo: "Faturas em aberto",
                    sub: mesFoco ? mesAno(mesFoco) : "",
                    filtro: (x) => x.status !== "pago",
                  })
                }
              />
              <Tile
                label="Success fee possível"
                valor={brl(successFee)}
                sub="o cliente paga isso a mais quando bate a meta"
                onClick={() =>
                  setDrill({
                    tipo: "contratos",
                    titulo: "Success fee possível",
                    sub: `${brlFull(successFee)} se todos baterem a meta`,
                    linhas: linhas.filter((l) => Number(l.commission_max_cents) > 0),
                  })
                }
              />
              {veComissao && (
                <Tile
                  main
                  label="Comissão do mês"
                  valor={brlFull(comissaoTotal)}
                  onClick={() =>
                    setDrill({
                      tipo: "contratos",
                      titulo: "Comissão do mês",
                      sub: `${brlFull(comissaoTotal)} sobre a base paga`,
                      linhas: linhas.filter(
                        (l) => Number(l.comissao_cents) > 0 || Number(l.comissao_venda_cents) > 0,
                      ),
                    })
                  }
                  sub={
                    isMaster && mediaConsultores > 0
                      ? `média ${brlFull(mediaConsultores)} por consultor`
                      : "sobre a base paga do mês"
                  }
                />
              )}
            </div>

            {veComissao && (
              <Panel
                titulo={isMaster ? "Comissão dos consultores" : "Sua comissão"}
                sub={
                  isMaster
                    ? `${brlFull(comissaoTotal)} no mês · só o master enxerga`
                    : `${brlFull(comissaoTotal)} no mês`
                }
              >
                {comissao.length === 0 && (
                  <div className="empty">
                    {erroComissao
                      ? `A API recusou a consulta: ${erroComissao}`
                      : "Nenhum consultor com carteira neste filtro."}
                  </div>
                )}
                <Tabela
                  cols={[
                    { h: "Consultor", tl: true },
                    "Carteira",
                    "Base paga",
                    "Piso",
                    "Entrega",
                    "Venda",
                    "Comissão do mês",
                    "Peso",
                    ...(isMaster ? [""] : []),
                  ]}
                  rows={comissao.map((c) => [
                    <span>
                      {c.consultant_name}
                      {c.papel !== "consultant" && <i className="tag"> {c.papel}</i>}
                      {isMaster && configs[c.consultant_id] && <i className="tag pos"> regra própria</i>}
                      {c.saindo > 0 && <i className="tag neg"> {c.saindo} saindo</i>}
                    </span>,
                    brlFull(Number(c.carteira_cents) / 100),
                    <span>
                      {brlFull(Number(c.base_cents) / 100)}
                      {Number(c.nao_pago_cents) > 0 && (
                        <i className="tag warn"> -{brl(Number(c.nao_pago_cents) / 100)} não pago</i>
                      )}
                      {Number(c.atraso_pago_cents) > 0 && (
                        <i className="tag pos">
                          {" "}
                          +{brl(Number(c.atraso_pago_cents) / 100)} atrasado quitado
                        </i>
                      )}
                    </span>,
                    Number(c.piso_cents) > 0 ? brlFull(Number(c.piso_cents) / 100) : <Nd />,
                    <span>
                      {brlFull(Number(c.variavel_cents) / 100)}
                      {Number(c.perdido_cents) > 0 && (
                        <i className="tag warn"> -{brl(Number(c.perdido_cents) / 100)} cancelamento</i>
                      )}
                    </span>,
                    Number(c.venda_cents) > 0 ? (
                      <span>
                        {brlFull(Number(c.venda_cents) / 100)}
                        <i className="tag"> {plural(c.vendas, "venda", "vendas")}</i>
                      </span>
                    ) : (
                      <Nd />
                    ),
                    <b className="pos">{brlFull(Number(c.total_cents) / 100)}</b>,
                    c.peso == null ? <Nd /> : `${(Number(c.peso) * 100).toFixed(1)}%`,
                    ...(isMaster
                      ? [
                          <Lk onClick={() => abrirEdicao(c.consultant_id)}>
                            {configs[c.consultant_id] ? "ajustado" : "ajustar"}
                          </Lk>,
                        ]
                      : []),
                  ])}
                  vazio="Sem comissão calculada."
                />
                <div className="nd" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
                  <b>Entrega:</b> piso {brlFull(params?.piso ?? 0)} mais {params?.pct ?? 0}% da base
                  de quem é responsável pelo cliente.
                  <br />
                  <b>Base:</b> o valor mensalizado, menos o que o cliente venceu e não pagou no mês.
                  Atrasado de mês anterior que ele quita agora volta pra base deste mês, que é quando
                  o dinheiro entrou. Quem quitou adiantado não tem fatura no mês e conta cheio;
                  quem está com fatura vencida entra só pelo que pagou.
                  <br />
                  <b>Até quando conta:</b> enquanto o cliente paga. Quem pediu cancelamento continua
                  gerando comissão durante o aviso prévio e para no dia em que o contrato encerra. Se
                  o cliente de saída não tiver cobrança no mês, não conta. Contrato com prazo
                  (trimestral, semestral, anual) para no fim do prazo e só volta quando a renovação
                  for lançada. Cliente que pediu e foi retido volta a valer cheio.
                  <br />
                  <b>Venda:</b> {params?.pctVenda ?? 0}% pra quem vendeu o serviço, por cima do
                  mesmo projeto e enquanto o cliente ficar. Não tira nada de quem entrega, os dois
                  recebem. Para se a pessoa sair da equipe.
                  {params?.semVenda?.length ? (
                    <>
                      {" "}
                      {params.semVenda.join(", ")}{" "}
                      {params.pctVendaUnica > 0 ? (
                        <>
                          não paga recorrência: quem vende leva {params.pctVendaUnica}% uma vez só, no
                          mês em que o contrato começa.
                        </>
                      ) : (
                        <>fica fora da comissão de venda.</>
                      )}
                    </>
                  ) : (
                    ""
                  )}
                  <br />
                  {isMaster && (
                    <>
                      Média dos consultores hoje: <b>{brlFull(mediaConsultores)}</b>
                      {config?.teto_cents
                        ? ` · referência de ${brlFull(Number(config.teto_cents) / 100)} por cabeça, pode passar`
                        : ""}
                    </>
                  )}
                  {vendaTotal > 0 ? `${isMaster ? " · " : ""}${brlFull(vendaTotal)} de venda` : ""}
                  {perdidoTotal > 0
                    ? `${isMaster || vendaTotal > 0 ? " · " : ""}${brlFull(perdidoTotal)} a menos por cancelamento no mês`
                    : ""}
                </div>
                {isMaster && (editando ? (
                  <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 12 }}>
                    <div className="nd" style={{ fontSize: 11, marginBottom: 8 }}>
                      {editando === PADRAO ? (
                        <>
                          Ajustando a <b>regra padrão</b>, que vale pra quem não tem regra própria.
                        </>
                      ) : (
                        <>
                          Ajustando só{" "}
                          <b>{comissao.find((x) => x.consultant_id === editando)?.consultant_name}</b>.
                          {!configs[editando] && " Ele ainda segue o padrão; salvar cria a regra dele."}
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                      {([
                        { k: "piso", rot: "Piso (R$)", w: 110 },
                        { k: "pct", rot: "% da entrega", w: 110 },
                        { k: "pctVenda", rot: "% da venda", w: 110 },
                        { k: "pctVendaUnica", rot: "% da venda 1º mês", w: 130 },
                        { k: "teto", rot: "Referência (R$)", w: 120 },
                      ] as const).map((campo) => (
                        <label key={campo.k} style={{ display: "grid", gap: 4, fontSize: 11 }}>
                          <span className="nd">{campo.rot}</span>
                          <input
                            value={form[campo.k]}
                            onChange={(e) => setForm({ ...form, [campo.k]: e.target.value })}
                            style={{
                              width: campo.w,
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,.18)",
                              background: "rgba(255,255,255,.05)",
                              color: "inherit",
                              font: "inherit",
                            }}
                          />
                        </label>
                      ))}
                      <button type="button" className="back" onClick={salvarConfig} disabled={salvando}>
                        {salvando ? "Salvando" : "Salvar"}
                      </button>
                      {editando !== PADRAO && configs[editando] && (
                        <button
                          type="button"
                          className="back"
                          onClick={() => voltarAoPadrao(editando)}
                          disabled={salvando}
                        >
                          Voltar ao padrão
                        </button>
                      )}
                      <button type="button" className="back" onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </div>
                    {editando === PADRAO && (
                      <div style={{ marginTop: 14 }}>
                        <div className="nd" style={{ fontSize: 11, marginBottom: 6 }}>
                          Produtos sem comissão de venda recorrente. Clique pra marcar. O que estiver
                          marcado paga só no primeiro mês, no percentual acima.
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {produtos.map((p) => {
                            const lista = form.semVenda.split(",").map((x) => x.trim()).filter(Boolean);
                            const marcado = lista.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    semVenda: (marcado
                                      ? lista.filter((x) => x !== p)
                                      : [...lista, p]
                                    ).join(", "),
                                  })
                                }
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  cursor: "pointer",
                                  font: "inherit",
                                  border: marcado
                                    ? "1px solid #6a2a2a"
                                    : "1px solid rgba(255,255,255,.15)",
                                  background: marcado ? "#1C1214" : "rgba(255,255,255,.04)",
                                  color: marcado ? "var(--ink)" : "var(--mute)",
                                }}
                              >
                                {marcado ? "✓ " : ""}
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="back"
                    style={{ marginTop: 12 }}
                    onClick={() => abrirEdicao(PADRAO)}
                  >
                    Ajustar a regra padrão
                  </button>
                ))}
              </Panel>
            )}

            <div className="grid r4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <Panel
                titulo="Contratos de prazo vencidos"
                sub={String(vencidos.length)}
                onClick={
                  vencidos.length
                    ? () =>
                        setDrill({
                          tipo: "contratos",
                          titulo: "Contratos de prazo vencidos",
                          sub: plural(vencidos.length, "contrato", "contratos"),
                          linhas: vencidos,
                        })
                    : undefined
                }
              >
                {vencidos.length ? (
                  <Tabela
                    cols={[{ h: "Empresa", tl: true }, "Venceu", "Por mês"]}
                    rows={vencidos.slice(0, 6).map((l) => [
                      <span>
                        {l.company_name}
                        <i className="tag"> {l.plano}</i>
                      </span>,
                      `${Math.abs(Number(l.dias_para_vencer))} dias`,
                      brl(Number(l.monthly_cents) / 100),
                    ])}
                  />
                ) : (
                  <div className="empty">Nenhum</div>
                )}
              </Panel>
              <Panel
                titulo="Vence nos próximos 30 dias"
                sub={plural(vencendo.length, "contrato", "contratos")}
                onClick={
                  vencendo.length
                    ? () =>
                        setDrill({
                          tipo: "contratos",
                          titulo: "Vence nos próximos 30 dias",
                          sub: plural(vencendo.length, "contrato", "contratos"),
                          linhas: vencendo,
                        })
                    : undefined
                }
              >
                {vencendo.length ? (
                  <Tabela
                    cols={[{ h: "Empresa", tl: true }, "Em", "Por mês"]}
                    rows={vencendo.slice(0, 8).map((l) => [
                      <span>
                        {l.company_name}
                        <i className="tag">{l.recorrente ? " renovação mensal" : ` ${l.plano}`}</i>
                      </span>,
                      `${l.vence_em_dias} dias`,
                      brl(Number(l.monthly_cents) / 100),
                    ])}
                  />
                ) : (
                  <div className="empty">Nenhum</div>
                )}
              </Panel>
              <Panel
                titulo="Clientes saindo"
                sub={saindo.length ? brl(valorEmRisco) : "0"}
                onClick={
                  saindo.length
                    ? () =>
                        setDrill({
                          tipo: "contratos",
                          titulo: "Clientes saindo",
                          sub: `${brlFull(valorEmRisco)} em risco`,
                          linhas: saindo,
                        })
                    : undefined
                }
              >
                {saindo.length ? (
                  <Tabela
                    cols={[{ h: "Empresa", tl: true }, "Pediu em", "Por mês"]}
                    rows={saindo.slice(0, 6).map((l) => [
                      l.company_name,
                      l.cancelamento_solicitado ? dataBR(l.cancelamento_solicitado) : <Nd />,
                      brl(Number(l.monthly_cents) / 100),
                    ])}
                  />
                ) : (
                  <div className="empty">Nenhum</div>
                )}
                {retidos.length > 0 && (
                  <span className="more">
                    {plural(retidos.length, "cliente pediu e foi retido", "clientes pediram e foram retidos")}:{" "}
                    {retidos.map((l) => l.company_name).join(", ")}
                  </span>
                )}
              </Panel>
            </div>

            {/* ── Como ganhar mais com a carteira ─────────────────────────────── */}
            {analise.length > 0 && (
              <>
                <div className={`grid ${veComissao && ganhoComissao != null ? "r4" : "r3"}`}>
                  <Tile label="Receita que dá pra somar" valor={brl(potencial)} sub={`${plural(oportunidades.filter((o) => o.valor > 0).length, "oportunidade com valor", "oportunidades com valor")} · ${plural(oportunidades.filter((o) => !o.valor).length, "a combinar", "a combinar")}`} main />
                  <Tile label="Em risco de sair" valor={emRisco.length ? brl(valorEmRiscoAlto) : "R$ 0"}
                    sub={emRisco.length
                      ? [saindoAnalise.length ? `${saindoAnalise.length} pediu pra sair` : "", (emRisco.length - saindoAnalise.length) ? `${emRisco.length - saindoAnalise.length} em risco alto` : "", `${emAtencao.length} em atenção`].filter(Boolean).join(" · ")
                      : `${plural(emAtencao.length, "cliente em atenção", "clientes em atenção")}, ninguém saindo nem em risco alto`}
                    cls={emRisco.length ? "neg" : "pos"} />
                  <Tile label="Clientes saudáveis" valor={String(empresasAnalise.filter((e) => !e.saindo && e.nivel === "ok").length)} sub={`de ${plural(empresasAnalise.length, "empresa", "empresas")} na carteira`} cls="pos" />
                  {veComissao && ganhoComissao && (
                    <Tile label="Comissão pode subir" valor={`+${brl(ganhoComissao.mensal)}`} sub={`por mês, se as oportunidades fecharem${ganhoComissao.unica ? ` · mais ${brl(ganhoComissao.unica)} uma vez só (UNV Social paga venda única, sem recorrência)` : ""}`} cls="pos" />
                  )}
                </div>

                {empresaFoco && (
                  <Panel titulo={<>{empresaFoco.nome} <i className={`tag ${empresaFoco.nivel === "alto" ? "neg" : empresaFoco.nivel === "atencao" ? "warn" : "pos"}`}>risco {empresaFoco.risco}</i></>}
                    sub={<Lk onClick={() => setFocoEmpresa(null)}>fechar</Lk>}>
                    <div className="grid r4">
                      <Tile label="Saúde" valor={empresaFoco.health != null ? String(empresaFoco.health) : "-"} sub="score 0 a 100" cls={empresaFoco.health != null && empresaFoco.health < 50 ? "neg" : ""} />
                      <Tile label="Churn previsto" valor={empresaFoco.churn != null ? `${Math.round(empresaFoco.churn)}%` : "-"} sub="próximos 90 dias" cls={empresaFoco.churn != null && empresaFoco.churn >= 35 ? "neg" : ""} />
                      <Tile label="NPS" valor={empresaFoco.nps != null ? String(empresaFoco.nps) : "-"} sub={empresaFoco.nps == null ? "sem resposta" : "última resposta"} cls={empresaFoco.nps != null && empresaFoco.nps <= 6 ? "neg" : ""} />
                      <Tile label="Meta do mês" valor={empresaFoco.metaPct != null ? `${Math.round(empresaFoco.metaPct)}%` : "-"} sub={empresaFoco.metaNome || "sem meta principal"} cls={empresaFoco.metaPct != null && empresaFoco.metaPct < 60 ? "neg" : ""} />
                    </div>
                    <div className="grid r4">
                      <Tile label="Tarefas atrasadas" valor={String(empresaFoco.atrasadas)} sub="no projeto" cls={empresaFoco.atrasadas >= 5 ? "neg" : ""} />
                      <Tile label="Última reunião" valor={empresaFoco.diasSemReuniao == null ? "-" : `${empresaFoco.diasSemReuniao} dias`} sub="atrás" cls={empresaFoco.diasSemReuniao == null || empresaFoco.diasSemReuniao > 30 ? "neg" : ""} />
                      <Tile label="WhatsApp" valor={empresaFoco.wa === "green" ? "ativo" : empresaFoco.wa === "yellow" ? "esfriando" : empresaFoco.wa === "red" ? "parado" : "-"} sub="grupo do cliente" cls={empresaFoco.wa === "red" ? "neg" : ""} />
                      <Tile label="Em aberto" valor={empresaFoco.inad ? brl(empresaFoco.inad) : "R$ 0"} sub="faturas vencidas" cls={empresaFoco.inad ? "neg" : ""} />
                    </div>
                    <p className="note"><b>Próxima ação:</b> {empresaFoco.acao}</p>
                    {empresaFoco.fatores.length > 0 && <p className="note"><b>O que pesa:</b> {empresaFoco.fatores.join(" · ")}</p>}
                    {empresaFoco.acoesIA.length > 0 && <p className="note"><b>Sugestões da previsão de churn:</b> {empresaFoco.acoesIA.join(" · ")}</p>}
                    <p className="note"><b>Produtos:</b> {empresaFoco.produtos.join(", ") || "-"} · {plural(empresaFoco.meses, "mês", "meses")} de casa · {brlFull(empresaFoco.mensal)} por mês{empresaFoco.segmento ? ` · ${empresaFoco.segmento}` : ""}</p>
                    {oportunidades.filter((o) => o.empresa.id === empresaFoco.id).length > 0 && (
                      <p className="note"><b>Dá pra oferecer:</b> {oportunidades.filter((o) => o.empresa.id === empresaFoco.id).map((o) => `${o.oferta}${o.valor ? ` (+${brl(o.valor)}/mês)` : ""}`).join(" · ")}</p>
                    )}
                  </Panel>
                )}

                <div className="grid g2">
                  <Panel titulo="Atenção pra não perder cliente" sub={`${saindoAnalise.length} saindo · ${emRisco.length - saindoAnalise.length} em risco alto · ${emAtencao.length} em atenção`}>
                    <Tabela
                      cols={[{ h: "Empresa", tl: true }, ...(mostraConsultor ? [{ h: "Consultor", tl: true }] : []), "Por mês", "Risco", { h: "Sinais", tl: true }, { h: "Próxima ação", tl: true }]}
                      rows={empresasAnalise.filter((e) => e.saindo || e.nivel !== "ok").map((e) => [
                        <Lk onClick={() => setFocoEmpresa(e.id)}>{e.nome}</Lk>,
                        ...(mostraConsultor ? [e.consultor] : []),
                        brl(e.mensal),
                        e.saindo ? <span className="st r">saindo</span> : <St ok={e.nivel === "ok"} warn={e.nivel === "atencao"} tg="ok" tw={`atenção ${e.risco}`} tb={`alto ${e.risco}`} />,
                        chipsRisco(e),
                        <span style={{ fontSize: 12 }}>{e.acao}</span>,
                      ])}
                      onRow={(i) => setFocoEmpresa(empresasAnalise.filter((e) => e.saindo || e.nivel !== "ok")[i].id)}
                      vazio="Nenhum cliente com sinal de alerta. Mantém a rotina."
                    />
                    <span className="more">Risco soma saúde do cliente, previsão de churn, NPS, tarefas atrasadas, tempo sem reunião, WhatsApp do grupo, fatura vencida, meta do mês e renovação próxima. Clique na empresa pra ver tudo.</span>
                  </Panel>
                  <Panel titulo="Oportunidades pra aumentar a receita" sub={`${brl(potencial)} por mês`}>
                    <Tabela
                      cols={[{ h: "Empresa", tl: true }, { h: "Oferecer", tl: true }, { h: "Por quê", tl: true }, "Por mês", ...(veComissao && params ? ["Sua comissão"] : [])]}
                      rows={oportunidades.slice(0, 14).map((o) => {
                        const com = comissaoDe(o);
                        return [
                          <Lk onClick={() => setFocoEmpresa(o.empresa.id)}>{o.empresa.nome}</Lk>,
                          <span><b>{o.oferta}</b> <i className={`tag ${o.tipo === "protecao" ? "" : "pos"}`}>{o.tipo === "novo" ? "novo serviço" : o.tipo === "reajuste" ? "reajuste" : o.tipo === "fee" ? "variável" : "proteção"}</i></span>,
                          <span style={{ fontSize: 12 }}>{o.porque}</span>,
                          o.valor ? `+${brl(o.valor)}` : <Nd>{o.tipo === "fee" ? "a combinar" : "proteção"}</Nd>,
                          ...(veComissao && params ? [o.valor ? (com.unica ? <span>{brl(com.unica)} <i className="tag">uma vez</i></span> : `+${brl(com.mensal)}/mês`) : <Nd />] : []),
                        ];
                      })}
                      vazio="Nenhuma oportunidade clara agora: a carteira está completa ou os clientes precisam ser segurados primeiro."
                    />
                    {oportunidades.length > 14 && <span className="more">e mais {oportunidades.length - 14} oportunidades</span>}
                    <span className="more">Quem está em risco alto ou pediu pra sair fica fora desta lista: primeiro segura, depois vende. Valores são a mediana da carteira pro produto.</span>
                  </Panel>
                </div>

                <Panel titulo="Quanto dá pra ganhar e quanto dá pra perder, cliente a cliente"
                  sub={<>ganhar <b className="pos">+{brl(ganhoPerda.tot.ganho)}</b>/mês · em risco <b className="neg">{brl(ganhoPerda.tot.perdaRisco)}</b>/mês{ganhoPerda.tot.perdaAtencao ? <> · em atenção {brl(ganhoPerda.tot.perdaAtencao)}/mês</> : null}</>}>
                  <Tabela
                    cols={[{ h: "Empresa", tl: true }, ...(mostraConsultor ? [{ h: "Consultor", tl: true }] : []), "Paga hoje", "Pode ganhar", { h: "Com o quê", tl: true }, "Pode perder", "Risco", ...(veComissao && params ? ["Comissão +", "Comissão −"] : [])]}
                    rows={[
                      ...ganhoPerda.linhas.map((l) => [
                        <Lk onClick={() => setFocoEmpresa(l.e.id)}>{l.e.nome}</Lk>,
                        ...(mostraConsultor ? [l.e.consultor] : []),
                        brl(l.hoje),
                        l.ganho ? <span className="pos">+{brl(l.ganho)}</span> : <Nd>{l.e.saindo || l.e.nivel === "alto" ? "segurar antes" : "-"}</Nd>,
                        <span style={{ fontSize: 12 }}>{l.ofertas.join(", ") || <Nd />}</span>,
                        <span className={l.e.saindo || l.e.nivel === "alto" ? "neg" : l.e.nivel === "atencao" ? "warn" : ""}>{brl(l.perda)}</span>,
                        l.e.saindo ? <span className="st r">saindo</span> : <St ok={l.e.nivel === "ok"} warn={l.e.nivel === "atencao"} tg="ok" tw={`atenção ${l.e.risco}`} tb={`alto ${l.e.risco}`} />,
                        ...(veComissao && params ? [l.comGanho || l.comUnica ? <span className="pos">{l.comGanho ? `+${brl(l.comGanho)}/mês` : ""}{l.comGanho && l.comUnica ? " · " : ""}{l.comUnica ? `${brl(l.comUnica)} uma vez` : ""}</span> : <Nd />, <span className={l.e.saindo || l.e.nivel === "alto" ? "neg" : ""}>−{brl(l.comPerda)}</span>] : []),
                      ]),
                      [
                        <b>Total ({plural(ganhoPerda.linhas.length, "empresa", "empresas")})</b>,
                        ...(mostraConsultor ? [""] : []),
                        <b>{brl(ganhoPerda.tot.hoje)}</b>,
                        <b className="pos">+{brl(ganhoPerda.tot.ganho)}</b>,
                        <span style={{ fontSize: 12 }}>se fechar tudo: {brl(ganhoPerda.tot.hoje + ganhoPerda.tot.ganho)}/mês</span>,
                        <b className="neg">{brl(ganhoPerda.tot.perdaRisco)}</b>,
                        <span style={{ fontSize: 12 }}>em risco alto ou saindo</span>,
                        ...(veComissao && params ? [<b className="pos">+{brl(ganhoPerda.tot.comGanho)}/mês{ganhoPerda.tot.comUnica ? ` · ${brl(ganhoPerda.tot.comUnica)} uma vez` : ""}</b>, <b className="neg">−{brl(ganhoPerda.tot.comPerdaRisco)}</b>] : []),
                      ],
                    ]}
                  />
                  <span className="more">"Pode perder" é o que o cliente paga hoje por mês: é isso que sai da carteira se ele cancelar. "Pode ganhar" soma todas as ofertas com valor pra aquela empresa. UNV Social paga comissão uma vez só, no primeiro mês (venda única), e não entra na recorrência. Comissão − considera só o percentual de entrega.</span>
                </Panel>

                <Panel titulo="Plano da semana" sub="o que fazer primeiro">
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                    {emRisco.slice(0, 3).map((e) => (
                      <li key={e.id}><b>{e.nome}</b> ({brl(e.mensal)}/mês): {e.acao}</li>
                    ))}
                    {emAtencao.slice(0, 2).map((e) => (
                      <li key={e.id}><b>{e.nome}</b>: {e.acao}</li>
                    ))}
                    {oportunidades.filter((o) => o.valor > 0).slice(0, 3).map((o, i) => (
                      <li key={`o${i}`}><b>{o.empresa.nome}</b>: levar a proposta de <b>{o.oferta}</b> (+{brl(o.valor)}/mês) na próxima reunião</li>
                    ))}
                    {!empresasAnalise.some((e) => e.saindo || e.nivel !== "ok") && !oportunidades.some((o) => o.valor > 0) && <li>Carteira estável e completa. Foque em NPS e indicação.</li>}
                  </ol>
                </Panel>
              </>
            )}

            <Panel
              titulo="Faturado mês a mês"
              sub="clique no mês para ver os números dele acima"
            >
              <Barras
                serie={serie}
                mes={mesFoco}
                fn={(m: any) => m.faturado}
                fmt={(v) => brl(v)}
                sub={(m: any) => (m.fee > 0 ? <i className="tag">fee {brl(m.fee)}</i> : null)}
                onMes={setMesFoco}
              />
            </Panel>

            <div className="grid g2">
              <Panel titulo="Recebido mês a mês" sub="o que entrou de verdade">
                <Barras
                  serie={serie}
                  mes={mesFoco}
                  fn={(m: any) => m.recebido}
                  fmt={(v) => brl(v)}
                  onMes={setMesFoco}
                />
              </Panel>
              <Panel titulo="Carteira por produto" sub={brl(total)}>
                <BarrasItens itens={porProduto} fmt={(v) => brl(v)} denso />
              </Panel>
            </div>

            <Panel titulo="Histórico" sub="12 meses">
              <Tabela
                cols={[
                  { h: "Mês", tl: true },
                  "Faturado",
                  "Recebido",
                  "Inadimplência",
                  "Success fee",
                  "Clientes",
                ]}
                rows={historico
                  .filter((h) => Number(h.faturado_cents) > 0)
                  .slice()
                  .reverse()
                  .map((h) => {
                    const fat = Number(h.faturado_cents || 0) / 100;
                    const rec = Number(h.recebido_cents || 0) / 100;
                    const inad = fat > 0 ? (fat - rec) / fat : 0;
                    return [
                      <Lk onClick={() => setMesFoco(h.mes)}>{mesAno(h.mes)}</Lk>,
                      brlFull(fat),
                      brlFull(rec),
                      <St ok={inad <= 0.1} warn={inad <= 0.25} tg={`${Math.round(inad * 100)}%`} tw={`${Math.round(inad * 100)}%`} tb={`${Math.round(inad * 100)}%`} />,
                      Number(h.comissao_cents) > 0 ? brlFull(Number(h.comissao_cents) / 100) : <Nd />,
                      String(h.clientes),
                    ];
                  })}
                vazio="Sem histórico de faturamento."
              />
            </Panel>

            {porConsultor.map((g) => {
              const c = comissaoPorConsultor.get(g.id);
              return (
                <Panel
                  key={g.id}
                  titulo={g.nome}
                  sub={
                    <>
                      {plural(g.linhas.length, "contrato", "contratos")} · {brlFull(g.total)} por mês
                      {veComissao && c ? ` · comissão ${brlFull(Number(c.total_cents) / 100)}` : ""}
                    </>
                  }
                >
                  <Tabela
                    cols={[
                      { h: "Empresa", tl: true },
                      { h: "Produto", tl: true },
                      "Por mês",
                      { h: "Como foi calculado", tl: true },
                      "Se bater meta",
                      ...(veComissao ? [{ h: "Vendido por", tl: true }, "Comissão"] : []),
                    ]}
                    rows={g.linhas.map((l) => [
                      <span>
                        {l.company_name}
                        {l.saindo && (
                          <i className="tag neg">
                            {" "}
                            saindo
                            {l.cancelamento_solicitado ? ` desde ${dataBR(l.cancelamento_solicitado)}` : ""}
                          </i>
                        )}
                        {l.retido && <i className="tag pos"> pediu e foi retido</i>}
                        {Number(l.nao_pago_cents) > 0 && (
                          <i className="tag warn"> não pagou {brl(Number(l.nao_pago_cents) / 100)}</i>
                        )}
                        {l.contrato_vencido && <i className="tag warn"> contrato vencido</i>}
                        {!l.contrato_vencido &&
                          l.vence_em_dias !== null &&
                          l.vence_em_dias >= 0 &&
                          l.vence_em_dias <= 30 && (
                            <i className="tag"> {l.recorrente ? "renova" : "vence"} em {l.vence_em_dias} dias</i>
                          )}
                      </span>,
                      l.product_name || <Nd />,
                      brlFull(Number(l.monthly_cents || 0) / 100),
                      <small className="nd">
                        {l.origem}
                        {l.origem.startsWith("contrato") && l.contract_months && l.contract_months > 1 && l.contract_value
                          ? ` (${brl(Number(l.contract_value))} em ${l.contract_months} meses)`
                          : ""}
                      </small>,
                      Number(l.commission_max_cents) > 0 ? brlFull(Number(l.commission_max_cents) / 100) : <Nd />,
                      ...(veComissao
                        ? [
                            l.vendido_por_nome ? (
                              <span>
                                <small>{l.vendido_por_nome}</small>
                                {Number(l.comissao_venda_cents) > 0 && (
                                  <i className="tag pos">
                                    {" "}
                                    +{brlFull(Number(l.comissao_venda_cents) / 100)}
                                    {l.venda_primeiro_mes ? " 1º mês" : ""}
                                  </i>
                                )}
                              </span>
                            ) : (
                              <Nd />
                            ),
                            l.comissao_cents == null ? (
                              <Nd />
                            ) : (
                              <span>
                                {brlFull(Number(l.comissao_cents) / 100)}
                                {Number(l.comissao_cheia_cents) > Number(l.comissao_cents) && (
                                  <i className="tag warn">
                                    {" "}
                                    {l.dias_comissionados}/{l.dias_do_mes} dias
                                  </i>
                                )}
                              </span>
                            ),
                          ]
                        : []),
                    ])}
                    vazio="Nenhuma empresa na carteira."
                  />
                </Panel>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
