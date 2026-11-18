// A mesa: quem são os membros (uma cadeira por segmento, células de 10), os pedidos de indicação,
// o um a um do mês e o placar de negócios do grupo. Do grupo só aparecem empresa, segmento e totais.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, dataBR } from "@/components/painel-controle/fmt";
import { MESES_NOME } from "./tipos";

type Membro = { project_id: string; empresa: string; segmento: string | null; apresentacao: string | null; cliente_ideal: string | null; celula: number | null; eu: boolean };
type Pedido = { id: string; empresa: string; texto: string; status: "aberto" | "atendido" | "encerrado"; created_at: string; meu: boolean };
type Mesa = {
  membros: Membro[]; pedidos: Pedido[];
  par: { empresa: string; segmento: string | null; apresentacao: string | null; feito_em: string | null } | null;
  placar: { ano: number; mes: number; negocios: number; em_conversa: number; meu: number } | null;
};

export function MesaAlpha({ ano, projectId, modo, irPara }: { ano: number; projectId: string; modo: "staff" | "cliente"; irPara: (aba: string) => void }) {
  const db = supabase as any;
  const hoje = new Date();
  const mes = hoje.getFullYear() === ano ? hoje.getMonth() + 1 : hoje.getFullYear() > ano ? 12 : 1;
  const [m, setM] = useState<Mesa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ficha, setFicha] = useState({ segmento: "", apresentacao: "", cliente_ideal: "" });
  const [pedido, setPedido] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await db.rpc("alpha_mesa", { p_project: projectId, p_ano: ano, p_mes: mes });
    if (error) { setErro(error.message); return; }
    setErro(null);
    setM(data as Mesa);
    const eu = (data as Mesa).membros.find((x) => x.eu);
    setFicha({ segmento: eu?.segmento ?? "", apresentacao: eu?.apresentacao ?? "", cliente_ideal: eu?.cliente_ideal ?? "" });
  }, [db, projectId, ano, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <div className="al-vazio">Esta área está sendo ativada. Atualize a página em alguns minutos.</div>;
  if (!m) return <div className="al-vazio">Carregando a mesa...</div>;

  const eu = m.membros.find((x) => x.eu);
  const mesmoSegmento = ficha.segmento.trim()
    ? m.membros.filter((x) => !x.eu && (x.segmento ?? "").trim().toLowerCase() === ficha.segmento.trim().toLowerCase())
    : [];
  const salvarFicha = async () => {
    setOcupado(true);
    const { error } = await db.from("alpha_membros").upsert({
      project_id: projectId, segmento: ficha.segmento.trim() || null, apresentacao: ficha.apresentacao.trim() || null,
      cliente_ideal: ficha.cliente_ideal.trim() || null, celula: eu?.celula ?? null, updated_at: new Date().toISOString(),
    });
    setOcupado(false);
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    toast.success("Sua ficha na mesa foi salva.");
    carregar();
  };
  const definirCelula = async (pid: string, celula: number | null) => {
    const alvo = m.membros.find((x) => x.project_id === pid);
    const { error } = await db.from("alpha_membros").upsert({
      project_id: pid, segmento: alvo?.segmento ?? null, apresentacao: alvo?.apresentacao ?? null, cliente_ideal: alvo?.cliente_ideal ?? null,
      celula, updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message); else carregar();
  };
  const pedir = async () => {
    if (!pedido.trim()) return;
    const { error } = await db.from("alpha_pedidos").insert({ project_id: projectId, texto: pedido.trim() });
    if (error) { toast.error(`Não salvou: ${error.message}`); return; }
    setPedido(""); toast.success("Pedido publicado para a mesa."); carregar();
  };
  const statusPedido = async (id: string, status: Pedido["status"]) => {
    const { error } = await db.from("alpha_pedidos").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else carregar();
  };
  const parFeito = async () => {
    const { error } = await db.rpc("alpha_par_feito", { p_project: projectId, p_ano: ano, p_mes: mes });
    if (error) toast.error(error.message); else { toast.success("Um a um registrado."); carregar(); }
  };
  const sortear = async () => {
    if (!window.confirm(`Sortear os pares de ${MESES_NOME[mes - 1].toLowerCase()}? Se já houver sorteio no mês, ele é refeito.`)) return;
    const { data, error } = await db.rpc("alpha_sortear_pares", { p_ano: ano, p_mes: mes });
    if (error) toast.error(error.message); else { toast.success(`${data} pares sorteados.`); carregar(); }
  };

  const celulas = Array.from(new Set(m.membros.map((x) => x.celula ?? 0))).sort((a, b) => (a || 99) - (b || 99));
  const semSegmento = m.membros.filter((x) => !x.segmento).length;
  const pl = m.placar;

  return (
    <>
      <div className="grid k4">
        <div className="p main"><div className="lbl">A mesa gerou em {ano}</div><div className="val pos">{brl(pl?.ano ?? 0)}</div><div className="sub">{pl?.negocios ?? 0} negócios fechados entre os membros</div></div>
        <div className="p"><div className="lbl">Em {MESES_NOME[mes - 1].toLowerCase()}</div><div className="val">{brl(pl?.mes ?? 0)}</div><div className="sub">fechado neste mês</div></div>
        <div className="p"><div className="lbl">Em conversa</div><div className="val">{brl(pl?.em_conversa ?? 0)}</div><div className="sub">negócios abertos na mesa</div></div>
        <button type="button" className="p go" onClick={() => irPara("negocios")}><div className="lbl">A sua parte</div><div className="val">{brl(pl?.meu ?? 0)}</div><div className="sub">registre os seus em Negócios da mesa</div></button>
      </div>

      <div className="grid r2">
        <Panel titulo="A sua cadeira" sub="cada segmento tem uma cadeira só na mesa">
          <div className="al-form" style={{ gridTemplateColumns: "1fr" }}>
            <label>Seu segmento<input className="al-in" value={ficha.segmento} placeholder="Ex.: contabilidade para clínicas" onChange={(e) => setFicha({ ...ficha, segmento: e.target.value })} /></label>
            <label>O que a sua empresa faz, em uma frase<input className="al-in" value={ficha.apresentacao} placeholder="Ex.: organizamos o fiscal e o financeiro de clínicas médicas" onChange={(e) => setFicha({ ...ficha, apresentacao: e.target.value })} /></label>
            <label>Seu cliente ideal<input className="al-in" value={ficha.cliente_ideal} placeholder="Ex.: clínica com 3 ou mais médicos, em BH e região" onChange={(e) => setFicha({ ...ficha, cliente_ideal: e.target.value })} /></label>
          </div>
          {mesmoSegmento.length > 0 && <div className="sub warn" style={{ marginTop: 8 }}>Já existe uma cadeira com esse segmento: {mesmoSegmento.map((x) => x.empresa).join(", ")}. Fale com o Fabrício.</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <button type="button" className="al-btn pri" disabled={ocupado} onClick={salvarFicha}>{ocupado ? "Salvando..." : "Salvar a minha ficha"}</button>
            <span className="sub">{eu?.celula ? `Você está na célula ${eu.celula}.` : "Sua célula será definida pelo Fabrício."}</span>
          </div>
        </Panel>
        <Panel titulo={`Um a um de ${MESES_NOME[mes - 1].toLowerCase()}`} sub="30 minutos com outro membro, todo mês">
          {m.par ? (
            <>
              <div className="al-big" style={{ fontSize: 24 }}>{m.par.empresa}</div>
              <div className="sub">{m.par.segmento ?? "segmento ainda não informado"}</div>
              {m.par.apresentacao && <div className="sub" style={{ marginTop: 6 }}>{m.par.apresentacao}</div>}
              <div className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>Roteiro: o que cada um vende, quem é o cliente ideal de cada um e uma indicação concreta para cada lado.</div>
              <div style={{ marginTop: 12 }}>
                {m.par.feito_em ? <span className="st g">Feito em {dataBR(m.par.feito_em)}</span> : <button type="button" className="al-btn pri" onClick={parFeito}>Marcar como feito</button>}
              </div>
            </>
          ) : <div className="empty">O par deste mês ainda não foi sorteado.</div>}
          {modo === "staff" && <button type="button" className="al-btn" style={{ marginTop: 12 }} onClick={sortear}>Sortear os pares do mês (time UNV)</button>}
        </Panel>
      </div>

      <Panel titulo="Pedidos de indicação" sub="diga para a mesa quem você quer conhecer">
        <div className="al-form" style={{ gridTemplateColumns: "1fr auto" }}>
          <input className="al-in" value={pedido} placeholder="Ex.: quero conhecer donos de clínica odontológica em BH" onChange={(e) => setPedido(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") pedir(); }} />
          <button type="button" className="al-btn pri" disabled={!pedido.trim()} onClick={pedir}>Publicar pedido</button>
        </div>
        {m.pedidos.length === 0 && <div className="empty" style={{ marginTop: 10 }}>Nenhum pedido aberto. O primeiro pode ser o seu.</div>}
        {m.pedidos.map((q) => (
          <div key={q.id} className={`al-acao ${q.status === "atendido" ? "feita" : q.status === "encerrado" ? "cancelada" : ""}`} style={{ gridTemplateColumns: "1fr auto" }}>
            <div><b>{q.texto}</b><small>{q.meu ? "Seu pedido" : q.empresa} · {dataBR(q.created_at)}</small></div>
            {q.meu ? (
              <select className="al-sel" value={q.status} onChange={(e) => statusPedido(q.id, e.target.value as Pedido["status"])}>
                <option value="aberto">Aberto</option><option value="atendido">Atendido</option><option value="encerrado">Encerrado</option>
              </select>
            ) : <span className="st n">Conhece alguém? Fale com {q.empresa}</span>}
          </div>
        ))}
      </Panel>

      <Panel titulo="Quem está na mesa" sub={`${m.membros.length} ${m.membros.length === 1 ? "membro" : "membros"} de 60 cadeiras${semSegmento ? ` · ${semSegmento} sem segmento informado` : ""}`}>
        {celulas.map((c) => (
          <div key={c} style={{ marginTop: 10 }}>
            <div className="lbl" style={{ marginBottom: 4 }}>{c ? `Célula ${c}` : "Ainda sem célula"}</div>
            {m.membros.filter((x) => (x.celula ?? 0) === c).map((x) => (
              <div key={x.project_id} className="al-acao" style={{ gridTemplateColumns: modo === "staff" ? "1fr auto" : "1fr" }}>
                <div>
                  <b>{x.empresa}{x.eu ? " (você)" : ""} <span className="nd">· {x.segmento ?? "segmento não informado"}</span></b>
                  <small>{x.apresentacao ?? ""}{x.cliente_ideal ? `${x.apresentacao ? " · " : ""}Cliente ideal: ${x.cliente_ideal}` : ""}</small>
                </div>
                {modo === "staff" && (
                  <select className="al-sel" aria-label={`Célula de ${x.empresa}`} value={x.celula ?? ""} onChange={(e) => definirCelula(x.project_id, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sem célula</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Célula {n}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        ))}
      </Panel>
    </>
  );
}
