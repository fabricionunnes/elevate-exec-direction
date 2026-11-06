// Projeto do UNV Mastermind Alpha: substitui os menus padrão do projeto por um conjunto único,
// 100% focado em lucro líquido (painel, planejamento, metas, DRE, fluxo de caixa, participação).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "@/components/painel-controle/painel.css";
import "./alpha.css";
import type { DadosAlpha } from "./tipos";
import { resumir } from "./tipos";
import { PainelAlpha } from "./PainelAlpha";
import { PlanejamentoAlpha } from "./PlanejamentoAlpha";
import { MetasAlpha } from "./MetasAlpha";
import { DreAlpha } from "./DreAlpha";
import { DfcAlpha } from "./DfcAlpha";
import { ParticipacaoAlpha } from "./ParticipacaoAlpha";
import { LancamentosAlpha } from "./LancamentosAlpha";
import { CronogramaAlpha } from "./CronogramaAlpha";

export const ehProjetoAlpha = (p: { product_id?: string | null; product_name?: string | null } | null | undefined) =>
  !!p && (p.product_id === "mastermind-alpha" || p.product_name === "UNV Mastermind Alpha");

const ABAS = [
  { k: "painel", nome: "Painel de controle" },
  { k: "planejamento", nome: "Planejamento" },
  { k: "metas", nome: "Metas" },
  { k: "dre", nome: "DRE" },
  { k: "dfc", nome: "Fluxo de caixa" },
  { k: "participacao", nome: "Participação de lucro" },
  { k: "lancamentos", nome: "Lançamentos" },
  { k: "cronograma", nome: "Encontros do ano" },
] as const;
type Aba = (typeof ABAS)[number]["k"];

export function AlphaProjeto({ projectId, empresa, modo, onVoltar, onSair, onMenusEquipe }: {
  projectId: string; empresa?: string | null; modo: "staff" | "cliente";
  onVoltar?: () => void; onSair?: () => void; onMenusEquipe?: () => void;
}) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [aba, setAba] = useState<Aba>(() => {
    const q = new URLSearchParams(window.location.hash.split("?")[1] || "").get("alpha");
    return (ABAS.some((a) => a.k === q) ? q : "painel") as Aba;
  });
  const [dados, setDados] = useState<DadosAlpha | null>(null);
  const [anterior, setAnterior] = useState<DadosAlpha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const rpc = (a: number) => (supabase as any).rpc("alpha_painel", { p_project: projectId, p_ano: a });
    const [r1, r0] = await Promise.all([rpc(ano), rpc(ano - 1)]);
    if (r1.error) {
      setErro(r1.error.message?.includes("sem acesso") ? "Este painel é exclusivo do dono da empresa e do time da UNV." : r1.error.message);
      setDados(null);
    } else {
      setDados(r1.data as DadosAlpha);
      setAnterior(r0.error ? null : (r0.data as DadosAlpha));
    }
    setCarregando(false);
  }, [projectId, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  const resumo = useMemo(() => (dados ? resumir(dados, anterior) : null), [dados, anterior]);
  const anos = [ano - 1, ano, ano + 1].filter((a) => a >= 2024);

  return (
    <div className="pc alpha">
      <div className="wrap">
        <div className="top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {onVoltar && <button type="button" className="al-btn" onClick={onVoltar} aria-label="Voltar">Voltar</button>}
            <div className="brand" style={{ cursor: "default" }}>
              <div className="lg">A</div>
              <div className="wm">{empresa || dados?.empresa || "Projeto"}<small>MASTERMIND ALPHA</small></div>
            </div>
          </div>
          <div className="ctl">
            <span>Ano</span>
            <select className="al-sel" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button type="button" className="al-btn" onClick={carregar} disabled={carregando}>{carregando ? "Atualizando..." : "Atualizar"}</button>
            {modo === "staff" && onMenusEquipe && <button type="button" className="al-btn" onClick={onMenusEquipe}>Menus da equipe UNV</button>}
            {onSair && <button type="button" className="al-btn" onClick={onSair}>Sair</button>}
          </div>
        </div>

        <nav className="al-tabs">
          {ABAS.map((a) => (
            <button type="button" key={a.k} className={`al-tab ${aba === a.k ? "on" : ""}`} onClick={() => setAba(a.k)}>{a.nome}</button>
          ))}
        </nav>

        {erro && <div className="al-vazio">{erro}</div>}
        {!erro && !dados && <div className="al-vazio">Carregando o painel...</div>}
        {!erro && dados && resumo && (
          <>
            {aba === "painel" && <PainelAlpha d={dados} anterior={anterior} r={resumo} irPara={(k) => setAba(k as Aba)} />}
            {aba === "planejamento" && <PlanejamentoAlpha d={dados} anterior={anterior} projectId={projectId} onSalvo={carregar} />}
            {aba === "metas" && <MetasAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "dre" && <DreAlpha d={dados} />}
            {aba === "dfc" && <DfcAlpha d={dados} />}
            {aba === "participacao" && <ParticipacaoAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "lancamentos" && <LancamentosAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "cronograma" && <CronogramaAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
          </>
        )}
      </div>
    </div>
  );
}
