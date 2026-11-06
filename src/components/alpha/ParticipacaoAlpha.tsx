// Participação de lucro trimestral: o lucro do trimestre, a reserva de caixa, o reinvestimento
// e o que vai para o bolso do dono. A sugestão sai do planejamento; a decisão fica registrada.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, dataBR } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Participacao } from "./tipos";
import { MESES_CURTO, trimestres } from "./tipos";

const n = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtIn = (v: number | null | undefined) => (v ? Math.round(v).toLocaleString("pt-BR") : "");

export function ParticipacaoAlpha({ d, projectId, onSalvo }: { d: DadosAlpha; projectId: string; onSalvo: () => void }) {
  const tris = trimestres(d);
  const [edit, setEdit] = useState<Record<number, Partial<Participacao>>>({});
  const db = supabase as any;

  const salvar = async (t: number, status: Participacao["status"]) => {
    const tr = tris[t - 1];
    const e = edit[t] ?? {};
    const reserva = e.reserva ?? tr.registro?.reserva ?? tr.sugestao.reserva;
    const reinvestimento = e.reinvestimento ?? tr.registro?.reinvestimento ?? tr.sugestao.reinvestimento;
    const distribuido = e.distribuido ?? tr.registro?.distribuido ?? Math.max(Math.max(tr.lucro, 0) - reserva - reinvestimento, 0);
    const { error } = await db.from("alpha_participacoes").upsert({
      project_id: projectId, ano: d.ano, trimestre: t, lucro_apurado: tr.lucro, reserva, reinvestimento, distribuido, status,
      pago_em: status === "paga" ? (e.pago_em ?? tr.registro?.pago_em ?? new Date().toISOString().slice(0, 10)) : null,
      observacao: e.observacao ?? tr.registro?.observacao ?? null, updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(status === "paga" ? "Participação registrada como paga." : "Participação aprovada.");
    setEdit((x) => ({ ...x, [t]: {} }));
    onSalvo();
  };
  const totalPago = d.participacoes.filter((p) => p.status === "paga").reduce((a, b) => a + (b.distribuido ?? 0), 0);

  return (
    <>
      <div className="al-aviso">
        Regra do ano: reserva de caixa alvo de {brl(d.plano?.reserva_caixa_alvo ?? 0)} e {d.plano?.pct_reinvestimento ?? 0}% do lucro reinvestido.
        O restante do lucro do trimestre é a sua participação. Ajuste a regra na aba Planejamento. Pago no ano até agora: <b>{brl(totalPago)}</b>.
      </div>
      <div className="al-tri">
        {tris.map((t) => {
          const e = edit[t.t] ?? {};
          const reg = t.registro;
          const val = (k: "reserva" | "reinvestimento" | "distribuido", sug: number) => e[k] ?? reg?.[k] ?? sug;
          const travado = reg?.status === "paga";
          return (
            <div key={t.t} className={`p ${t.fechado ? "" : "aberto"}`}>
              <div className="lbl">{t.t}º trimestre · {MESES_CURTO[t.meses[0] - 1]} a {MESES_CURTO[t.meses[2] - 1]}</div>
              <div className={`v ${t.lucro >= 0 ? "pos" : "neg"}`}>{brl(t.lucro)}</div>
              <div className="sub">lucro líquido · plano {brl(t.lucroPlano)}</div>
              <div className="sub">caixa no fim do trimestre {brl(t.caixaFim)}</div>
              <div className="al-form" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
                <label>Reserva de caixa<input className="al-in num" disabled={travado} value={fmtIn(val("reserva", t.sugestao.reserva))} onChange={(x) => setEdit({ ...edit, [t.t]: { ...e, reserva: n(x.target.value) } })} /></label>
                <label>Reinvestimento<input className="al-in num" disabled={travado} value={fmtIn(val("reinvestimento", t.sugestao.reinvestimento))} onChange={(x) => setEdit({ ...edit, [t.t]: { ...e, reinvestimento: n(x.target.value) } })} /></label>
                <label>Participação do dono<input className="al-in num" disabled={travado} value={fmtIn(val("distribuido", t.sugestao.distribuir))} onChange={(x) => setEdit({ ...edit, [t.t]: { ...e, distribuido: n(x.target.value) } })} /></label>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {reg?.status === "paga" ? <span className="st g">Paga em {dataBR(reg.pago_em)}</span> : (
                  <>
                    <button type="button" className="al-btn" disabled={!t.fechado} onClick={() => salvar(t.t, "aprovada")}>Aprovar</button>
                    <button type="button" className="al-btn pri" disabled={!t.fechado} onClick={() => salvar(t.t, "paga")}>Marcar como paga</button>
                  </>
                )}
                {!t.fechado && <span className="st n">Libera quando o trimestre fechar</span>}
              </div>
            </div>
          );
        })}
      </div>
      <Panel titulo="Como a conta é feita">
        <div className="sub" style={{ lineHeight: 1.6 }}>
          1. Lucro líquido do trimestre, apurado no DRE do sistema.<br />
          2. Menos a reserva: o que falta para o caixa chegar na reserva alvo, limitado ao lucro do trimestre.<br />
          3. Menos o reinvestimento: o percentual do planejamento sobre o que sobrou.<br />
          4. O resto é a participação de lucro do dono. Lançada como retirada, ela sai do caixa e não reduz o lucro do DRE.
        </div>
      </Panel>
    </>
  );
}
