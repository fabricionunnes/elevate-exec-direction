// Página do encontro do mês no Mastermind Alpha: a aula, os números que abrem a Mesa, as tarefas
// que o empresário faz no sistema (conferidas pelos dados quando dá), os compromissos e a ata.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Tabela } from "@/components/painel-controle/ui";
import { brl, fp } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Compromisso } from "./tipos";
import { MESES_NOME, lucroReal, lucroPlano, despesaTotalReal, despesaTotalPlano, planoDoMes } from "./tipos";
import { ENCONTROS, NOME_ABA, situacao, type Aba } from "./encontros";

export type RegistroEncontro = {
  mes: number; data_presencial: string | null; data_online: string | null; presente_presencial: boolean | null;
  presente_online: boolean | null; tarefas: Record<string, boolean>; ata: string | null;
};

export function EncontroMes({ d, mes, projectId, registro, onVoltar, irPara, onSalvo }: {
  d: DadosAlpha; mes: number; projectId: string; registro: RegistroEncontro | null;
  onVoltar: () => void; irPara: (aba: Aba) => void; onSalvo: () => void;
}) {
  const e = ENCONTROS[mes - 1];
  const db = supabase as any;
  const [reg, setReg] = useState<RegistroEncontro>(registro ?? {
    mes, data_presencial: null, data_online: null, presente_presencial: null, presente_online: null, tarefas: {}, ata: "",
  });
  const [texto, setTexto] = useState("");
  useEffect(() => {
    setReg(registro ?? { mes, data_presencial: null, data_online: null, presente_presencial: null, presente_online: null, tarefas: {}, ata: "" });
  }, [registro, mes]);

  const salvar = async (campos: Partial<RegistroEncontro>, aviso?: string) => {
    const novo = { ...reg, ...campos };
    setReg(novo);
    const { error } = await db.from("alpha_encontros").upsert({
      project_id: projectId, ano: d.ano, mes, data_presencial: novo.data_presencial, data_online: novo.data_online,
      presente_presencial: novo.presente_presencial, presente_online: novo.presente_online, tarefas: novo.tarefas,
      ata: novo.ata, updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    if (aviso) toast.success(aviso);
    onSalvo();
  };

  const tarefas = e.tarefas.map((t) => ({ t, ...situacao(t, d, mes, reg.tarefas) }));
  const feitas = tarefas.filter((x) => x.feito).length;

  // A Mesa discute o mês anterior ao encontro (em janeiro, o fechamento do ano passado fica no DRE do ano anterior)
  const base = mes > 1 ? mes - 1 : null;
  const real = base ? d.dre.find((x) => x.mes === base) : null;
  const plano = base ? planoDoMes(d, base) : null;
  const acumReal = d.dre.filter((x) => base && x.mes <= base).reduce((a, x) => a + lucroReal(x), 0);
  const acumPlano = d.plano_meses.filter((x) => base && x.mes <= base).reduce((a, x) => a + lucroPlano(x), 0);

  const comps = d.compromissos.filter((c) => Number(c.mes.slice(5, 7)) === mes);
  const iso = `${d.ano}-${String(mes).padStart(2, "0")}-01`;
  const addComp = async () => {
    if (!texto.trim()) return;
    const { error } = await db.from("alpha_compromissos").insert({ project_id: projectId, mes: iso, texto: texto.trim() });
    if (error) { toast.error(error.message); return; }
    setTexto(""); onSalvo();
  };
  const statusComp = async (c: Compromisso, s: Compromisso["status"]) => {
    const { error } = await db.from("alpha_compromissos").update({ status: s }).eq("id", c.id);
    if (error) toast.error(error.message); else onSalvo();
  };

  return (
    <>
      <div className="al-enc-top">
        <button type="button" className="al-btn" onClick={onVoltar}>Encontros do ano</button>
        <div className="al-enc-tit">
          <div className="lbl">{MESES_NOME[mes - 1]} · encontro {mes} de 12</div>
          <h2>{e.tema}</h2>
          <p>{e.objetivo}</p>
          <div>{e.marcos.map((m) => <span key={m} className="tag">{m}</span>)}</div>
        </div>
        <div className="al-enc-prog">
          <div className="lbl">Tarefas no sistema</div>
          <strong>{feitas}/{tarefas.length}</strong>
          <div className="al-prog"><i className={feitas === tarefas.length ? "g" : feitas ? "a" : "r"} style={{ width: `${(feitas / tarefas.length) * 100}%` }} /></div>
        </div>
      </div>

      <div className="grid r2">
        <Panel titulo="O que você faz no sistema" sub="as tarefas com o selo do sistema são conferidas sozinhas pelos seus números">
          {tarefas.map(({ t, feito, automatico }) => (
            <div key={t.id} className={`al-tarefa ${feito ? "ok" : ""}`}>
              {automatico
                ? <span className={`al-check ${feito ? "on" : ""}`} title="Conferido pelo sistema">{feito ? "✓" : ""}</span>
                : <button type="button" className={`al-check ${feito ? "on" : ""}`} aria-label="Marcar como feito"
                    onClick={() => salvar({ tarefas: { ...reg.tarefas, [t.id]: !feito } })}>{feito ? "✓" : ""}</button>}
              <div>
                <b>{t.texto}</b>
                <small>{automatico ? (feito ? "Conferido pelo sistema" : "O sistema confere sozinho quando estiver feito") : (feito ? "Marcado como feito" : "Marque quando concluir")}</small>
              </div>
              <button type="button" className="al-btn" onClick={() => (t.aba === "compromissos" ? document.getElementById("al-comps")?.scrollIntoView({ behavior: "smooth" }) : irPara(t.aba))}>{t.aba === "compromissos" ? "Ir para os compromissos" : `Abrir ${NOME_ABA[t.aba]}`}</button>
            </div>
          ))}
        </Panel>
        <Panel titulo={base ? `A Mesa: os números de ${MESES_NOME[base - 1].toLowerCase()}` : "A Mesa: ponto de partida"} sub="é com eles que o encontro abre">
          {base && real ? (
            <Tabela cols={[{ h: "", tl: true }, "Realizado", "Plano"]} rows={[
              ["Faturamento", brl(real.receita), brl(plano?.receita)],
              ["Despesas", brl(despesaTotalReal(real)), brl(plano ? despesaTotalPlano(plano) : null)],
              [<b key="l">Lucro líquido</b>, <b key="r" className={lucroReal(real) >= 0 ? "pos" : "neg"}>{brl(lucroReal(real))}</b>, brl(plano ? lucroPlano(plano) : null)],
              ["Margem líquida", fp(real.receita ? lucroReal(real) / real.receita : null), fp(plano?.receita ? lucroPlano(plano) / plano.receita : null)],
              ["Lucro acumulado no ano", brl(acumReal), brl(acumPlano)],
            ]} />
          ) : (
            <div className="sub" style={{ lineHeight: 1.6 }}>No encontro de janeiro, a base é o ano anterior: o DRE do ano passado vira o ponto de partida do plano. Troque o ano no topo para ver o fechamento.</div>
          )}
        </Panel>
      </div>

      <div className="grid r2">
        <Panel titulo="A aula do encontro" sub={`presencial das 14h às 20h${e.mes === 5 || e.mes === 11 ? " (neste mês, dia inteiro com o GP de kart)" : ""}`}>
          <div className="al-aula">
            {e.aula.map((b) => (
              <div key={b.hora + b.titulo} className="al-bloco">
                <span className="h">{b.hora}</span>
                <div><b>{b.titulo}</b><p>{b.texto}</p></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel titulo="Para levar do encontro">
          <div className="lbl" style={{ marginBottom: 6 }}>Conceitos</div>
          {e.conceitos.map((c) => <div key={c} className="al-conceito">{c}</div>)}
          <div className="lbl" style={{ margin: "14px 0 6px" }}>Ferramenta no sistema</div>
          <div className="sub">{e.ferramenta}</div>
          <div className="lbl" style={{ margin: "14px 0 6px" }}>Datas e presença</div>
          <div className="al-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label>Presencial<input className="al-in" type="date" value={reg.data_presencial ?? ""} onChange={(x) => salvar({ data_presencial: x.target.value || null })} /></label>
            <label>Online<input className="al-in" type="date" value={reg.data_online ?? ""} onChange={(x) => salvar({ data_online: x.target.value || null })} /></label>
            <label className="al-chk"><input type="checkbox" checked={!!reg.presente_presencial} onChange={(x) => salvar({ presente_presencial: x.target.checked })} /> Esteve no presencial</label>
            <label className="al-chk"><input type="checkbox" checked={!!reg.presente_online} onChange={(x) => salvar({ presente_online: x.target.checked })} /> Esteve no online</label>
          </div>
        </Panel>
      </div>

      <div className="grid r2">
        <Panel titulo={<span id="al-comps">Compromissos de {MESES_NOME[mes - 1].toLowerCase()}</span>} sub="três por encontro, cobrados no encontro online">
          {comps.length === 0 && <div className="empty">Nenhum compromisso registrado.</div>}
          {comps.map((c) => (
            <div key={c.id} className="al-comp">
              <span>{c.texto}</span>
              <select className="al-sel" value={c.status} onChange={(x) => statusComp(c, x.target.value as Compromisso["status"])}>
                <option value="aberto">Aberto</option><option value="cumprido">Cumprido</option><option value="nao_cumprido">Não cumprido</option>
              </select>
              <span />
            </div>
          ))}
          <div className="al-form" style={{ marginTop: 12, gridTemplateColumns: "1fr auto" }}>
            <input className="al-in" value={texto} placeholder="Novo compromisso do mês" onChange={(x) => setTexto(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") addComp(); }} />
            <button type="button" className="al-btn pri" onClick={addComp}>Adicionar</button>
          </div>
        </Panel>
        <Panel titulo="Ata do encontro" sub="o que foi decidido, hot seat e próximos passos">
          <textarea className="al-in" style={{ width: "100%", minHeight: 170, resize: "vertical", lineHeight: 1.5 }}
            value={reg.ata ?? ""} placeholder="Ex.: hot seat sobre margem do produto X; decidido subir o preço em 8% a partir do dia 10."
            onChange={(x) => setReg({ ...reg, ata: x.target.value })} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="al-btn pri" onClick={() => salvar({ ata: reg.ata }, "Ata salva.")}>Salvar ata</button>
          </div>
        </Panel>
      </div>
    </>
  );
}
