// Painel de Controle do cliente (09/10/2026, pedido do Fabrício: "modelar o painel do Vitor
// de acordo com o meu no UNV Nexus, inclusive com o quadro de gestão à vista").
// Link público, só leitura: /#/painel/<token>/controle. Mesmo tema e mesmas peças do Painel
// de Controle do Nexus; os dados vêm de project_dashboard_dados_public (planilha do cliente +
// foto do sistema interno dele). Recarrega sozinho a cada 5 minutos.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import "@/components/painel-controle/painel.css";
import "@/components/painel-cliente/painel-cliente.css";
import { Cab, Combo } from "@/components/painel-controle/ui";
import { mesLabel } from "@/components/painel-controle/fmt";
import { alertas, gravarSoNovas, isoMes, lerSoNovas, type Bruto, type Filtro } from "@/components/painel-cliente/modelo";
import {
  ComercialCliente, DetalheCliente, FinanceiroCliente, FontesCliente, MarketingCliente, MetaCliente, VisaoCliente,
  filtrosComercialCliente, type CtxC, type NavC,
} from "@/components/painel-cliente/telas";

const TITULOS: Record<string, [string, string]> = {
  comercial: ["Comercial", "SDRs, closers, presença, conversão e funis"],
  financeiro: ["Financeiro", "caixa recebido, reembolsos e resultado do mês"],
  marketing: ["Marketing", "funil de aplicação, origem das vendas e mídia"],
  meta: ["Ritmo da meta", "vendido contra a meta do mês, dia a dia"],
  fontes: ["Fontes de dados", "de onde vem cada número e o que falta conectar"],
};

export function useDadosCliente(token: string | undefined) {
  const [b, setB] = useState<Bruto | null>(null);
  const [titulo, setTitulo] = useState("Painel de controle");
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    if (!token) return;
    const { data, error } = await (supabase as any).rpc("project_dashboard_dados_public", { p_token: token });
    if (error) { setErro(error.message); return; }
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.dados?.meses?.length) { setErro("Painel não encontrado ou ainda sem dados."); return; }
    setErro(null); setB(r.dados as Bruto); setTitulo(r.title ?? "Painel de controle"); setAtualizado(r.updated_at ?? null);
  }, [token]);
  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [carregar]);
  return { b, titulo, atualizado, erro, carregar };
}

export function MarcaCliente({ onClick, sub }: { onClick?: () => void; sub: string }) {
  return (
    <button type="button" className="brand" onClick={onClick} title="Página inicial do painel" aria-label="Voltar para a página inicial do painel">
      <svg viewBox="0 0 100 100" width={34} height={34} fill="none" stroke="#E9DFC9" strokeWidth={9} aria-hidden="true"><path d="M50 8 92 50 50 92 8 50Z" /><path d="M50 30 70 50 50 70 30 50Z" strokeWidth={7} /></svg>
      <div className="wm">MD1<small>{sub}</small></div>
    </button>
  );
}

export default function PainelClientePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { b, atualizado, erro, carregar } = useDadosCliente(token);
  const [mesIdx, setMesIdx] = useState<number | null>(null);
  const [stack, setStack] = useState<NavC[]>([]);
  const [soNovas, setSoNovasRaw] = useState<boolean>(lerSoNovas);
  const setSoNovas = (v: boolean) => { gravarSoNovas(v); setSoNovasRaw(v); };
  const cur: NavC = stack[stack.length - 1] ?? { view: "visao" };

  useEffect(() => {
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex, nofollow"; document.head.appendChild(meta);
    document.title = "Painel de controle · MD1";
    return () => { document.head.removeChild(meta); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [stack.length, mesIdx]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && stack.length && !(e.target as HTMLElement)?.closest?.(".cbp")) setStack((s) => s.slice(0, -1)); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stack.length]);

  const meses = useMemo(() => (b ? b.meses.map((m) => isoMes(b, m)) : []), [b]);
  const idx = mesIdx ?? (b ? b.meses.length - 1 : 0);
  const m = b?.meses[idx];
  const mes = meses[idx] ?? "";
  const setMes = (iso: string) => { const i = meses.indexOf(iso); if (i >= 0) setMesIdx(i); };
  const go = (n: NavC) => setStack((s) => [...s, n]);
  const det = (bloco: string, filtro?: Record<string, string>, titulo?: string) => setStack((s) => [...s, { view: "detalhe", det: bloco, filtro, titulo }]);
  const setF = (f: Filtro) => setStack((s) => (s.length ? s.map((n, i) => (i === s.length - 1 ? { ...n, f } : n)) : [{ view: "comercial", f }]));
  const c: CtxC | null = b && m ? { b, m, mes, setMes, go, det, f: cur.f ?? {}, setF, soNovas, setSoNovas } : null;
  const nAlertas = b && m ? alertas(b, m, soNovas).length : 0;
  const crumbs = stack.map((n) => (n.view === "detalhe" ? n.titulo ?? "Registros" : TITULOS[n.view]?.[0] ?? n.view));
  const t = TITULOS[cur.view];

  const conteudo = () => {
    if (!c) return null;
    switch (cur.view) {
      case "comercial": return <ComercialCliente c={c} />;
      case "financeiro": return <FinanceiroCliente c={c} />;
      case "marketing": return <MarketingCliente c={c} />;
      case "meta": return <MetaCliente c={c} />;
      case "fontes": return <FontesCliente c={c} />;
      case "detalhe": return <DetalheCliente c={c} bloco={cur.det ?? "vendas"} filtro={cur.filtro} />;
      default: return <VisaoCliente c={c} />;
    }
  };

  return (
    <div className="pc">
      <div className="wrap">
        <div className="top">
          <MarcaCliente onClick={() => setStack([])} sub="PAINEL DE CONTROLE" />
          <div className="sep" />
          <div className="ttl">Visão do dono · Vitor Jaci<b>{mes ? mesLabel(mes) : ""}</b></div>
          <div className="ctl">
            {meses.length > 0 && <Combo k="mes" label="Mês" value={mes} opts={[...meses].reverse().map((x) => ({ value: x, label: mesLabel(x) }))} onChange={setMes} />}
            <button type="button" className="back acc" style={{ marginTop: 14 }} title="Quadro de gestão à vista, em tela cheia"
              onClick={() => { document.documentElement.requestFullscreen?.().catch(() => {}); navigate(`/painel/${token}/ao-vivo`); }}>Gestão à vista</button>
          </div>
          <div className="src">
            <span className={`dot ${nAlertas ? "r" : "g"}`} />{nAlertas ? `${nAlertas} ${nAlertas === 1 ? "item exige" : "itens exigem"} sua decisão` : "Nada fora do padrão"}
            {atualizado && <><br />dados de {new Date(atualizado).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · atualiza sozinho</>}
            <br /><span className="nd">por UNV · Universidade Nacional de Vendas</span>
          </div>
        </div>
        {erro && <div className="err">Não consegui carregar o painel: {erro}. <button type="button" className="lk" onClick={carregar}>Tentar de novo</button></div>}
        {!erro && !b && <div className="load">Carregando o painel...</div>}
        {c && cur.view !== "visao" && (
          <Cab titulo={cur.view === "detalhe" ? cur.titulo ?? "Registros" : t?.[0] ?? cur.view} sub={cur.view === "detalhe" ? undefined : `${t?.[1] ?? ""}. ${mesLabel(mes)}`}
            crumbs={crumbs} onBack={() => setStack((s) => s.slice(0, -1))} onCrumb={(i) => setStack((s) => (i < 0 ? [] : s.slice(0, i + 1)))}
            filtros={cur.view === "comercial" ? filtrosComercialCliente(c) : undefined} />
        )}
        {conteudo()}
      </div>
    </div>
  );
}
