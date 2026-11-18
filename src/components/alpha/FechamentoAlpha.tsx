// Fechamento do mês: o dono confere os números e fecha o mês até o dia 10 do mês seguinte.
// É o que prova que o sistema está alimentado (um dos critérios do Capital do Próximo Salto).
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, dataBR } from "@/components/painel-controle/fmt";
import type { DadosAlpha } from "./tipos";
import { MESES_NOME, despesaTotalReal, lucroReal } from "./tipos";
import { situacaoMeses, type ExtrasAlpha, type SituacaoMes } from "./analise";

const ROT: Record<SituacaoMes["estado"], { t: string; c: string }> = {
  futuro: { t: "Ainda não terminou", c: "n" }, aberto: { t: "Aberto, no prazo", c: "a" }, atrasado: { t: "Passou do prazo", c: "r" },
  fechado: { t: "Fechado no prazo", c: "g" }, fechado_fora: { t: "Fechado fora do prazo", c: "a" },
};

export function FechamentoAlpha({ d, x, projectId, onSalvo, irPara }: {
  d: DadosAlpha; x: ExtrasAlpha; projectId: string; onSalvo: () => void; irPara: (aba: string) => void;
}) {
  const db = supabase as any;
  const sit = situacaoMeses(d, x.fechamentos);
  const [obs, setObs] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);
  const noPrazo = sit.filter((s) => s.estado === "fechado").length;
  const pend = sit.filter((s) => s.estado === "aberto" || s.estado === "atrasado");

  const fechar = async (mes: number) => {
    setOcupado(mes);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("alpha_fechamentos").upsert({
      project_id: projectId, ano: d.ano, mes, fechado_em: new Date().toISOString(), fechado_por: u?.user?.id ?? null, observacao: obs[mes]?.trim() || null,
    });
    setOcupado(null);
    if (error) { toast.error(`Não fechou: ${error.message}`); return; }
    toast.success(`${MESES_NOME[mes - 1]} fechado.`);
    onSalvo();
  };
  const reabrir = async (mes: number) => {
    if (!window.confirm(`Reabrir ${MESES_NOME[mes - 1].toLowerCase()}? O registro de fechamento no prazo será perdido.`)) return;
    const { error } = await db.from("alpha_fechamentos").delete().eq("project_id", projectId).eq("ano", d.ano).eq("mes", mes);
    if (error) toast.error(error.message); else onSalvo();
  };

  return (
    <>
      <div className="al-aviso">
        Todo mês você confere os números e fecha o mês aqui, até o dia 10 do mês seguinte. Mês fechado no prazo conta para o Capital do Próximo Salto.
        Neste ano: <b>{noPrazo} fechados no prazo</b>{pend.length ? <> e <b>{pend.length} aguardando fechamento</b></> : null}.
      </div>
      <div className="al-fech">
        {sit.map((s) => {
          const m = d.dre.find((k) => k.mes === s.mes)!;
          const rot = ROT[s.estado];
          const podeFechar = s.estado === "aberto" || s.estado === "atrasado";
          const semDespesa = despesaTotalReal(m) === 0, semReceita = m.receita === 0;
          const checks = [
            { ok: !semReceita, t: "Vendas do mês lançadas" },
            { ok: !semDespesa, t: "Despesas do mês lançadas" },
            { ok: m.sem_categoria === 0, t: m.sem_categoria ? `${brl(m.sem_categoria)} em despesas sem categoria` : "Todas as despesas com categoria" },
          ];
          return (
            <div key={s.mes} className={`p al-fmes ${rot.c}`}>
              <div className="lbl">{MESES_NOME[s.mes - 1]}</div>
              <span className={`st ${rot.c}`}>{rot.t}</span>
              {s.estado !== "futuro" && (
                <>
                  <div className="v" style={{ fontSize: 18, fontWeight: 800, margin: "8px 0 2px" }}><span className={lucroReal(m) >= 0 ? "pos" : "neg"}>{brl(lucroReal(m))}</span></div>
                  <div className="sub">lucro · faturamento {brl(m.receita)} · {m.lancamentos} lançamentos</div>
                  <div style={{ margin: "10px 0" }}>
                    {checks.map((c) => <div key={c.t} className="al-chkl"><span className={c.ok ? "ok" : "no"}>{c.ok ? "✓" : "!"}</span>{c.t}</div>)}
                  </div>
                </>
              )}
              {s.estado === "futuro" && <div className="sub" style={{ marginTop: 8 }}>Fecha até {dataBR(s.prazo.toISOString())}.</div>}
              {podeFechar && (
                <>
                  <div className="sub">Prazo: {dataBR(s.prazo.toISOString())}</div>
                  <input className="al-in" style={{ width: "100%", marginTop: 8 }} placeholder="Observação (opcional)" value={obs[s.mes] ?? ""} onChange={(e) => setObs({ ...obs, [s.mes]: e.target.value })} />
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="al-btn pri" disabled={ocupado === s.mes} onClick={() => fechar(s.mes)}>{ocupado === s.mes ? "Fechando..." : "Fechar o mês"}</button>
                    <button type="button" className="al-btn" onClick={() => irPara("lancamentos")}>Conferir lançamentos</button>
                  </div>
                </>
              )}
              {(s.estado === "fechado" || s.estado === "fechado_fora") && (
                <>
                  <div className="sub">Fechado em {dataBR(s.fechadoEm)} · prazo era {dataBR(s.prazo.toISOString())}</div>
                  {x.fechamentos.find((f) => f.mes === s.mes)?.observacao && <div className="sub" style={{ marginTop: 4 }}>"{x.fechamentos.find((f) => f.mes === s.mes)?.observacao}"</div>}
                  <button type="button" className="al-btn" style={{ marginTop: 8 }} onClick={() => reabrir(s.mes)}>Reabrir</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <Panel titulo="Como fechar um mês">
        <div className="sub" style={{ lineHeight: 1.7 }}>
          1. Confira se todas as vendas e despesas do mês estão no sistema (aba Lançamentos).<br />
          2. Classifique o que estiver sem categoria, para o DRE mostrar onde o dinheiro foi.<br />
          3. Olhe o DRE e o fluxo de caixa do mês. Se o número não bate com o banco, corrija antes de fechar.<br />
          4. Clique em Fechar o mês. O sistema registra a data, e o mês passa a valer no diagnóstico e na participação de lucro.
        </div>
      </Panel>
    </>
  );
}
