// Planejamento anual do Alpha: o empresário monta o ano no sistema (faturamento 15% maior,
// orçamento de despesas, lucro e regra de distribuição). Tudo editável mês a mês.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, fp } from "@/components/painel-controle/fmt";
import type { DadosAlpha, PlanoMes } from "./tipos";
import { MESES_CURTO, lucroPlano, soma, despesaFixa } from "./tipos";

const LINHAS: { k: keyof Omit<PlanoMes, "mes">; nome: string }[] = [
  { k: "receita", nome: "Faturamento" },
  { k: "deducoes", nome: "Impostos e deduções" },
  { k: "custo_variavel", nome: "Custo variável" },
  { k: "despesa_fixa", nome: "Despesas fixas" },
  { k: "financeiro", nome: "Financeiro" },
  { k: "investimento", nome: "Investimento (abaixo do lucro)" },
];
const vazio = (mes: number): PlanoMes => ({ mes, receita: 0, deducoes: 0, custo_variavel: 0, despesa_fixa: 0, financeiro: 0, investimento: 0 });
const n = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtIn = (v: number) => (v ? Math.round(v).toLocaleString("pt-BR") : "");
/** percentual: ponto ou vírgula são casa decimal ("8.5" e "8,5" valem 8,5) */
const pctN = (v: string) => Number(String(v).replace(",", ".")) || 0;

export function PlanejamentoAlpha({ d, anterior, projectId, onSalvo }: { d: DadosAlpha; anterior: DadosAlpha | null; projectId: string; onSalvo: () => void }) {
  // base do ano anterior, quando existe no sistema
  const base = useMemo(() => {
    if (!anterior) return null;
    const rec = soma(anterior.dre.map((m) => m.receita));
    if (!rec) return null;
    return {
      receita: rec,
      porMes: anterior.dre.map((m) => m.receita),
      pctDed: soma(anterior.dre.map((m) => m.deducao)) / rec,
      pctCv: soma(anterior.dre.map((m) => m.custo_variavel)) / rec,
      fixaMes: soma(anterior.dre.map(despesaFixa)) / 12,
      finMes: soma(anterior.dre.map((m) => m.financeiro)) / 12,
    };
  }, [anterior]);

  const [cfg, setCfg] = useState({
    crescimento_pct: d.plano?.crescimento_pct ?? 15,
    faturamento_ano_anterior: d.plano?.faturamento_ano_anterior ?? base?.receita ?? 0,
    reserva_caixa_alvo: d.plano?.reserva_caixa_alvo ?? 0,
    pct_reinvestimento: d.plano?.pct_reinvestimento ?? 20,
    saldo_caixa_inicial: d.plano?.saldo_caixa_inicial ?? 0,
    observacoes: d.plano?.observacoes ?? "",
  });
  const [premissa, setPremissa] = useState({
    pctDed: Math.round((base?.pctDed ?? 0.08) * 1000) / 10,
    pctCv: Math.round((base?.pctCv ?? 0.3) * 1000) / 10,
    fixaMes: Math.round(base?.fixaMes ?? 0),
  });
  const [meses, setMeses] = useState<PlanoMes[]>(() => Array.from({ length: 12 }, (_, i) => ({ ...vazio(i + 1), ...(d.plano_meses.find((p) => p.mes === i + 1) ?? {}) })));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setMeses(Array.from({ length: 12 }, (_, i) => ({ ...vazio(i + 1), ...(d.plano_meses.find((p) => p.mes === i + 1) ?? {}) })));
  }, [d.plano_meses]);

  const gerar = () => {
    const alvo = cfg.faturamento_ano_anterior * (1 + cfg.crescimento_pct / 100);
    // distribui pela sazonalidade do ano anterior quando ela existe; senão, igual nos 12 meses
    const pesos = base && base.receita ? base.porMes.map((v) => v / base.receita) : Array(12).fill(1 / 12);
    setMeses(pesos.map((w, i) => {
      const receita = Math.round(alvo * w);
      return {
        mes: i + 1, receita,
        deducoes: Math.round(receita * premissa.pctDed / 100),
        custo_variavel: Math.round(receita * premissa.pctCv / 100),
        despesa_fixa: premissa.fixaMes,
        financeiro: Math.round(base?.finMes ?? 0),
        investimento: meses[i]?.investimento ?? 0,
      };
    }));
    toast.success("Plano montado. Ajuste o que quiser mês a mês e salve.");
  };

  const salvar = async () => {
    setSalvando(true);
    const db = supabase as any;
    const { error: e1 } = await db.from("alpha_planos").upsert({ project_id: projectId, ano: d.ano, ...cfg, updated_at: new Date().toISOString() });
    const { error: e2 } = e1 ? { error: null } : await db.from("alpha_plano_meses").upsert(meses.map((m) => ({ project_id: projectId, ano: d.ano, ...m })));
    setSalvando(false);
    if (e1 || e2) { toast.error(`Não salvou: ${(e1 || e2).message}`); return; }
    toast.success("Planejamento salvo.");
    onSalvo();
  };

  const tot = (k: keyof Omit<PlanoMes, "mes">) => soma(meses.map((m) => m[k]));
  const recAno = tot("receita");
  const lucroAno = soma(meses.map(lucroPlano));

  return (
    <>
      <Panel titulo={`Planejamento ${d.ano}`} sub="as premissas montam o plano; depois tudo é editável mês a mês">
        <div className="al-form">
          <label>Faturamento do ano anterior<input className="al-in num" value={fmtIn(cfg.faturamento_ano_anterior)} onChange={(e) => setCfg({ ...cfg, faturamento_ano_anterior: n(e.target.value) })} /></label>
          <label>Crescimento (%)<input className="al-in num" value={cfg.crescimento_pct} onChange={(e) => setCfg({ ...cfg, crescimento_pct: pctN(e.target.value) })} /></label>
          <label>Impostos (% do faturamento)<input className="al-in num" value={premissa.pctDed} onChange={(e) => setPremissa({ ...premissa, pctDed: pctN(e.target.value) })} /></label>
          <label>Custo variável (%)<input className="al-in num" value={premissa.pctCv} onChange={(e) => setPremissa({ ...premissa, pctCv: pctN(e.target.value) })} /></label>
          <label>Despesa fixa por mês<input className="al-in num" value={fmtIn(premissa.fixaMes)} onChange={(e) => setPremissa({ ...premissa, fixaMes: n(e.target.value) })} /></label>
          <button type="button" className="al-btn" onClick={gerar}>Montar plano</button>
        </div>
        <div className="al-form" style={{ marginTop: 12 }}>
          <label>Saldo de caixa em 1º de janeiro<input className="al-in num" value={fmtIn(cfg.saldo_caixa_inicial)} onChange={(e) => setCfg({ ...cfg, saldo_caixa_inicial: n(e.target.value) })} /></label>
          <label>Reserva de caixa (alvo)<input className="al-in num" value={fmtIn(cfg.reserva_caixa_alvo)} onChange={(e) => setCfg({ ...cfg, reserva_caixa_alvo: n(e.target.value) })} /></label>
          <label>Reinvestimento do lucro (%)<input className="al-in num" value={cfg.pct_reinvestimento} onChange={(e) => setCfg({ ...cfg, pct_reinvestimento: pctN(e.target.value) })} /></label>
        </div>
        {base && <div className="al-aviso" style={{ marginTop: 12 }}>
          Ano anterior no sistema: faturamento {brl(base.receita)}, impostos {fp(base.pctDed)}, custo variável {fp(base.pctCv)}, despesa fixa média {brl(base.fixaMes)} por mês. O plano usa a sazonalidade desse ano.
        </div>}
      </Panel>

      <Panel titulo="O plano mês a mês" sub={`faturamento ${brl(recAno)} · lucro líquido ${brl(lucroAno)} · margem ${fp(recAno ? lucroAno / recAno : null)}`} cls="wide">
        <div className="tw">
          <table className="al-grade">
            <thead><tr><th className="tl">Linha</th>{MESES_CURTO.map((m) => <th key={m}>{m}</th>)}<th>Ano</th></tr></thead>
            <tbody>
              {LINHAS.map((l) => (
                <tr key={l.k}>
                  <td className="tl">{l.nome}</td>
                  {meses.map((m, i) => (
                    <td key={i}><input className="al-in num" value={fmtIn(m[l.k])} onChange={(e) => {
                      const v = n(e.target.value);
                      setMeses((ms) => ms.map((x, j) => (j === i ? { ...x, [l.k]: v } : x)));
                    }} /></td>
                  ))}
                  <td>{brl(tot(l.k))}</td>
                </tr>
              ))}
              <tr className="lucro">
                <td className="tl">Lucro líquido</td>
                {meses.map((m) => <td key={m.mes}>{brl(lucroPlano(m))}</td>)}
                <td>{brl(lucroAno)}</td>
              </tr>
              <tr>
                <td className="tl">Margem líquida</td>
                {meses.map((m) => <td key={m.mes}>{fp(m.receita ? lucroPlano(m) / m.receita : null)}</td>)}
                <td>{fp(recAno ? lucroAno / recAno : null)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <textarea className="al-in" style={{ flex: 1, minHeight: 36 }} placeholder="Observações do planejamento (premissas, decisões, investimentos)" value={cfg.observacoes ?? ""} onChange={(e) => setCfg({ ...cfg, observacoes: e.target.value })} />
          <button type="button" className="al-btn pri" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar planejamento"}</button>
        </div>
      </Panel>
    </>
  );
}
