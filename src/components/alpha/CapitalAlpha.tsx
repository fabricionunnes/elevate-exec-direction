// Capital do Próximo Salto: no fim do ano, o Fabrício investe R$ 6.000 na empresa de quem executou.
// Aqui o membro acompanha os três critérios o ano inteiro e define, em novembro, onde o capital entra.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl } from "@/components/painel-controle/fmt";
import type { DadosAlpha } from "./tipos";
import { CAPITAL_VALOR, criteriosCapital, type ExtrasAlpha, type Salto } from "./analise";

const TIPOS = ["Vendedor novo", "Tráfego pago", "Agente de IA", "Sistema ou ferramenta", "Treinamento do time", "Outro"];
const ESTADO = {
  garantido: { t: "Capital garantido", s: "Você cumpriu os três critérios do ano.", c: "g" },
  caminho: { t: "No caminho", s: "Os três critérios estão em dia. Mantenha o ritmo até dezembro.", c: "g" },
  risco: { t: "Atenção", s: "Você ainda está dentro, mas sem margem em pelo menos um critério.", c: "a" },
  fora: { t: "Fora dos critérios", s: "Um dos critérios não foi cumprido. Fale com o Fabrício no próximo encontro.", c: "r" },
} as const;
const num = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

export function CapitalAlpha({ d, x, projectId, onSalvo, irPara }: {
  d: DadosAlpha; x: ExtrasAlpha; projectId: string; onSalvo: () => void; irPara: (aba: string) => void;
}) {
  const { criterios, estado } = criteriosCapital(d, x);
  const e = ESTADO[estado];
  const [s, setS] = useState({ tipo: "", descricao: "", investimento: "", retorno: "", inicio: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    const v: Salto | null = x.salto;
    setS({ tipo: v?.tipo ?? "", descricao: v?.descricao ?? "", investimento: v?.investimento_total ? String(Math.round(v.investimento_total)) : "", retorno: v?.retorno_esperado ?? "", inicio: v?.inicio ?? "" });
  }, [x.salto]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await (supabase as any).from("alpha_saltos").upsert({
      project_id: projectId, ano: d.ano, tipo: s.tipo || null, descricao: s.descricao.trim() || null, investimento_total: num(s.investimento) || null,
      retorno_esperado: s.retorno.trim() || null, inicio: s.inicio || null, updated_at: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    toast.success("Próximo salto salvo.");
    onSalvo();
  };
  const investimento = num(s.investimento);
  const destino: Record<string, string> = { mensalidades: "", presenca: "cronograma", sistema: "fechamento" };

  return (
    <>
      <div className={`al-sem ${e.c}`}>
        <div className="bola" />
        <div><b>{e.t}</b><p>{e.s}</p></div>
        <div className="num">Capital do Próximo Salto<strong>{brl(CAPITAL_VALOR)}</strong></div>
      </div>

      <div className="grid g3">
        {criterios.map((c) => (
          <div key={c.k} className={`p al-crit ${c.ok ? (c.risco ? "a" : "g") : "r"}`}>
            <div className="lbl">{c.nome}</div>
            <div className="v">{c.ok ? (c.risco ? "No limite" : "Em dia") : "Não cumprido"}</div>
            <div className="sub">{c.feito}</div>
            <div className="sub" style={{ marginTop: 8, color: "var(--mute)" }}>{c.regra}</div>
            {destino[c.k] && <button type="button" className="al-btn" style={{ marginTop: 10 }} onClick={() => irPara(destino[c.k])}>{c.k === "sistema" ? "Abrir fechamento do mês" : "Abrir encontros do ano"}</button>}
          </div>
        ))}
      </div>

      <div className="grid r2">
        <Panel titulo="O seu próximo salto" sub="definido no encontro de novembro, começa em janeiro">
          <div className="al-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label>Onde o capital entra
              <select className="al-sel" value={s.tipo} onChange={(ev) => setS({ ...s, tipo: ev.target.value })}>
                <option value="">Escolha</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Começa em<input className="al-in" type="date" value={s.inicio} onChange={(ev) => setS({ ...s, inicio: ev.target.value })} /></label>
            <label style={{ gridColumn: "1 / -1" }}>O que será feito<textarea className="al-in" style={{ minHeight: 70, resize: "vertical" }} value={s.descricao} placeholder="Ex.: contratar um segundo vendedor interno para atender os leads do tráfego" onChange={(ev) => setS({ ...s, descricao: ev.target.value })} /></label>
            <label>Investimento total previsto (R$)<input className="al-in num" inputMode="numeric" value={s.investimento} onChange={(ev) => setS({ ...s, investimento: ev.target.value })} /></label>
            <label>Retorno esperado<input className="al-in" value={s.retorno} placeholder="Ex.: mais R$ 30 mil de faturamento por mês" onChange={(ev) => setS({ ...s, retorno: ev.target.value })} /></label>
          </div>
          {investimento > 0 && (
            <div className="sub" style={{ marginTop: 10 }}>
              O Capital cobre {brl(Math.min(CAPITAL_VALOR, investimento))} de {brl(investimento)}
              {investimento > CAPITAL_VALOR ? `. Os outros ${brl(investimento - CAPITAL_VALOR)} entram no orçamento do próximo ano.` : ". O primeiro passo sai sem tirar do seu caixa."}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="al-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar o próximo salto"}</button>
            <button type="button" className="al-btn" onClick={() => irPara("planejamento")}>Abrir o planejamento</button>
          </div>
        </Panel>
        <Panel titulo="Como funciona">
          <div className="sub" style={{ lineHeight: 1.7 }}>
            Depois de 12 meses acompanhando os seus números de perto, o Fabrício investe {brl(CAPITAL_VALOR)} na sua empresa, por Pix, para o primeiro passo do próximo ano.<br /><br />
            <b style={{ color: "var(--ink)" }}>Em novembro</b> você define o salto aqui.<br />
            <b style={{ color: "var(--ink)" }}>Em dezembro</b> o capital é pago a quem executou o ano.<br />
            <b style={{ color: "var(--ink)" }}>Em janeiro</b> o salto começa e entra no plano do novo ano.<br /><br />
            O Alpha não paga presença. Paga execução.
          </div>
        </Panel>
      </div>
    </>
  );
}
