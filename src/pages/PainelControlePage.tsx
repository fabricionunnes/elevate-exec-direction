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
import { Caixa } from "@/components/painel-controle/Caixa";
import { Fundador } from "@/components/painel-controle/Fundador";
import { Antecedentes } from "@/components/painel-controle/Antecedentes";
import { Ritmo } from "@/components/painel-controle/Ritmo";
import { Detalhe, DETALHE_TITULO } from "@/components/painel-controle/Detalhe";
import { MetaSync } from "@/components/painel-controle/MetaSync";

/** telas que olham de hoje pra frente: o mês escolhido no topo não muda o que elas mostram */
const HOJE = new Set(["caixa", "antecedentes"]);

const TITULOS: Record<string, [string, string]> = {
  financeiro: ["Financeiro", "caixa do mês: recebido, pago, vencido, bancos e MRR"],
  comercial: ["Comercial", "quem agenda, closers, funis, reuniões e vendas"],
  trafego: ["Tráfego pago", "gasto, leads, CPL, ROAS e CAC"],
  clientes: ["Clientes e entrega", "base ativa, churn, health score, NPS, tarefas e consultores"],
  atendimento: ["Atendimento", "WhatsApp e Instagram: volume e o que está parado"],
  ia: ["IA e automações", "custo da API, WhatsApp oficial e agentes"],
  automacoes: ["Roda sozinho", "o que agentes e automações fizeram sem passar por você"],
  caixa: ["Projeção de caixa", "13 semanas, saldo de hoje mais o que está lançado pra entrar e sair"],
  meta: ["Ritmo da meta", "vendido contra a meta do mês, projeção por dia útil e lucro do ano contra a meta anual"],
  antecedentes: ["O que ainda dá pra mudar", "reuniões na agenda, pipeline contra o que falta da meta e entrada de leads"],
  fundador: ["Dependência do fundador", "quanto da receita nova passa pela mão do dono e quanto das mensalidades está em poucos clientes"],
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

  // Meta Ads: "Atualizar agora". A edge busca os últimos 35 dias direto na Meta
  // (uns 15 s) e grava campanhas, conjuntos e anúncios; outra edge confere o
  // saldo da conta; depois recarrega o mês e
  // joga fora os outros meses guardados, que podem ter mudado junto.
  const [sincronizando, setSincronizando] = useState(false);
  const [rev, setRev] = useState(0);
  const syncMeta = useCallback(async () => {
    const conta = cache[mes]?.trafego?.meta?.account_row_id;
    if (!conta || sincronizando) return;
    setSincronizando(true);
    const tid = toast.loading("Buscando os últimos 35 dias na Meta, leva uns 15 segundos...");
    try {
      const { data, error } = await supabase.functions.invoke("crm-meta-ads-sync", { body: { action: "sync", account_id: conta, days: 35 } });
      if (error) {
        // resposta fora de 2xx: o motivo de verdade vem no corpo
        let motivo = error.message;
        try { const j = await (error as any).context?.json?.(); if (j?.error) motivo = j.error; } catch { /* fica a mensagem genérica */ }
        throw new Error(motivo);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      // saldo da conta: confere na hora também. Se falhar, o gasto já veio; só avisa.
      let saldoFalhou = false;
      try {
        const s = await supabase.functions.invoke("crm-meta-ads-balance", { body: {} });
        if (s.error || (s.data as any)?.error) saldoFalhou = true;
      } catch { saldoFalhou = true; }
      await carregar(mes);
      setCache((c) => (c[mes] ? { [mes]: c[mes] } : {}));
      setRev((r) => r + 1);
      const r = data as { campaigns?: number; adsets?: number; ads?: number };
      toast.success(`Meta Ads atualizado: ${r.campaigns ?? 0} linhas de campanha, ${r.adsets ?? 0} de conjunto e ${r.ads ?? 0} de anúncio nos últimos 35 dias${saldoFalhou ? ". O saldo da conta não deu pra conferir agora" : ". Saldo da conta conferido"}`, { id: tid });
    } catch (e) {
      toast.error(`Não consegui sincronizar o Meta Ads: ${(e as Error).message}. Se o acesso venceu, reconecte em CRM, Tráfego Pago.`, { id: tid, duration: 10000 });
    } finally {
      setSincronizando(false);
    }
  }, [cache, mes, sincronizando, carregar]);

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
  // depois de mudar uma configuração: busca o mês de novo e descarta os outros guardados
  const recarregar = () => { carregar(mes).then(() => setCache((c) => (c[mes] ? { [mes]: c[mes] } : {}))); };
  const ctx: Ctx | null = d ? { d, mes, setMes, go, det, abrir, f: cur.f ?? {}, setF, syncMeta, sincronizando, recarregar } : null;
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
      case "caixa": return <Caixa c={ctx} />;
      case "fundador": return <Fundador c={ctx} />;
      case "antecedentes": return <Antecedentes c={ctx} />;
      case "meta": return <Ritmo c={ctx} />;
      case "detalhe": return <Detalhe key={rev} mes={mes} bloco={cur.bloco ?? ""} filtro={cur.filtro} titulo={cur.titulo} sub={cur.sub} det={det} />;
      default: return <VisaoGeral c={ctx} />;
    }
  };
  const filtros = ctx && cur.view === "comercial" ? filtrosComercial(ctx) : ctx && cur.view === "clientes" ? filtrosClientes(ctx) : undefined;
  const t = TITULOS[cur.view];

  return (
    <div className="pc">
      <div className="wrap">
        <Topo mes={mes} meses={meses} onMes={setMes} onHome={home} onSair={() => navigate("/onboarding-tasks")} geradoEm={d?.gerado_em} alertas={d?.alertas.length ?? 0}
          meta={d ? <MetaSync meta={d.trafego.meta} sincronizando={sincronizando} onSync={syncMeta} abrir={abrir} /> : undefined} />
        {authLoading && <div className="load">Conferindo acesso...</div>}
        {!authLoading && erro && <div className="err">Não consegui carregar {mesLabel(mes)}: {erro}. <button type="button" className="lk" onClick={() => carregar(mes)}>Tentar de novo</button></div>}
        {!authLoading && !erro && !d && <div className="load">Carregando {mesLabel(mes)}...</div>}
        {ctx && cur.view !== "visao" && (
          <Cab titulo={cur.view === "detalhe" ? cur.titulo ?? "Detalhe" : t?.[0] ?? cur.view} sub={cur.view === "detalhe" ? undefined : `${t?.[1] ?? ""}. ${HOJE.has(cur.view) ? "A partir de hoje" : mesLabel(mes)}`}
            crumbs={crumbs} onBack={back} onCrumb={crumb} filtros={filtros} />
        )}
        {conteudo()}
      </div>
    </div>
  );
}
