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
}

interface Config {
  id: string;
  consultant_id: string | null;
  piso_cents: number;
  percentual: number;
  teto_cents: number | null;
  percentual_venda: number;
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
  const [form, setForm] = useState({ piso: "", pct: "", pctVenda: "", teto: "", semVenda: "" });
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [drill, setDrill] = useState<Drill>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [consultor, setConsultor] = useState("");
  const [consultores, setConsultores] = useState<{ value: string; label: string }[]>([]);
  const [mesFoco, setMesFoco] = useState("");

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
      const [carteira, hist, com] = await Promise.all([
        supabase.rpc("carteira_consultores", { p_consultant_id: alvo }),
        supabase.rpc("carteira_consultores_historico", { p_consultant_id: alvo, p_meses: 12 }),
        supabase.rpc("carteira_comissao_resumo", { p_consultant_id: alvo }),
      ]);
      if (cancelado) return;
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
        .select("id, consultant_id, piso_cents, percentual, teto_cents, percentual_venda, produtos_sem_venda");
      const mapa: Record<string, Config> = {};
      ((data || []) as Config[]).forEach((c) => {
        mapa[c.consultant_id || PADRAO] = c;
      });
      setConfigs(mapa);
    })();
  }, [carregandoPerm, isMaster, recarregar]);

  const config = configs[PADRAO] || null;

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
    const teto = form.teto.trim() === "" ? null : Math.round(Number(form.teto.replace(",", ".")) * 100);
    if (!Number.isFinite(piso) || !Number.isFinite(pct) || !Number.isFinite(pctVenda)) return;

    const campos: Record<string, unknown> = {
      piso_cents: piso,
      percentual: pct,
      percentual_venda: pctVenda,
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
        semVenda: config.produtos_sem_venda || [],
      };
    }
    const c = comissao[0];
    if (!c) return null;
    return {
      piso: Number(c.piso_cents) / 100,
      pct: Number(c.percentual),
      pctVenda: Number(c.percentual_venda ?? 0),
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
                  <b>Base:</b> o valor mensalizado, zerado na parte que o cliente não pagou. Quem
                  quitou adiantado não tem fatura no mês e conta cheio; quem está com fatura em
                  aberto entra só pelo que pagou. Quem pede cancelamento entra proporcional ao dia do
                  pedido, não ao dia em que o contrato encerra. Cliente que pediu e foi retido volta
                  a valer cheio.
                  <br />
                  <b>Venda:</b> {params?.pctVenda ?? 0}% pra quem vendeu o serviço, por cima do
                  mesmo projeto e enquanto o cliente ficar. Não tira nada de quem entrega, os dois
                  recebem. Para se a pessoa sair da equipe.
                  {params?.semVenda?.length
                    ? ` Fora da comissão de venda: ${params.semVenda.join(", ")}.`
                    : ""}
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
                        { k: "teto", rot: "Referência (R$)", w: 120 },
                        ...(editando === PADRAO
                          ? [{ k: "semVenda" as const, rot: "Produtos sem comissão de venda", w: 230 }]
                          : []),
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
