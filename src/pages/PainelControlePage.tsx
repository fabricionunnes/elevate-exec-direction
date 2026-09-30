// Painel de Controle (30/09/2026): cockpit do dono. Só o master vê.
// Visão macro na entrada e, clicando em qualquer card, barra, alerta ou linha,
// a visão micro até o registro individual. Navegação em pilha com breadcrumb.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { toast } from "sonner";
import "@/components/painel-controle/painel.css";
import type { Ctx } from "@/components/painel-controle/ctx";
import type { Filtro, Nav, Painel } from "@/components/painel-controle/tipos";
import { mesAtual, mesLabel, ultimos12Meses } from "@/components/painel-controle/fmt";
import { Cab, Topo } from "@/components/painel-controle/ui";
import { VisaoGeral } from "@/components/painel-controle/VisaoGeral";
import { Financeiro } from "@/components/painel-controle/Financeiro";
import { Comercial, filtrosComercial } from "@/components/painel-controle/Comercial";
import { Trafego } from "@/components/painel-controle/Trafego";
import { Clientes, filtrosClientes } from "@/components/painel-controle/Clientes";
import { Atendimento } from "@/components/painel-controle/Atendimento";
import { IA } from "@/components/painel-controle/IA";
import { Automacoes } from "@/components/painel-controle/Automacoes";
import { Fontes } from "@/components/painel-controle/Fontes";
import { Detalhe, DETALHE_TITULO } from "@/components/painel-controle/Detalhe";

const TITULOS: Record<string, [string, string]> = {
  financeiro: ["Financeiro", "caixa do mês: recebido, pago, vencido, bancos e MRR"],
  comercial: ["Comercial", "quem agenda, closers, funis, reuniões e vendas"],
  trafego: ["Tráfego pago", "gasto, leads, CPL, ROAS e CAC"],
  clientes: ["Clientes e entrega", "base ativa, churn, health score, NPS, tarefas e consultores"],
  atendimento: ["Atendimento", "WhatsApp e Instagram: volume e o que está parado"],
  ia: ["IA e automações", "custo da API, WhatsApp oficial e agentes"],
  automacoes: ["Roda sozinho", "o que agentes e automações fizeram sem passar por você"],
  fontes: ["Fontes de dados", "de onde vem cada número e o que falta conectar"],
};

export default function PainelControlePage() {
  const navigate = useNavigate();
  const { loading: authLoading, isMaster } = useStaffPermissions();
  const meses = useMemo(ultimos12Meses, []);
  const [mes, setMesRaw] = useState<string>(mesAtual());
  const [cache, setCache] = useState<Record<string, Painel>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [stack, setStack] = useState<Nav[]>([]);
  const cur: Nav = stack[stack.length - 1] ?? { view: "visao" };

  const carregar = useCallback(async (m: string) => {
    setErro(null);
    const { data, error } = await (supabase as any).rpc("painel_controle", { p_month: m });
    if (error) { setErro(error.message); toast.error("Não consegui carregar o painel"); return; }
    setCache((c) => ({ ...c, [m]: data as Painel }));
  }, []);

  useEffect(() => {
    if (authLoading || !isMaster) return;
    if (!cache[mes]) carregar(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, authLoading, isMaster]);

  useEffect(() => { document.title = "Painel de Controle · UNV Nexus"; }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [stack.length, mes]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && stack.length && !(e.target as HTMLElement)?.closest?.(".cbp")) setStack((s) => s.slice(0, -1)); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stack.length]);

  const setMes = (m: string) => { if (meses.includes(m)) setMesRaw(m); };
  const go = (nav: Nav) => setStack((s) => [...s, nav]);
  const det = (bloco: string, filtro?: Filtro, titulo?: string, sub?: string) => setStack((s) => [...s, { view: "detalhe", bloco, filtro, titulo: titulo ?? DETALHE_TITULO(bloco), sub }]);
  const back = () => setStack((s) => s.slice(0, -1));
  const home = () => setStack([]);
  const crumb = (i: number) => setStack((s) => (i < 0 ? [] : s.slice(0, i + 1)));
  const setF = (f: Filtro) => setStack((s) => s.map((n, i) => (i === s.length - 1 ? { ...n, f } : n)));
  const abrir = (url: string) => window.open(url, "_blank", "noopener");

  if (!authLoading && !isMaster) return <Navigate to="/" replace />;

  const d = cache[mes];
  const ctx: Ctx | null = d ? { d, mes, setMes, go, det, abrir, f: cur.f ?? {}, setF } : null;
  const crumbs = stack.map((n) => (n.view === "detalhe" ? n.titulo ?? DETALHE_TITULO(n.bloco ?? "") : TITULOS[n.view]?.[0] ?? n.view));

  const conteudo = () => {
    if (!ctx) return null;
    switch (cur.view) {
      case "visao": return <VisaoGeral c={ctx} />;
      case "financeiro": return <Financeiro c={ctx} />;
      case "comercial": return <Comercial c={ctx} />;
      case "trafego": return <Trafego c={ctx} />;
      case "clientes": return <Clientes c={ctx} />;
      case "atendimento": return <Atendimento c={ctx} />;
      case "ia": return <IA c={ctx} />;
      case "automacoes": return <Automacoes c={ctx} />;
      case "fontes": return <Fontes c={ctx} />;
      case "detalhe": return <Detalhe mes={mes} bloco={cur.bloco ?? ""} filtro={cur.filtro} titulo={cur.titulo} sub={cur.sub} />;
      default: return <VisaoGeral c={ctx} />;
    }
  };
  const filtros = ctx && cur.view === "comercial" ? filtrosComercial(ctx) : ctx && cur.view === "clientes" ? filtrosClientes(ctx) : undefined;
  const t = TITULOS[cur.view];

  return (
    <div className="pc">
      <div className="wrap">
        <Topo mes={mes} meses={meses} onMes={setMes} onHome={home} onSair={() => navigate("/onboarding-tasks")} geradoEm={d?.gerado_em} alertas={d?.alertas.length ?? 0} />
        {authLoading && <div className="load">Conferindo acesso...</div>}
        {!authLoading && erro && <div className="err">Não consegui carregar {mesLabel(mes)}: {erro}. <button type="button" className="lk" onClick={() => carregar(mes)}>Tentar de novo</button></div>}
        {!authLoading && !erro && !d && <div className="load">Carregando {mesLabel(mes)}...</div>}
        {ctx && cur.view !== "visao" && (
          <Cab titulo={cur.view === "detalhe" ? cur.titulo ?? "Detalhe" : t?.[0] ?? cur.view} sub={cur.view === "detalhe" ? undefined : `${t?.[1] ?? ""}. ${mesLabel(mes)}`}
            crumbs={crumbs} onBack={back} onCrumb={crumb} filtros={filtros} />
        )}
        {conteudo()}
      </div>
    </div>
  );
}
