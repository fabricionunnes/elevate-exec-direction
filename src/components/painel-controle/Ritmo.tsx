// Ritmo da meta: vendido no mês contra a meta de vendas do CRM, projeção no ritmo
// atual por dia útil, e o lucro acumulado do ano contra a meta anual (editável).
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { Ctx } from "./ctx";
import type { Frente } from "./tipos";
import { BarrasItens, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, brlFull, fp, mesCurto, mesLabel, num, plural } from "./fmt";
import { LINK } from "./util";

type Ritmo = NonNullable<Frente["ritmo"]>;
const cor = (nivel: string | null | undefined) => (nivel === "vermelho" ? "neg" : nivel === "ambar" ? "warn" : nivel === "verde" ? "pos" : "");

/** "R$ 55 mil (só Ricardo)": a meta do mês dizendo de quem ela é */
export function metaTxt(r: Ritmo): string {
  const m = r.meta;
  if (m.meta == null) return "sem meta cadastrada";
  const nomes = m.com_meta.map((x) => x.nome.split(" ")[0]);
  return `${brl(m.meta)}${m.sem_meta.length ? ` (só ${nomes.join(" e ")})` : ""}`;
}

/** cartão da faixa "Pra frente" */
export function ritmoFrase(r: Ritmo | undefined): { valor: string; sub: string; cls: string } {
  if (!r) return { valor: "-", sub: "indisponível", cls: "" };
  const du = r.dias_uteis;
  if (r.meta.meta == null) return { valor: brl(r.vendido), sub: `vendidos no mês. Sem meta de vendas cadastrada no CRM`, cls: "" };
  const fechado = du.restantes === 0;
  return {
    valor: fp(r.pct_meta), cls: cor(r.nivel),
    sub: fechado ? `da meta de ${metaTxt(r)}: ${brl(r.vendido)} vendidos. Mês fechado`
      : `da meta de ${metaTxt(r)} com ${fp(du.pct_tempo)} dos dias úteis. No ritmo atual fecha em ${brl(r.projecao)}`,
  };
}

function MetaLucro({ c, r }: { c: Ctx; r: Ritmo }) {
  const la = r.lucro_ano;
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState(String(Math.round(la.meta)));
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    const v = Number(txt.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    if (!v || v <= 0) { toast.error("Põe um valor maior que zero"); return; }
    setSalvando(true);
    const { error } = await (supabase as any).rpc("painel_config_definir", { p_chave: "meta_lucro_ano", p_valor: v });
    setSalvando(false);
    if (error) { toast.error(`Não consegui salvar a meta: ${error.message}`); return; }
    toast.success(`Meta de lucro de ${la.ano}: ${brl(v)}`);
    setEdit(false);
    c.recarregar();
  };
  return (
    <div className="p">
      <div className="lbl">Meta de lucro de {la.ano}</div>
      {!edit ? (
        <div className="val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {brl(la.meta)}
          <button type="button" className="back" style={{ padding: "4px 7px" }} onClick={() => { setTxt(String(Math.round(la.meta))); setEdit(true); }} title="Mudar a meta de lucro do ano" aria-label="Mudar a meta de lucro do ano"><Pencil size={13} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0 4px", flexWrap: "wrap" }}>
          <input className="cbb" style={{ cursor: "text", width: 130 }} inputMode="numeric" autoFocus value={txt} onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") { e.stopPropagation(); setEdit(false); } }} aria-label="Meta de lucro do ano em reais" />
          <button type="button" className="back acc" disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</button>
          <button type="button" className="back" onClick={() => setEdit(false)}>Cancelar</button>
        </div>
      )}
      <div className="sub">lucro em caixa (recebido menos pago). Só o master muda.</div>
    </div>
  );
}

export function Ritmo({ c }: { c: Ctx }) {
  const { mes } = c;
  const r = c.d.frente?.ritmo;
  if (!r) return <div className="err">Esse bloco não veio do banco. Recarregue o painel.</div>;
  const du = r.dias_uteis, m = r.meta, la = r.lucro_ano;
  const fechado = du.restantes === 0;
  const semMeta = m.meta == null;
  const fr = ritmoFrase(r);
  const mesesCom = la.meses.filter((x) => x.lucro != null);

  return (
    <>
      {m.sem_meta.length > 0 && (
        <button type="button" className="ai media" onClick={() => c.abrir(LINK.metasCrm)}>
          <div><b>Vendem e não têm meta de vendas cadastrada: {m.sem_meta.map((x) => x.nome).join(", ")}</b>
            <em>{semMeta ? "Nenhuma meta de vendas no mês." : `A meta do mês (${brl(m.meta)}) é só de ${m.com_meta.map((x) => x.nome).join(", ")}.`} O que eles vendem conta no vendido, mas a meta não tem a parte deles. Cadastra em Configurações do CRM, Metas.</em></div>
          <span className="chip">Cadastrar</span>
        </button>
      )}

      <div className="kg">
        <Tile label="Vendido contra a meta" valor={semMeta ? "-" : fp(r.pct_meta)} cls={fr.cls} sub={`${brl(r.vendido)} em ${plural(r.vendas, "venda", "vendas")}. Meta: ${metaTxt(r)}`} onClick={() => c.det("vendas")} />
        <Tile label={fechado ? "Fechamento do mês" : "Projeção de fechamento"} valor={r.projecao == null ? "-" : brl(r.projecao)} cls={cor(r.nivel)}
          sub={r.projecao == null ? "o mês ainda não teve dia útil" : fechado ? "mês fechado: é o vendido" : `no ritmo de ${brl(r.ritmo_dia)} por dia útil${semMeta ? "" : `. ${r.projecao >= (m.meta ?? 0) ? "Bate" : "Não bate"} a meta`}`} onClick={() => c.det("vendas")} />
        <Tile label="Falta por dia útil" valor={semMeta ? "-" : fechado ? (r.falta ? brl(r.falta) : "meta batida") : r.falta === 0 ? "meta batida" : brl(r.por_dia_restante)}
          cls={!semMeta && r.falta === 0 ? "pos" : ""}
          sub={semMeta ? "sem meta cadastrada" : fechado ? (r.falta ? "ficou faltando no mês" : "o mês fechou acima da meta") : `faltam ${brl(r.falta)} em ${plural(du.restantes, "dia útil", "dias úteis")}`} onClick={() => c.go({ view: "antecedentes" })} />
        <Tile label="Dias úteis" valor={`${du.passados} de ${du.total}`} sub={`${fp(du.pct_tempo)} do mês já passou${fechado ? "" : ` · ${du.restantes} pela frente`}. Horário e feriados do CRM`} onClick={() => c.abrir(LINK.horarioCrm)} />
        <Tile label="Meta de vendas do mês" valor={semMeta ? "-" : brl(m.meta)} sub={semMeta ? "nenhuma meta do tipo Vendas pra este mês" : `${m.com_meta.map((x) => `${x.nome}: ${brl(x.meta)}`).join(", ")}${m.super_meta ? `. Super meta: ${brl(m.super_meta)}` : ""}`} onClick={() => c.abrir(LINK.metasCrm)} />
      </div>

      <Panel titulo={`Quem vendeu em ${mesLabel(mes)}`} sub="vendido de cada um contra a meta dele. Clique pra ver as vendas.">
        <Tabela cols={[{ h: "Fechador", tl: true }, "Vendas", "Vendido", "Meta", "% da meta", "Situação"]}
          onRow={(i) => { const x = r.por_fechador[i]; c.det("vendas", x.staff_id ? { closer_id: x.staff_id } : {}, `Vendas · ${x.nome}`); }}
          rows={r.por_fechador.map((x) => [
            x.nome, num(x.vendas, 0), brlFull(x.receita), x.meta == null ? <Nd>sem meta</Nd> : brlFull(x.meta), x.pct == null ? <Nd /> : fp(x.pct),
            x.meta == null ? <span className="st a">cadastrar meta</span> : <St ok={(x.pct ?? 0) >= 1} warn={(x.pct ?? 0) >= (du.pct_tempo ?? 1) * 0.8} tg="bateu" tw="no ritmo" tb="atrás do ritmo" />,
          ])} vazio="Nenhuma venda e nenhuma meta neste mês." />
        <div className="note">"No ritmo" = o percentual da meta acompanha o percentual de dias úteis já passados ({fp(du.pct_tempo)}), com 20% de tolerância. <Lk onClick={() => c.abrir(LINK.metasCrm)} ext>Metas no CRM</Lk> · <Lk onClick={() => c.go({ view: "antecedentes" })}>Pipeline e cobertura</Lk></div>
      </Panel>

      <div className="kg">
        <MetaLucro c={c} r={r} />
        <Tile label={`Lucro acumulado em ${la.ano}`} valor={brl(la.acumulado)} cls={la.acumulado < 0 ? "neg" : ""} sub={`${fp(la.pct)} da meta de ${brl(la.meta)}${la.primeiro_mes ? `. Conta desde ${mesLabel(la.primeiro_mes)}` : ""}`} onClick={() => c.go({ view: "financeiro" })} />
        <Tile label="Projeção do ano" valor={la.projecao == null ? "-" : brl(la.projecao)} cls={la.projecao != null && la.projecao < la.meta ? "neg" : "pos"}
          sub={la.media_mes == null ? "sem mês fechado com recebimento registrado" : `média de ${brl(la.media_mes)} por mês nos ${la.meses_fechados} meses fechados, mantida até dezembro`} onClick={() => c.go({ view: "financeiro" })} />
        <Tile label="Precisa por mês daqui pra frente" valor={la.falta === 0 ? "meta batida" : brl(la.precisa_por_mes)} sub={la.falta === 0 ? "o ano já passou da meta" : `faltam ${brl(la.falta)} em ${num(la.meses_restantes)} meses`} onClick={() => c.go({ view: "caixa" })} />
      </div>

      <Panel titulo={`Lucro em caixa mês a mês, ${la.ano}`} sub="recebido menos pago. Clique num mês pra trocar o painel.">
        <BarrasItens fmt={(v) => brl(v).replace("R$ ", "")} ativo={mes}
          itens={la.meses.map((x) => ({ k: x.mes, rot: mesCurto(x.mes), v: x.lucro, tip: x.lucro == null ? `${mesLabel(x.mes)}: sem recebimento registrado no Nexus` : `${mesLabel(x.mes)}: recebido ${brl(x.recebido)}, pago ${brl(x.pago)}, lucro ${brl(x.lucro)}${x.fechado ? "" : " (mês em andamento)"}` }))}
          onItem={(k) => c.setMes(k)} />
        <div className="note">
          {mesesCom.length < la.meses.length && <>Os meses sem barra não têm recebimento registrado: as faturas dos clientes passaram a ser lançadas no Nexus em {la.primeiro_mes ? mesLabel(la.primeiro_mes) : "-"}, e contar só a saída desses meses daria prejuízo falso. </>}
          Mês negativo aparece em vermelho claro, com o sinal no número. Lucro aqui é caixa, não DRE por competência.
        </div>
      </Panel>
    </>
  );
}
