// Encontros do ano do Alpha: o tema de cada mês, o que precisa estar no sistema e os
// compromissos assumidos no encontro, cobrados no seguinte.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import type { DadosAlpha, Compromisso } from "./tipos";
import { CRONOGRAMA, MESES_NOME } from "./tipos";

export function CronogramaAlpha({ d, projectId, onSalvo }: { d: DadosAlpha; projectId: string; onSalvo: () => void }) {
  const db = supabase as any;
  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === d.ano ? hoje.getMonth() + 1 : 0;
  const [mes, setMes] = useState(mesAtual || 1);
  const [texto, setTexto] = useState("");
  const doMes = d.compromissos.filter((c) => Number(c.mes.slice(5, 7)) === mes);
  const iso = `${d.ano}-${String(mes).padStart(2, "0")}-01`;

  const adicionar = async () => {
    if (!texto.trim()) return;
    const { error } = await db.from("alpha_compromissos").insert({ project_id: projectId, mes: iso, texto: texto.trim() });
    if (error) { toast.error(error.message); return; }
    setTexto("");
    onSalvo();
  };
  const status = async (c: Compromisso, s: Compromisso["status"]) => {
    const { error } = await db.from("alpha_compromissos").update({ status: s }).eq("id", c.id);
    if (error) toast.error(error.message); else onSalvo();
  };

  return (
    <>
      <div className="al-crono">
        {CRONOGRAMA.map((c) => (
          <button type="button" key={c.mes} className={`p go ${c.mes === mesAtual ? "atual" : ""}`} onClick={() => setMes(c.mes)} style={c.mes === mes ? { borderColor: "var(--gold)" } : undefined}>
            <div className="lbl">{MESES_NOME[c.mes - 1]}{c.mes === mesAtual ? " · agora" : ""}</div>
            <b style={{ fontSize: 14, margin: "4px 0" }}>{c.tema}</b>
            <div className="sub">{c.aula}</div>
            <div className="sub" style={{ marginTop: 6 }}><span style={{ color: "var(--gold)" }}>No sistema: </span>{c.sistema}</div>
            <div>{c.marcos.map((m) => <span key={m} className="tag">{m}</span>)}</div>
          </button>
        ))}
      </div>
      <Panel titulo={`Compromissos de ${MESES_NOME[mes - 1].toLowerCase()}`} sub="três por encontro, cobrados no encontro seguinte">
        {doMes.length === 0 && <div className="empty">Nenhum compromisso registrado.</div>}
        {doMes.map((c) => (
          <div key={c.id} className="al-comp">
            <span>{c.texto}</span>
            <select className="al-sel" value={c.status} onChange={(e) => status(c, e.target.value as Compromisso["status"])}>
              <option value="aberto">Aberto</option><option value="cumprido">Cumprido</option><option value="nao_cumprido">Não cumprido</option>
            </select>
            <span />
          </div>
        ))}
        <div className="al-form" style={{ marginTop: 12, gridTemplateColumns: "1fr auto" }}>
          <input className="al-in" value={texto} placeholder="Novo compromisso do mês" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} />
          <button type="button" className="al-btn pri" onClick={adicionar}>Adicionar</button>
        </div>
      </Panel>
    </>
  );
}
