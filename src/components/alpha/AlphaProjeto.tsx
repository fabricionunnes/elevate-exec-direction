// Projeto do UNV Mastermind Alpha: substitui os menus padrão do projeto por um conjunto único,
// 100% focado em lucro líquido (painel, planejamento, metas, DRE, fluxo de caixa, participação).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "@/components/painel-controle/painel.css";
import "./alpha.css";
import type { DadosAlpha } from "./tipos";
import { resumir } from "./tipos";
import { EXTRAS_VAZIO, saude, type ExtrasAlpha } from "./analise";
import { DiagnosticoAlpha } from "./DiagnosticoAlpha";
import { SimuladorAlpha } from "./SimuladorAlpha";
import { FechamentoAlpha } from "./FechamentoAlpha";
import { NegociosAlpha } from "./NegociosAlpha";
import { CapitalAlpha } from "./CapitalAlpha";
import { MesaAlpha } from "./MesaAlpha";
import { PainelAlpha } from "./PainelAlpha";
import { PlanejamentoAlpha } from "./PlanejamentoAlpha";
import { MetasAlpha } from "./MetasAlpha";
import { DreAlpha } from "./DreAlpha";
import { DfcAlpha } from "./DfcAlpha";
import { ParticipacaoAlpha } from "./ParticipacaoAlpha";
import { LancamentosAlpha } from "./LancamentosAlpha";
import { CronogramaAlpha } from "./CronogramaAlpha";
import { EncontroMes, type RegistroEncontro } from "./EncontroMes";

export const ehProjetoAlpha = (p: { product_id?: string | null; product_name?: string | null } | null | undefined) =>
  !!p && (p.product_id === "mastermind-alpha" || p.product_name === "UNV Mastermind Alpha");

// Menu lateral em grupos: o resultado, o plano, o dinheiro do dono, a mesa e os dados.
const ABAS = [
  { k: "painel", nome: "Painel de controle", grupo: "Resultado" },
  { k: "diagnostico", nome: "Diagnóstico e plano de ação", grupo: "Resultado" },
  { k: "dre", nome: "DRE", grupo: "Resultado" },
  { k: "dfc", nome: "Fluxo de caixa", grupo: "Resultado" },
  { k: "planejamento", nome: "Planejamento", grupo: "Plano do ano" },
  { k: "metas", nome: "Metas", grupo: "Plano do ano" },
  { k: "simulador", nome: "Simulador de lucro", grupo: "Plano do ano" },
  { k: "participacao", nome: "Participação de lucro", grupo: "Seu dinheiro" },
  { k: "capital", nome: "Capital do Próximo Salto", grupo: "Seu dinheiro" },
  { k: "cronograma", nome: "Encontros do ano", grupo: "A mesa" },
  { k: "mesa", nome: "Membros e indicações", grupo: "A mesa" },
  { k: "negocios", nome: "Negócios da mesa", grupo: "A mesa" },
  { k: "lancamentos", nome: "Lançamentos", grupo: "Dados" },
  { k: "fechamento", nome: "Fechamento do mês", grupo: "Dados" },
] as const;
const GRUPOS = Array.from(new Set(ABAS.map((a) => a.grupo)));
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
  const [encontros, setEncontros] = useState<RegistroEncontro[]>([]);
  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const [extras, setExtras] = useState<ExtrasAlpha>(EXTRAS_VAZIO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const rpc = (a: number) => (supabase as any).rpc("alpha_painel", { p_project: projectId, p_ano: a });
    const db = supabase as any;
    const [r1, r0, enc, fech, acoes, negs, salto, cob, proj] = await Promise.all([
      rpc(ano), rpc(ano - 1),
      db.from("alpha_encontros").select("mes, data_presencial, data_online, presente_presencial, presente_online, tarefas, ata").eq("project_id", projectId).eq("ano", ano),
      db.from("alpha_fechamentos").select("mes, fechado_em, observacao").eq("project_id", projectId).eq("ano", ano),
      db.from("alpha_acoes").select("id, ano, origem, texto, responsavel, prazo, impacto_mensal, status, created_at").eq("project_id", projectId).eq("ano", ano).order("created_at", { ascending: false }),
      db.from("alpha_negocios").select("id, data, tipo, com_quem, descricao, valor, status").eq("project_id", projectId).order("data", { ascending: false }).limit(500),
      db.from("alpha_saltos").select("tipo, descricao, investimento_total, retorno_esperado, inicio").eq("project_id", projectId).eq("ano", ano).maybeSingle(),
      db.rpc("alpha_capital", { p_project: projectId }),
      db.from("onboarding_projects").select("created_at, contract_start_date").eq("id", projectId).maybeSingle(),
    ]);
    const regs = enc.error ? [] : (enc.data as RegistroEncontro[]);
    setEncontros(regs);
    setExtras({
      fechamentos: fech.error ? [] : fech.data, acoes: acoes.error ? [] : acoes.data, negocios: negs.error ? [] : negs.data,
      salto: salto.error ? null : salto.data, cobrancas: cob.error ? null : cob.data,
      presencas: regs.filter((x) => x.presente_presencial === true).length,
      encontrosRegistrados: regs.filter((x) => x.presente_presencial != null).length,
      // as tabelas novas ainda não existem no banco: as telas novas avisam em vez de quebrar
      pronto: !fech.error && !acoes.error && !negs.error,
      inicio: proj.error || !proj.data ? null : (proj.data.contract_start_date ?? proj.data.created_at ?? null),
    });
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
  const ir = (k: string) => { setAba(k as Aba); setMesAberto(null); window.scrollTo(0, 0); };
  const sd = useMemo(() => (dados && resumo ? saude(dados, resumo, extras) : null), [dados, resumo, extras]);
  const novas = ["diagnostico", "simulador", "fechamento", "negocios", "capital"];

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

        <div className="al-shell">
        <nav className="al-side" aria-label="Menu do projeto">
          <select className="al-sel al-side-sel" value={aba} aria-label="Ir para" onChange={(e) => ir(e.target.value)}>
            {GRUPOS.map((g) => <optgroup key={g} label={g}>{ABAS.filter((a) => a.grupo === g).map((a) => <option key={a.k} value={a.k}>{a.nome}</option>)}</optgroup>)}
          </select>
          <div className="al-side-lista">
            {GRUPOS.map((g) => (
              <div key={g} className="al-side-g">
                <div className="lbl">{g}</div>
                {ABAS.filter((a) => a.grupo === g).map((a) => (
                  <button type="button" key={a.k} className={`al-nav ${aba === a.k ? "on" : ""}`} aria-current={aba === a.k ? "page" : undefined} onClick={() => ir(a.k)}>{a.nome}</button>
                ))}
              </div>
            ))}
            {sd && (
              <button type="button" className="al-saude-mini" onClick={() => ir("painel")}>
                <div className="lbl">Saúde do sistema</div>
                <strong className={sd.nota >= 85 ? "pos" : sd.nota >= 60 ? "warn" : "neg"}>{sd.nota}%</strong>
                <div className="al-prog"><i className={sd.nota >= 85 ? "g" : sd.nota >= 60 ? "a" : "r"} style={{ width: `${sd.nota}%` }} /></div>
              </button>
            )}
          </div>
        </nav>
        <div className="al-main">
        {erro && <div className="al-vazio">{erro}</div>}
        {!erro && !dados && <div className="al-vazio">Carregando o painel...</div>}
        {!erro && dados && resumo && novas.includes(aba) && !extras.pronto && <div className="al-vazio">Esta área está sendo ativada. Atualize a página em alguns minutos.</div>}
        {!erro && dados && resumo && (!novas.includes(aba) || extras.pronto) && (
          <>
            {aba === "painel" && <PainelAlpha d={dados} anterior={anterior} r={resumo} irPara={ir} saude={extras.pronto ? sd : null}
              tarefasEncontro={(m) => encontros.find((x) => x.mes === m)?.tarefas ?? {}} onAbrirEncontro={(m) => { setAba("cronograma"); setMesAberto(m); }} />}
            {aba === "diagnostico" && <DiagnosticoAlpha d={dados} r={resumo} x={extras} projectId={projectId} onSalvo={carregar} irPara={ir} />}
            {aba === "simulador" && <SimuladorAlpha d={dados} r={resumo} projectId={projectId} onSalvo={carregar} />}
            {aba === "fechamento" && <FechamentoAlpha d={dados} x={extras} projectId={projectId} onSalvo={carregar} irPara={ir} />}
            {aba === "negocios" && <NegociosAlpha x={extras} ano={dados.ano} projectId={projectId} onSalvo={carregar} />}
            {aba === "mesa" && <MesaAlpha ano={dados.ano} projectId={projectId} modo={modo} irPara={ir} />}
            {aba === "capital" && <CapitalAlpha d={dados} x={extras} projectId={projectId} onSalvo={carregar} irPara={ir} />}
            {aba === "planejamento" && <PlanejamentoAlpha d={dados} anterior={anterior} projectId={projectId} onSalvo={carregar} />}
            {aba === "metas" && <MetasAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "dre" && <DreAlpha d={dados} />}
            {aba === "dfc" && <DfcAlpha d={dados} />}
            {aba === "participacao" && <ParticipacaoAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "lancamentos" && <LancamentosAlpha d={dados} projectId={projectId} onSalvo={carregar} />}
            {aba === "cronograma" && mesAberto == null && <CronogramaAlpha d={dados} registros={encontros} onAbrir={setMesAberto} />}
            {aba === "cronograma" && mesAberto != null && (
              <EncontroMes d={dados} mes={mesAberto} projectId={projectId} registro={encontros.find((r) => r.mes === mesAberto) ?? null}
                onVoltar={() => setMesAberto(null)} irPara={(k) => { setAba(k as Aba); setMesAberto(null); window.scrollTo(0, 0); }} onSalvo={carregar} />
            )}
          </>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
