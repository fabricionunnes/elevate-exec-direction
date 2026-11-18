// Diagnóstico do Alpha: o sistema lê os números, aponta onde o lucro está escapando
// e cada alerta pode virar uma ação com dono, prazo e impacto esperado.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Tabela } from "@/components/painel-controle/ui";
import { brl, dataBR, fp } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Resumo } from "./tipos";
import { MESES_CURTO } from "./tipos";
import { alertas, baseMensal, desvios, type Acao, type ExtrasAlpha } from "./analise";

const num = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const ST: Record<Acao["status"], string> = { aberta: "Aberta", andamento: "Em andamento", feita: "Feita", cancelada: "Cancelada" };

export function DiagnosticoAlpha({ d, r, x, projectId, onSalvo, irPara }: {
  d: DadosAlpha; r: Resumo; x: ExtrasAlpha; projectId: string; onSalvo: () => void; irPara: (aba: string) => void;
}) {
  const db = supabase as any;
  const b = baseMensal(d, r.caixaAtual);
  const al = alertas(d, r, b);
  const dv = desvios(d);
  const [nova, setNova] = useState({ texto: "", responsavel: "", prazo: "", impacto: "" });
  const [salvando, setSalvando] = useState(false);

  const criar = async (texto: string, origem: string, impacto?: number, extra?: { responsavel?: string; prazo?: string }) => {
    if (!texto.trim()) return;
    setSalvando(true);
    const { error } = await db.from("alpha_acoes").insert({
      project_id: projectId, ano: d.ano, origem, texto: texto.trim(), impacto_mensal: impacto ? Math.round(impacto) : null,
      responsavel: extra?.responsavel?.trim() || null, prazo: extra?.prazo || null,
    });
    setSalvando(false);
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    toast.success("Ação criada no plano.");
    setNova({ texto: "", responsavel: "", prazo: "", impacto: "" });
    onSalvo();
  };
  const mudar = async (a: Acao, campos: Partial<Acao>) => {
    const { error } = await db.from("alpha_acoes").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) toast.error(error.message); else onSalvo();
  };
  const excluir = async (a: Acao) => {
    if (!window.confirm("Excluir esta ação do plano?")) return;
    const { error } = await db.from("alpha_acoes").delete().eq("id", a.id);
    if (error) toast.error(error.message); else onSalvo();
  };

  const abertas = x.acoes.filter((a) => a.status === "aberta" || a.status === "andamento");
  const impactoAberto = abertas.reduce((s, a) => s + (a.impacto_mensal ?? 0), 0);
  const hoje = new Date().toISOString().slice(0, 10);
  const jaTem = (t: string) => x.acoes.some((a) => a.texto === t && a.status !== "cancelada");

  return (
    <>
      <div className="grid k4">
        <div className="p"><div className="lbl">Ponto de equilíbrio</div><div className="val">{b.pontoEquilibrio == null ? "-" : brl(b.pontoEquilibrio)}</div>
          <div className="sub">{b.pontoEquilibrio && b.receita ? `faturamento médio ${brl(b.receita)} · folga de ${fp(b.receita / b.pontoEquilibrio - 1)}` : "faturamento mínimo para pagar as contas"}</div></div>
        <div className="p"><div className="lbl">Margem de contribuição</div><div className="val">{b.margemContribuicao == null ? "-" : fp(b.margemContribuicao)}</div>
          <div className="sub">o que sobra de cada real vendido para pagar a despesa fixa</div></div>
        <div className="p"><div className="lbl">Fôlego de caixa</div><div className={`val ${b.folegoMeses == null ? "" : b.folegoMeses >= 2 ? "pos" : b.folegoMeses >= 1 ? "warn" : "neg"}`}>{b.folegoMeses == null ? "-" : `${b.folegoMeses.toFixed(1).replace(".", ",")} meses`}</div>
          <div className="sub">caixa de {brl(r.caixaAtual)} sobre a despesa fixa mensal</div></div>
        <div className="p"><div className="lbl">Projeção de lucro do ano</div><div className={`val ${r.projecaoLucroAno >= r.lucroAnoPlano ? "pos" : "warn"}`}>{brl(r.projecaoLucroAno)}</div>
          <div className="sub">plano do ano {brl(r.lucroAnoPlano)}</div></div>
      </div>

      <Panel titulo="O que os seus números estão dizendo" sub={`leitura automática até ${r.fechado ? MESES_CURTO[r.fechado - 1].toLowerCase() : "o início do ano"} · base: média dos últimos ${b.meses || 0} meses`}>
        {al.length === 0 && <div className="empty">Nenhum ponto de atenção nos números fechados.</div>}
        {al.map((a) => (
          <div key={a.titulo} className={`al-alerta ${a.nivel}`}>
            <i />
            <div><b>{a.titulo}</b><p>{a.texto}</p></div>
            {a.acao && (jaTem(a.acao)
              ? <span className="st g">No plano de ação</span>
              : <button type="button" className="al-btn" disabled={salvando} onClick={() => criar(a.acao!, "diagnostico", a.impacto)}>Virar ação</button>)}
          </div>
        ))}
      </Panel>

      <div className="grid r2">
        <Panel titulo="Onde o plano e o realizado se separaram" sub="acumulado dos meses fechados">
          <Tabela cols={[{ h: "", tl: true }, "Realizado", "Plano", "Diferença", "Efeito no lucro"]} rows={dv.map((l) => [
            l.nome, brl(l.real), brl(l.plano),
            <span key="d" className={l.dif === 0 ? "" : l.ruim ? "neg" : "pos"}>{l.dif > 0 ? "+" : ""}{brl(l.dif)}{l.pct != null ? ` (${fp(l.pct)})` : ""}</span>,
            <b key="e" className={l.efeitoLucro >= 0 ? "pos" : "neg"}>{l.efeitoLucro > 0 ? "+" : ""}{brl(l.efeitoLucro)}</b>,
          ])} />
          <div className="note" style={{ marginTop: 8 }}>Efeito no lucro: quanto cada linha somou ou tirou do lucro em relação ao que foi planejado.</div>
        </Panel>
        <Panel titulo="Testar uma saída" sub="antes de decidir, veja o efeito no lucro">
          <div className="sub" style={{ lineHeight: 1.6 }}>O simulador mostra quanto o lucro muda quando você mexe em preço, volume, custo variável e despesa fixa. O que fizer sentido vira ação aqui no plano.</div>
          <button type="button" className="al-btn pri" style={{ marginTop: 12 }} onClick={() => irPara("simulador")}>Abrir o simulador</button>
        </Panel>
      </div>

      <Panel titulo="Plano de ação" sub={abertas.length ? `${abertas.length} em aberto · impacto esperado de ${brl(impactoAberto)} por mês no lucro` : "o que será feito, por quem e até quando"}>
        {x.acoes.length === 0 && <div className="empty">Nenhuma ação ainda. Use "Virar ação" nos alertas ou escreva a sua abaixo.</div>}
        {x.acoes.map((a) => {
          const vencida = a.prazo && a.prazo < hoje && (a.status === "aberta" || a.status === "andamento");
          return (
            <div key={a.id} className={`al-acao ${a.status}`}>
              <div>
                <b>{a.texto}</b>
                <small>
                  {a.responsavel ? `${a.responsavel} · ` : ""}
                  {a.prazo ? <span className={vencida ? "neg" : ""}>prazo {dataBR(a.prazo)}{vencida ? " (vencido)" : ""}</span> : "sem prazo"}
                  {a.impacto_mensal ? ` · impacto de ${brl(a.impacto_mensal)} por mês` : ""}
                </small>
              </div>
              <input className="al-in" style={{ width: 120 }} placeholder="Responsável" defaultValue={a.responsavel ?? ""} onBlur={(e) => e.target.value !== (a.responsavel ?? "") && mudar(a, { responsavel: e.target.value || null })} />
              <input className="al-in" type="date" defaultValue={a.prazo ?? ""} onBlur={(e) => e.target.value !== (a.prazo ?? "") && mudar(a, { prazo: e.target.value || null })} />
              <select className="al-sel" value={a.status} onChange={(e) => mudar(a, { status: e.target.value as Acao["status"] })}>
                {(Object.keys(ST) as Acao["status"][]).map((k) => <option key={k} value={k}>{ST[k]}</option>)}
              </select>
              <button type="button" className="al-btn" aria-label="Excluir ação" onClick={() => excluir(a)}>Excluir</button>
            </div>
          );
        })}
        <div className="al-form" style={{ marginTop: 14, gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
          <label>Nova ação<input className="al-in" value={nova.texto} placeholder="Ex.: renegociar o frete com a transportadora" onChange={(e) => setNova({ ...nova, texto: e.target.value })} /></label>
          <label>Responsável<input className="al-in" value={nova.responsavel} onChange={(e) => setNova({ ...nova, responsavel: e.target.value })} /></label>
          <label>Prazo<input className="al-in" type="date" value={nova.prazo} onChange={(e) => setNova({ ...nova, prazo: e.target.value })} /></label>
          <label>Impacto por mês (R$)<input className="al-in num" inputMode="numeric" value={nova.impacto} onChange={(e) => setNova({ ...nova, impacto: e.target.value })} /></label>
          <button type="button" className="al-btn pri" disabled={salvando || !nova.texto.trim()} onClick={() => criar(nova.texto, "manual", num(nova.impacto), nova)}>Adicionar</button>
        </div>
      </Panel>
    </>
  );
}
