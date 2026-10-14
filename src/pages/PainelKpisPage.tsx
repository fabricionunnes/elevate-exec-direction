// Painel de Controle de KPIs do cliente (14/10/2026, pedido do Fabrício: "painel parecido com o
// nosso painel de controle no UNV Nexus, porém para a 3D Cure, link separado, já buscando os dados
// atualizados das automações que já temos").
// Link público, só leitura: /#/painel-kpis/<token>. Mesmo tema e mesmas peças do Painel de Controle
// do Nexus; os dados vêm ao vivo de painel_kpis_public (lançamentos de KPI que a integração do
// cliente grava a cada venda). Recarrega sozinho a cada 2 minutos.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import "@/components/painel-controle/painel.css";
import "@/components/painel-cliente/painel-cliente.css";
import "@/components/painel-kpis/painel-kpis.css";
import { Cab, Combo } from "@/components/painel-controle/ui";
import { mesLabel } from "@/components/painel-controle/fmt";
import { alertas, calcMes, type Bruto, type Filtro } from "@/components/painel-kpis/modelo";
import {
  ClientesKpis, DiaKpis, FontesKpis, FunilKpis, MetaKpis, PessoaKpis, TimeKpis, VisaoKpis, filtrosKpis, nomeEmpresa, type CtxK, type NavK,
} from "@/components/painel-kpis/telas";

const TITULOS: Record<string, [string, string]> = {
  meta: ["Ritmo da meta", "faturado e vendas contra a meta do mês, dia a dia"],
  time: ["Time comercial", "todas as vendedoras, meta, ritmo e ticket"],
  fontes: ["Fontes de dados", "de onde vem cada número"],
  funil: ["Funil de atendimentos", "do atendimento à venda, por etapa e por vendedora"],
  clientes: ["Clientes, CAC e LTV", "quanto custa trazer um cliente e quanto ele rende"],
};

function useDados(token: string | undefined, mes: string | null) {
  const [b, setB] = useState<Bruto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<Date | null>(null);
  const carregar = useCallback(async () => {
    if (!token) return;
    const { data, error } = await (supabase as any).rpc("painel_kpis_public", { p_token: token, p_mes: mes });
    if (error) { setErro(error.message); return; }
    if (!data) { setErro("Painel não encontrado ou link desativado."); return; }
    setErro(null); setB(data as Bruto); setLido(new Date());
  }, [token, mes]);
  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, 2 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [carregar]);
  return { b, erro, lido, carregar };
}

const ultimos13 = (hoje: string) => {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1;
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(a, m - 12 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
};

export default function PainelKpisPage() {
  const { token } = useParams<{ token: string }>();
  const [mesSel, setMesSel] = useState<string | null>(null);
  const { b, erro, lido, carregar } = useDados(token, mesSel);
  const [stack, setStack] = useState<NavK[]>([]);
  const [f, setF] = useState<Filtro>({});
  const cur: NavK = stack[stack.length - 1] ?? { view: "visao" };

  useEffect(() => {
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex, nofollow"; document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
  useEffect(() => { if (b) document.title = `Painel de controle · ${nomeEmpresa(b.empresa)}`; }, [b?.empresa]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [stack.length, mesSel]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && stack.length && !(e.target as HTMLElement)?.closest?.(".cbp")) setStack((s) => s.slice(0, -1)); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stack.length]);

  const mes = b?.mes ?? "";
  const meses = useMemo(() => (b ? ultimos13(b.hoje) : []), [b?.hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = useMemo(() => (b && mes ? calcMes(b, mes, f) : null), [b, mes, f]);
  const go = (n: NavK) => setStack((s) => [...s, n]);
  const setMes = (iso: string) => setMesSel(iso);
  const c: CtxK | null = b && k ? { b, mes, setMes, f, setF, go, k } : null;
  const nAlertas = b && k ? alertas(b, k).length : 0;
  const nomePessoa = (id?: string) => b?.pessoas.find((p) => p.id === id)?.nome ?? "Vendedora";
  const tituloDe = (n: NavK) => n.view === "pessoa" ? nomePessoa(n.id) : n.view === "dia" ? `Dia ${n.dia?.slice(8, 10)}/${n.dia?.slice(5, 7)}` : TITULOS[n.view]?.[0] ?? n.view;
  const crumbs = stack.map(tituloDe);
  const filtroTxt = [f.unidade && b?.unidades.find((u) => u.id === f.unidade)?.nome, f.time && b?.times.find((t) => t.id === f.time)?.nome].filter(Boolean).join(" · ");

  const conteudo = () => {
    if (!c) return null;
    switch (cur.view) {
      case "meta": return <MetaKpis c={c} />;
      case "time": return <TimeKpis c={c} />;
      case "pessoa": return <PessoaKpis c={c} id={cur.id ?? ""} />;
      case "dia": return <DiaKpis c={c} dia={cur.dia ?? ""} />;
      case "fontes": return <FontesKpis c={c} />;
      case "funil": return <FunilKpis c={c} />;
      case "clientes": return <ClientesKpis c={c} />;
      default: return <VisaoKpis c={c} />;
    }
  };
  const empresa = b ? nomeEmpresa(b.empresa) : "";
  const sigla = empresa.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "UNV";

  return (
    <div className="pc">
      <div className="wrap">
        <div className="top">
          <button type="button" className="brand" onClick={() => setStack([])} title="Página inicial do painel" aria-label="Voltar para a página inicial do painel">
            <div className="lg">{b ? (empresa.split(/\s+/)[0].length <= 3 ? empresa.split(/\s+/)[0].toUpperCase() : sigla) : ""}</div>
            <div className="wm">{empresa.toUpperCase() || "PAINEL"}<small>PAINEL DE CONTROLE</small></div>
          </button>
          <div className="sep" />
          <div className="ttl">Visão da gestão · time comercial<b>{mes ? mesLabel(mes) : ""}{filtroTxt ? ` · ${filtroTxt}` : ""}</b></div>
          <div className="ctl">
            {meses.length > 0 && <Combo k="mes" label="Mês" value={mes} opts={[...meses].reverse().map((x) => ({ value: x, label: mesLabel(x) }))} onChange={setMes} />}
            {c && cur.view === "visao" && filtrosKpis(c)}
            {(f.unidade || f.time) && <button type="button" className="back" style={{ marginTop: 14 }} onClick={() => setF({})}>Limpar filtro</button>}
          </div>
          <div className="src">
            <span className={`dot ${nAlertas ? "r" : "g"}`} />{nAlertas ? `${nAlertas} ${nAlertas === 1 ? "item exige" : "itens exigem"} atenção` : "Nada fora do padrão"}
            {b?.atualizado_em && <><br />último lançamento {new Date(b.atualizado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{lido ? ` · lido às ${lido.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
            <br /><span className="nd">por UNV · Universidade Nacional de Vendas</span>
          </div>
        </div>
        {erro && <div className="err">Não consegui carregar o painel: {erro} <button type="button" className="lk" onClick={carregar}>Tentar de novo</button></div>}
        {!erro && !b && <div className="load">Carregando o painel...</div>}
        {c && cur.view !== "visao" && (
          <Cab titulo={tituloDe(cur)} sub={TITULOS[cur.view] ? `${TITULOS[cur.view][1]}. ${mesLabel(mes)}` : mesLabel(mes)}
            crumbs={crumbs} onBack={() => setStack((s) => s.slice(0, -1))} onCrumb={(i) => setStack((s) => (i < 0 ? [] : s.slice(0, i + 1)))}
            filtros={cur.view === "time" || cur.view === "meta" || cur.view === "dia" || cur.view === "funil" ? filtrosKpis(c) : undefined} />
        )}
        {conteudo()}
      </div>
    </div>
  );
}
