// Lançamentos do Alpha: de onde vêm os números (integração ou lançamento manual), o grupo do
// DRE de cada categoria e um lançamento rápido de receita ou despesa.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Tabela } from "@/components/painel-controle/ui";
import { brl, dataBR, dataHoraBR } from "@/components/painel-controle/fmt";
import type { DadosAlpha } from "./tipos";
import { GRUPOS_DRE } from "./tipos";

type Cat = { id: string; name: string; type: string | null; dre_grupo: string | null };
type Lanc = { id: string; tipo: "receita" | "despesa"; descricao: string; valor: number; comp: string | null; status: string; origem: string | null; categoria: string | null };
const n = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const ORIGEM: Record<string, string> = { demonstracao: "Demonstração", manual: "Manual", manual_alpha: "Manual (Alpha)", integracao: "Integração", conta_azul: "Conta Azul", bling: "Bling", omie: "Omie", asaas: "Asaas" };

export function LancamentosAlpha({ d, projectId, onSalvo }: { d: DadosAlpha; projectId: string; onSalvo: () => void }) {
  const db = supabase as any;
  const [cats, setCats] = useState<Cat[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const hoje = new Date().toISOString().slice(0, 10);
  const [novo, setNovo] = useState({ tipo: "despesa" as "receita" | "despesa", descricao: "", categoria_id: "", valor: "", competencia: hoje, pago: true });
  const [novaCat, setNovaCat] = useState({ nome: "", grupo: "administrativa" });

  const carregar = async () => {
    const [c, r, p] = await Promise.all([
      db.from("client_financial_categories").select("id, name, type, dre_grupo").eq("project_id", projectId).order("name"),
      db.from("client_financial_receivables").select("id, description, client_name, amount, competence_date, due_date, status, origin, category_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40),
      db.from("client_financial_payables").select("id, description, supplier_name, amount, competence_date, due_date, status, origin, category_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40),
    ]);
    const cs: Cat[] = c.data ?? [];
    setCats(cs);
    const nome = (id: string | null) => cs.find((x) => x.id === id)?.name ?? null;
    const l: Lanc[] = [
      ...(r.data ?? []).map((x: any) => ({ id: x.id, tipo: "receita" as const, descricao: x.description || x.client_name || "", valor: Number(x.amount), comp: x.competence_date || x.due_date, status: x.status, origem: x.origin, categoria: nome(x.category_id) })),
      ...(p.data ?? []).map((x: any) => ({ id: x.id, tipo: "despesa" as const, descricao: x.description || x.supplier_name || "", valor: Number(x.amount), comp: x.competence_date || x.due_date, status: x.status, origem: x.origin, categoria: nome(x.category_id) })),
    ].sort((a, b) => String(b.comp).localeCompare(String(a.comp))).slice(0, 40);
    setLancs(l);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, d.gerado_em]);

  const mudarGrupo = async (id: string, grupo: string) => {
    const { error } = await db.from("client_financial_categories").update({ dre_grupo: grupo || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Grupo do DRE atualizado."); onSalvo(); }
  };
  const criarCat = async () => {
    if (!novaCat.nome.trim()) return;
    const tipo = novaCat.grupo === "receita" ? "income" : "expense";
    const { error } = await db.from("client_financial_categories").insert({ project_id: projectId, name: novaCat.nome.trim(), type: tipo, dre_grupo: novaCat.grupo, is_active: true });
    if (error) toast.error(error.message); else { setNovaCat({ ...novaCat, nome: "" }); carregar(); }
  };
  const lancar = async () => {
    const valor = n(novo.valor);
    if (!novo.descricao.trim() || !valor) { toast.error("Informe a descrição e o valor."); return; }
    const base = {
      project_id: projectId, description: novo.descricao.trim(), category_id: novo.categoria_id || null, amount: valor,
      due_date: novo.competencia, competence_date: novo.competencia, status: novo.pago ? "paid" : "open",
      paid_at: novo.pago ? novo.competencia : null, paid_amount: novo.pago ? valor : null, origin: "manual_alpha",
    };
    const { error } = novo.tipo === "receita"
      ? await db.from("client_financial_receivables").insert({ ...base, client_name: novo.descricao.trim() })
      : await db.from("client_financial_payables").insert({ ...base, supplier_name: novo.descricao.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento registrado.");
    setNovo({ ...novo, descricao: "", valor: "" });
    carregar();
    onSalvo();
  };

  const origens = Object.entries(d.fonte.origens);
  return (
    <>
      <div className="grid g2">
        <Panel titulo="De onde vêm os números" sub={d.fonte.ultimo_lancamento ? `último lançamento ${dataHoraBR(d.fonte.ultimo_lancamento)}` : "nenhum lançamento ainda"}>
          {origens.length === 0 && <div className="empty">Sem vendas e despesas no sistema.</div>}
          {origens.map(([o, q]) => <div key={o} className="al-comp"><span>{ORIGEM[o] ?? o}</span><b>{q} lançamentos</b><span /></div>)}
          <div className="al-aviso" style={{ marginTop: 10 }}>
            O painel lê as vendas e despesas do financeiro da empresa. Quando o sistema da empresa (ERP, financeiro ou CRM) está integrado, os lançamentos chegam aqui sozinhos.
            Sem integração, lance pelo formulário ao lado ou pelo menu financeiro da empresa.
          </div>
        </Panel>
        <Panel titulo="Lançamento rápido" sub="receita ou despesa, direto no financeiro da empresa">
          <div className="al-form">
            <label>Tipo<select className="al-sel" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as "receita" | "despesa", categoria_id: "" })}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label>
            <label>Descrição<input className="al-in" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></label>
            <label>Categoria<select className="al-sel" value={novo.categoria_id} onChange={(e) => setNovo({ ...novo, categoria_id: e.target.value })}>
              <option value="">Sem categoria</option>
              {cats.filter((c) => (novo.tipo === "receita" ? c.dre_grupo === "receita" || c.type === "income" : c.dre_grupo !== "receita" && c.type !== "income")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Valor<input className="al-in num" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></label>
            <label>Competência<input className="al-in" type="date" value={novo.competencia} onChange={(e) => setNovo({ ...novo, competencia: e.target.value })} /></label>
            <label>Já pago?<select className="al-sel" value={novo.pago ? "s" : "n"} onChange={(e) => setNovo({ ...novo, pago: e.target.value === "s" })}><option value="s">Sim</option><option value="n">Não, em aberto</option></select></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" className="al-btn pri" onClick={lancar}>Lançar</button></div>
        </Panel>
      </div>

      <Panel titulo="Categorias e grupo do DRE" sub={d.fonte.categorias_sem_grupo ? `${d.fonte.categorias_sem_grupo} sem grupo: elas caem em "Sem categoria"` : "todas as categorias têm grupo"}>
        <Tabela cols={[{ h: "Categoria", tl: true }, { h: "Grupo do DRE", tl: true }]} vazio="Nenhuma categoria cadastrada." rows={cats.map((c) => [
          c.name,
          <select key={c.id} className="al-sel" value={c.dre_grupo ?? ""} onChange={(e) => mudarGrupo(c.id, e.target.value)}>
            <option value="">Sem grupo</option>
            {GRUPOS_DRE.map((g) => <option key={g.k} value={g.k}>{g.nome}</option>)}
          </select>,
        ])} />
        <div className="al-form" style={{ marginTop: 12 }}>
          <label>Nova categoria<input className="al-in" value={novaCat.nome} onChange={(e) => setNovaCat({ ...novaCat, nome: e.target.value })} /></label>
          <label>Grupo<select className="al-sel" value={novaCat.grupo} onChange={(e) => setNovaCat({ ...novaCat, grupo: e.target.value })}>{GRUPOS_DRE.map((g) => <option key={g.k} value={g.k}>{g.nome}</option>)}</select></label>
          <button type="button" className="al-btn" onClick={criarCat}>Criar categoria</button>
        </div>
      </Panel>

      <Panel titulo="Últimos lançamentos" sub="os 40 mais recentes">
        <Tabela cols={[{ h: "Competência", tl: true }, { h: "Descrição", tl: true }, { h: "Categoria", tl: true }, "Tipo", "Valor", "Situação", "Origem"]} vazio="Nenhum lançamento." rows={lancs.map((l) => [
          dataBR(l.comp), l.descricao, l.categoria ?? <span className="nd">Sem categoria</span>, l.tipo === "receita" ? "Receita" : "Despesa",
          <span key="v" className={l.tipo === "receita" ? "pos" : ""}>{brl(l.valor)}</span>,
          l.status === "paid" ? "Pago" : l.status === "partial" ? "Parcial" : l.status === "overdue" ? "Vencido" : "Em aberto",
          ORIGEM[l.origem ?? "manual"] ?? l.origem,
        ])} />
      </Panel>
    </>
  );
}
