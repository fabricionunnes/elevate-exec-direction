// Metas estruturadas do Alpha: as da empresa saem do planejamento; produto, vendedor e
// indicador são cadastrados aqui, por mês.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/painel-controle/ui";
import { brl, fp, num } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Meta } from "./tipos";
import { MESES_NOME, lucroReal, lucroPlano, despesaTotalReal, despesaTotalPlano, planoDoMes, ultimoMesFechado } from "./tipos";

const NIVEIS: { k: Meta["nivel"]; nome: string }[] = [
  { k: "produto", nome: "Produto" }, { k: "vendedor", nome: "Vendedor" }, { k: "indicador", nome: "Indicador" }, { k: "empresa", nome: "Empresa" },
];
const fmtU = (u: Meta["unidade"], v: number | null) => (v == null ? "-" : u === "brl" ? brl(v) : u === "pct" ? `${num(v)}%` : num(v, 0));
const n = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

export function MetasAlpha({ d, projectId, onSalvo }: { d: DadosAlpha; projectId: string; onSalvo: () => void }) {
  const [mes, setMes] = useState(Math.min(Math.max(ultimoMesFechado(d.ano) + 1, 1), 12));
  const [nova, setNova] = useState({ nivel: "produto" as Meta["nivel"], nome: "", unidade: "brl" as Meta["unidade"], meta: "" });
  const db = supabase as any;
  const m = d.dre.find((x) => x.mes === mes)!;
  const p = planoDoMes(d, mes);
  const metas = d.metas.filter((x) => x.mes === mes);

  const da_empresa = [
    { nome: "Faturamento", meta: p?.receita ?? null, real: m.receita, menor: false },
    { nome: "Lucro líquido", meta: p ? lucroPlano(p) : null, real: lucroReal(m), menor: false },
    { nome: "Teto de despesas", meta: p ? despesaTotalPlano(p) : null, real: despesaTotalReal(m), menor: true },
    { nome: "Margem líquida", meta: p?.receita ? lucroPlano(p) / p.receita : null, real: m.receita ? lucroReal(m) / m.receita : null, menor: false, pct: true },
  ];

  const criar = async () => {
    if (!nova.nome.trim() || !n(nova.meta)) { toast.error("Informe o nome e o valor da meta."); return; }
    const { error } = await db.from("alpha_metas").insert({ project_id: projectId, ano: d.ano, mes, nivel: nova.nivel, nome: nova.nome.trim(), unidade: nova.unidade, meta: n(nova.meta) });
    if (error) { toast.error(error.message); return; }
    setNova({ ...nova, nome: "", meta: "" });
    onSalvo();
  };
  const atualizar = async (id: string, campos: Partial<Meta>) => {
    const { error } = await db.from("alpha_metas").update(campos).eq("id", id);
    if (error) toast.error(error.message); else onSalvo();
  };
  const excluir = async (id: string) => {
    const { error } = await db.from("alpha_metas").delete().eq("id", id);
    if (error) toast.error(error.message); else onSalvo();
  };
  const replicar = async () => {
    if (!metas.length) { toast.error("Este mês ainda não tem metas para replicar."); return; }
    const linhas = [];
    for (let k = mes + 1; k <= 12; k++) {
      for (const x of metas) if (!d.metas.some((y) => y.mes === k && y.nome === x.nome && y.nivel === x.nivel))
        linhas.push({ project_id: projectId, ano: d.ano, mes: k, nivel: x.nivel, nome: x.nome, unidade: x.unidade, meta: x.meta, ordem: x.ordem });
    }
    if (!linhas.length) { toast.info("Os meses seguintes já têm essas metas."); return; }
    const { error } = await db.from("alpha_metas").insert(linhas);
    if (error) toast.error(error.message); else { toast.success(`${linhas.length} metas copiadas para os meses seguintes.`); onSalvo(); }
  };

  return (
    <>
      <div className="ctl" style={{ justifyContent: "space-between" }}>
        <div className="ctl"><span>Mês</span>
          <select className="al-sel" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES_NOME.map((nm, i) => <option key={nm} value={i + 1}>{nm}</option>)}
          </select>
        </div>
        <button type="button" className="al-btn" onClick={replicar}>Replicar metas deste mês até dezembro</button>
      </div>

      <Panel titulo="Metas da empresa" sub="vêm do planejamento; o realizado vem do financeiro">
        {da_empresa.map((x) => {
          const pc = x.meta ? (x.real ?? 0) / x.meta : null;
          const ok = pc != null && (x.menor ? pc <= 1 : pc >= 1);
          return (
            <div key={x.nome} className="al-meta">
              <b>{x.nome}</b>
              <span>meta {x.pct ? fp(x.meta) : brl(x.meta)}</span>
              <span>real {x.pct ? fp(x.real) : brl(x.real)}</span>
              <div className="al-prog"><i className={pc == null ? "" : ok ? "g" : pc >= 0.85 && !x.menor ? "a" : "r"} style={{ width: `${Math.min(Math.max(pc ?? 0, 0), 1) * 100}%` }} /></div>
              <span className={`st ${pc == null ? "n" : ok ? "g" : "r"}`}>{pc == null ? "sem plano" : fp(pc)}</span>
            </div>
          );
        })}
      </Panel>

      <Panel titulo="Metas por produto, vendedor e indicador" sub={`${metas.length} metas em ${MESES_NOME[mes - 1].toLowerCase()}`}>
        {metas.length === 0 && <div className="empty">Nenhuma meta cadastrada para o mês.</div>}
        {metas.map((x) => {
          const pc = x.meta ? (x.realizado ?? 0) / x.meta : null;
          return (
            <div key={x.id} className="al-meta">
              <span><b>{x.nome}</b><br /><small className="nd">{NIVEIS.find((v) => v.k === x.nivel)?.nome}</small></span>
              <span>meta {fmtU(x.unidade, x.meta)}</span>
              <input className="al-in num" defaultValue={x.realizado ?? ""} placeholder="realizado"
                onBlur={(e) => { const v = e.target.value === "" ? null : n(e.target.value); if (v !== x.realizado) atualizar(x.id, { realizado: v }); }} />
              <div className="al-prog"><i className={pc != null && pc >= 1 ? "g" : pc != null && pc >= 0.85 ? "a" : "r"} style={{ width: `${Math.min(Math.max(pc ?? 0, 0), 1) * 100}%` }} /></div>
              <button type="button" className="al-btn" onClick={() => excluir(x.id)}>Excluir</button>
            </div>
          );
        })}
        <div className="al-form" style={{ marginTop: 14 }}>
          <label>Tipo<select className="al-sel" value={nova.nivel} onChange={(e) => setNova({ ...nova, nivel: e.target.value as Meta["nivel"] })}>{NIVEIS.map((v) => <option key={v.k} value={v.k}>{v.nome}</option>)}</select></label>
          <label>Nome<input className="al-in" value={nova.nome} placeholder="Ex.: Ana, Produto X, Ticket médio" onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></label>
          <label>Unidade<select className="al-sel" value={nova.unidade} onChange={(e) => setNova({ ...nova, unidade: e.target.value as Meta["unidade"] })}><option value="brl">R$</option><option value="qtd">Quantidade</option><option value="pct">%</option></select></label>
          <label>Meta<input className="al-in num" value={nova.meta} onChange={(e) => setNova({ ...nova, meta: e.target.value })} /></label>
          <button type="button" className="al-btn pri" onClick={criar}>Adicionar meta</button>
        </div>
      </Panel>
    </>
  );
}
