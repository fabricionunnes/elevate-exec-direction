// Carteira do consultor: quanto cada empresa vale por mês, com contrato anual
// já dividido pelos meses. Mesma linguagem visual do Painel de Controle.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import "@/components/painel-controle/painel.css";
import { Tile, Panel, Tabela, Barras, BarrasItens, Combo, Lk, Nd, St } from "@/components/painel-controle/ui";
import { brl, brlFull, mesAno, plural } from "@/components/painel-controle/fmt";

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
}

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
      const [carteira, hist] = await Promise.all([
        supabase.rpc("carteira_consultores", { p_consultant_id: alvo }),
        supabase.rpc("carteira_consultores_historico", { p_consultant_id: alvo, p_meses: 12 }),
      ]);
      if (cancelado) return;
      if (carteira.error) console.error("carteira_consultores", carteira.error);
      if (hist.error) console.error("carteira_consultores_historico", hist.error);
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
  }, [consultor, carregandoPerm]);

  const total = useMemo(() => linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100, [linhas]);
  const successFee = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0) / 100,
    [linhas],
  );
  const empresas = useMemo(() => new Set(linhas.map((l) => l.company_id)).size, [linhas]);
  const ticket = linhas.length ? total / linhas.length : 0;
  const vencidos = useMemo(() => linhas.filter((l) => l.contrato_vencido), [linhas]);
  const vencendo = useMemo(
    () =>
      linhas.filter(
        (l) =>
          !l.recorrente &&
          !l.contrato_vencido &&
          l.dias_para_vencer !== null &&
          l.dias_para_vencer >= 0 &&
          l.dias_para_vencer <= 60,
      ),
    [linhas],
  );
  const recorrentes = useMemo(() => linhas.filter((l) => l.recorrente).length, [linhas]);
  const saindo = useMemo(() => linhas.filter((l) => l.project_status !== "active"), [linhas]);
  const valorEmRisco = useMemo(
    () => saindo.reduce((s, l) => s + Number(l.monthly_cents || 0), 0) / 100,
    [saindo],
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
                onChange={setConsultor}
              />
            )}
            <button type="button" className="back" onClick={() => navigate("/onboarding-tasks")}>
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
        ) : (
          <>
            <div className="grid k5">
              <Tile main label="Carteira por mês" valor={brl(total)} sub={plural(empresas, "empresa", "empresas")} />
              <Tile
                label="Contratos"
                valor={String(linhas.length)}
                sub={`${recorrentes} recorrentes · ticket ${brl(ticket)}`}
              />
              <Tile
                label="Faturado no mês"
                valor={foco ? brl(foco.faturado) : "-"}
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
              />
              <Tile
                label="Success fee possível"
                valor={brl(successFee)}
                sub="o cliente paga isso a mais quando bate a meta"
              />
            </div>

            {(vencidos.length > 0 || saindo.length > 0 || vencendo.length > 0) && (
              <div className="grid r4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <Panel titulo="Contratos de prazo vencidos" sub={String(vencidos.length)}>
                  {vencidos.length ? (
                    <Tabela
                      cols={[{ h: "Empresa", tl: true }, "Por mês"]}
                      rows={vencidos.slice(0, 6).map((l) => [l.company_name, brl(Number(l.monthly_cents) / 100)])}
                    />
                  ) : (
                    <div className="empty">Nenhum</div>
                  )}
                </Panel>
                <Panel titulo="Contratos de prazo vencendo" sub={`${vencendo.length} em 60 dias`}>
                  {vencendo.length ? (
                    <Tabela
                      cols={[{ h: "Empresa", tl: true }, "Vence em"]}
                      rows={vencendo.slice(0, 6).map((l) => [l.company_name, `${l.dias_para_vencer} dias`])}
                    />
                  ) : (
                    <div className="empty">Nenhum</div>
                  )}
                </Panel>
                <Panel titulo="Clientes saindo" sub={saindo.length ? brl(valorEmRisco) : "0"}>
                  {saindo.length ? (
                    <Tabela
                      cols={[{ h: "Empresa", tl: true }, "Por mês"]}
                      rows={saindo.slice(0, 6).map((l) => [l.company_name, brl(Number(l.monthly_cents) / 100)])}
                    />
                  ) : (
                    <div className="empty">Nenhum</div>
                  )}
                </Panel>
              </div>
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

            {porConsultor.map((g) => (
              <Panel key={g.id} titulo={g.nome} sub={`${plural(g.linhas.length, "contrato", "contratos")} · ${brlFull(g.total)} por mês`}>
                <Tabela
                  cols={[
                    { h: "Empresa", tl: true },
                    { h: "Produto", tl: true },
                    "Por mês",
                    { h: "Como foi calculado", tl: true },
                    "Se bater meta",
                  ]}
                  rows={g.linhas.map((l) => [
                    <span>
                      {l.company_name}
                      {l.project_status !== "active" && (
                        <i className="tag neg"> {rotuloStatus[l.project_status] || l.project_status}</i>
                      )}
                      {l.contrato_vencido && <i className="tag warn"> contrato vencido</i>}
                      {!l.recorrente && !l.contrato_vencido && l.dias_para_vencer !== null && l.dias_para_vencer <= 60 && (
                        <i className="tag"> vence em {l.dias_para_vencer} dias</i>
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
                  ])}
                  vazio="Nenhuma empresa na carteira."
                />
              </Panel>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
