// Negócios da mesa: o que o membro vendeu, comprou, indicou ou fechou de parceria dentro do grupo.
// É o placar do networking: mostra em reais o que a mesa e a Vitrine Alpha geraram.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, dataBR } from "@/components/painel-controle/fmt";
import type { ExtrasAlpha, Negocio } from "./analise";

const TIPO: Record<Negocio["tipo"], string> = { venda: "Vendi para um membro", compra: "Comprei de um membro", indicacao: "Indicação recebida", parceria: "Parceria" };
const STATUS: Record<Negocio["status"], string> = { em_conversa: "Em conversa", fechado: "Fechado", perdido: "Não avançou" };
const num = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const INVESTIMENTO_ANO = 18000;

export function NegociosAlpha({ x, ano, projectId, onSalvo }: { x: ExtrasAlpha; ano: number; projectId: string; onSalvo: () => void }) {
  const db = supabase as any;
  const [f, setF] = useState({ tipo: "venda" as Negocio["tipo"], com_quem: "", descricao: "", valor: "", status: "em_conversa" as Negocio["status"], data: new Date().toISOString().slice(0, 10) });
  const [salvando, setSalvando] = useState(false);
  const doAno = x.negocios.filter((n) => n.data.slice(0, 4) === String(ano));
  const fechados = doAno.filter((n) => n.status === "fechado");
  const receita = fechados.filter((n) => n.tipo !== "compra").reduce((s, n) => s + Number(n.valor), 0);
  const conversa = doAno.filter((n) => n.status === "em_conversa").reduce((s, n) => s + Number(n.valor), 0);
  const pessoas = new Set(doAno.map((n) => n.com_quem.trim().toLowerCase())).size;

  const adicionar = async () => {
    if (!f.com_quem.trim()) { toast.error("Informe com quem foi o negócio."); return; }
    setSalvando(true);
    const { error } = await db.from("alpha_negocios").insert({
      project_id: projectId, data: f.data, tipo: f.tipo, com_quem: f.com_quem.trim(), descricao: f.descricao.trim() || null, valor: num(f.valor), status: f.status,
    });
    setSalvando(false);
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    toast.success("Negócio registrado.");
    setF({ ...f, com_quem: "", descricao: "", valor: "" });
    onSalvo();
  };
  const mudar = async (n: Negocio, status: Negocio["status"]) => {
    const { error } = await db.from("alpha_negocios").update({ status }).eq("id", n.id);
    if (error) toast.error(error.message); else onSalvo();
  };
  const excluir = async (n: Negocio) => {
    if (!window.confirm("Excluir este negócio?")) return;
    const { error } = await db.from("alpha_negocios").delete().eq("id", n.id);
    if (error) toast.error(error.message); else onSalvo();
  };

  return (
    <>
      <div className="grid k4">
        <div className="p main"><div className="lbl">Gerado na mesa em {ano}</div><div className="val pos">{brl(receita)}</div><div className="sub">vendas, indicações e parcerias fechadas</div></div>
        <div className="p"><div className="lbl">Em conversa</div><div className="val">{brl(conversa)}</div><div className="sub">negócios abertos com membros</div></div>
        <div className="p"><div className="lbl">Negócios fechados</div><div className="val">{fechados.length}</div><div className="sub">com {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"} do grupo</div></div>
        <div className="p"><div className="lbl">Retorno sobre o Alpha</div><div className={`val ${receita >= INVESTIMENTO_ANO ? "pos" : ""}`}>{receita ? `${(receita / INVESTIMENTO_ANO).toFixed(1).replace(".", ",")}x` : "-"}</div><div className="sub">o que a mesa gerou sobre os {brl(INVESTIMENTO_ANO)} do ano</div></div>
      </div>

      <Panel titulo="Registrar um negócio" sub="vendeu, comprou, recebeu indicação ou fechou parceria com alguém da mesa">
        <div className="al-form" style={{ gridTemplateColumns: "1.2fr 1.2fr 2fr 1fr 1fr 1fr auto" }}>
          <label>Tipo<select className="al-sel" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Negocio["tipo"] })}>{(Object.keys(TIPO) as Negocio["tipo"][]).map((k) => <option key={k} value={k}>{TIPO[k]}</option>)}</select></label>
          <label>Com quem<input className="al-in" value={f.com_quem} placeholder="Nome ou empresa" onChange={(e) => setF({ ...f, com_quem: e.target.value })} /></label>
          <label>O que foi<input className="al-in" value={f.descricao} placeholder="Ex.: contrato de tráfego pago por 6 meses" onChange={(e) => setF({ ...f, descricao: e.target.value })} /></label>
          <label>Valor (R$)<input className="al-in num" inputMode="numeric" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></label>
          <label>Situação<select className="al-sel" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Negocio["status"] })}>{(Object.keys(STATUS) as Negocio["status"][]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}</select></label>
          <label>Data<input className="al-in" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></label>
          <button type="button" className="al-btn pri" disabled={salvando} onClick={adicionar}>Registrar</button>
        </div>
      </Panel>

      <Panel titulo={`Negócios de ${ano}`} sub={`${doAno.length} registrados`}>
        {doAno.length === 0 && <div className="empty">Nenhum negócio registrado ainda. A Vitrine Alpha acontece todo mês: registre aqui o que nascer dela.</div>}
        {doAno.map((n) => (
          <div key={n.id} className={`al-acao ${n.status === "fechado" ? "feita" : n.status === "perdido" ? "cancelada" : ""}`}>
            <div>
              <b>{n.com_quem} <span className="nd">· {TIPO[n.tipo]}</span></b>
              <small>{dataBR(n.data)}{n.descricao ? ` · ${n.descricao}` : ""}</small>
            </div>
            <b className={n.status === "fechado" ? "pos" : ""}>{brl(Number(n.valor))}</b>
            <select className="al-sel" value={n.status} onChange={(e) => mudar(n, e.target.value as Negocio["status"])}>{(Object.keys(STATUS) as Negocio["status"][]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}</select>
            <button type="button" className="al-btn" onClick={() => excluir(n)}>Excluir</button>
          </div>
        ))}
      </Panel>
    </>
  );
}
