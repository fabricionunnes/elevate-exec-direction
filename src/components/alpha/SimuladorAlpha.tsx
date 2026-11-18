// Simulador de lucro: mexe em preço, volume, custo variável e despesa fixa e mostra o efeito
// no lucro do mês e do ano. A base é a média dos últimos meses fechados da própria empresa.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Tabela } from "@/components/painel-controle/ui";
import { brl, fp } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Resumo } from "./tipos";
import { baseMensal, simular, type Alavancas } from "./analise";

const ZERO: Alavancas = { preco: 0, volume: 0, custo: 0, fixa: 0 };
const ALAV: { k: keyof Alavancas; nome: string; dica: string; min: number; max: number }[] = [
  { k: "preco", nome: "Preço", dica: "reajuste de tabela ou menos desconto", min: -20, max: 30 },
  { k: "volume", nome: "Volume de vendas", dica: "mais clientes ou mais vendas por cliente", min: -30, max: 50 },
  { k: "custo", nome: "Custo variável", dica: "fornecedor, frete, comissão, insumo", min: -30, max: 30 },
  { k: "fixa", nome: "Despesa fixa", dica: "pessoal, aluguel, sistemas, marketing fixo", min: -30, max: 30 },
];
const sinal = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

export function SimuladorAlpha({ d, r, projectId, onSalvo }: { d: DadosAlpha; r: Resumo; projectId: string; onSalvo: () => void }) {
  const b = baseMensal(d, r.caixaAtual);
  const [a, setA] = useState<Alavancas>(ZERO);
  const s = simular(b, a);
  const base = simular(b, ZERO);
  const ganhoMes = s.lucro - base.lucro;
  const restam = Math.max(12 - r.fechado, 0);
  const metaMes = restam > 0 ? (r.lucroAnoPlano - r.lucroAcum) / restam : null;

  if (!b.meses) return <div className="al-vazio">O simulador usa a média dos últimos meses fechados. Lance as vendas e despesas de pelo menos um mês para começar.</div>;

  const descricao = ALAV.filter((x) => a[x.k] !== 0).map((x) => `${x.nome.toLowerCase()} ${sinal(a[x.k])}`).join(", ");
  const virarAcao = async () => {
    const { error } = await (supabase as any).from("alpha_acoes").insert({
      project_id: projectId, ano: d.ano, origem: "simulador", texto: `Cenário do simulador: ${descricao}`, impacto_mensal: Math.round(ganhoMes),
    });
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    toast.success("Cenário salvo no plano de ação.");
    onSalvo();
  };
  // 1 ponto percentual em cada alavanca, isolada: mostra qual pesa mais no lucro
  const peso = ALAV.map((x) => {
    const um = simular(b, { ...ZERO, [x.k]: x.k === "custo" || x.k === "fixa" ? -0.01 : 0.01 });
    return { nome: x.nome, ganho: um.lucro - base.lucro, sentido: x.k === "custo" || x.k === "fixa" ? "1% a menos" : "1% a mais" };
  }).sort((p, q) => q.ganho - p.ganho);

  return (
    <>
      <div className="al-aviso">
        Base do cálculo: média dos últimos {b.meses} meses fechados. Faturamento de {brl(b.receita)}, custo variável de {brl(b.custoVariavel)},
        despesa fixa de {brl(b.fixa)} e lucro de {brl(b.lucro)} por mês. Mexa nas alavancas e veja o que acontece.
      </div>
      <div className="grid r2">
        <Panel titulo="As quatro alavancas do lucro" sub="arraste ou digite o percentual">
          {ALAV.map((x) => (
            <div key={x.k} className="al-alav">
              <div><b>{x.nome}</b><small>{x.dica}</small></div>
              <input type="range" min={x.min} max={x.max} step={1} value={Math.round(a[x.k] * 100)} aria-label={x.nome}
                onChange={(e) => setA({ ...a, [x.k]: Number(e.target.value) / 100 })} />
              <div className="pc-in">
                <input className="al-in num" inputMode="numeric" value={Math.round(a[x.k] * 100)} aria-label={`${x.nome} em percentual`}
                  onChange={(e) => { const v = Number(e.target.value.replace(/[^\d-]/g, "")) || 0; setA({ ...a, [x.k]: Math.max(Math.min(v, 200), -90) / 100 }); }} />
                <span>%</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" className="al-btn" onClick={() => setA(ZERO)}>Zerar</button>
            <button type="button" className="al-btn" onClick={() => setA({ preco: 0.05, volume: 0, custo: 0, fixa: 0 })}>Preço +5%</button>
            <button type="button" className="al-btn" onClick={() => setA({ preco: 0, volume: 0.15, custo: 0, fixa: 0 })}>Volume +15%</button>
            <button type="button" className="al-btn" onClick={() => setA({ preco: 0.03, volume: 0.1, custo: -0.03, fixa: -0.05 })}>Um pouco de cada</button>
          </div>
        </Panel>
        <Panel titulo="Lucro no cenário" sub="por mês, com a base atual">
          <div className={`al-big ${s.lucro >= 0 ? "pos" : "neg"}`}>{brl(s.lucro)}</div>
          <div className="sub">hoje {brl(base.lucro)} · margem de {fp(s.margem)}</div>
          <div className={`al-ganho ${ganhoMes >= 0 ? "pos" : "neg"}`}>{ganhoMes >= 0 ? "+" : ""}{brl(ganhoMes)} por mês · {ganhoMes >= 0 ? "+" : ""}{brl(ganhoMes * 12)} em 12 meses</div>
          {metaMes != null && metaMes > 0 && (
            <div className="sub" style={{ marginTop: 10 }}>
              Para fechar o ano no plano você precisa de {brl(metaMes)} de lucro por mês.{" "}
              {s.lucro >= metaMes ? <span className="st g">Este cenário chega lá</span> : <span className="st a">Faltam {brl(metaMes - s.lucro)} por mês</span>}
            </div>
          )}
          <button type="button" className="al-btn pri" style={{ marginTop: 14 }} disabled={!descricao} onClick={virarAcao}>Salvar cenário no plano de ação</button>
        </Panel>
      </div>
      <div className="grid r2">
        <Panel titulo="O mês, hoje e no cenário">
          <Tabela cols={[{ h: "", tl: true }, "Hoje", "Cenário", "Diferença"]} rows={[
            ["Faturamento", brl(base.receita), brl(s.receita), brl(s.receita - base.receita)],
            ["Impostos e deduções", brl(base.deducao), brl(s.deducao), brl(s.deducao - base.deducao)],
            ["Custo variável", brl(base.custoVariavel), brl(s.custoVariavel), brl(s.custoVariavel - base.custoVariavel)],
            ["Despesa fixa", brl(base.fixa), brl(s.fixa), brl(s.fixa - base.fixa)],
            ["Financeiro", brl(b.financeiro), brl(b.financeiro), brl(0)],
            [<b key="l">Lucro líquido</b>, <b key="a">{brl(base.lucro)}</b>, <b key="b" className={s.lucro >= 0 ? "pos" : "neg"}>{brl(s.lucro)}</b>, <b key="c" className={ganhoMes >= 0 ? "pos" : "neg"}>{brl(ganhoMes)}</b>],
            ["Margem líquida", fp(base.margem), fp(s.margem), ""],
          ]} />
        </Panel>
        <Panel titulo="Qual alavanca pesa mais" sub="efeito de 1 ponto percentual, sozinha, no lucro do mês">
          {peso.map((p) => (
            <div key={p.nome} className="al-comp"><span>{p.nome} <span className="nd">· {p.sentido}</span></span><b className="pos">+{brl(p.ganho)}</b><span /></div>
          ))}
          <div className="note" style={{ marginTop: 8 }}>Conta simplificada: impostos acompanham o faturamento e o custo variável acompanha o volume. Use para comparar caminhos, não como previsão exata.</div>
        </Panel>
      </div>
    </>
  );
}
