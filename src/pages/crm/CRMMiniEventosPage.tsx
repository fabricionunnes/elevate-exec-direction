// Painel em tempo real do funil de mini-eventos (25/11/2026).
// Lê tudo de uma vez pela RPC miniev_painel e atualiza sozinho: a cada evento novo (visita, checkout,
// pagamento, presença) pelo canal de tempo real, e de 30 em 30 segundos pro que vem do Meta e do CRM.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import FunilDesenho from "./miniEventos/FunilDesenho";
import Playbook from "./miniEventos/Playbook";

// As tabelas e funções miniev_* ainda não estão nos tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Num = number | string | null;
interface Painel {
  turma: {
    id: string; slug: string; nome: string; promessa: string | null; data_evento: string; horario: string; cidade: string; vagas: number;
    preco_cents: number; venda_ate: string | null; venda_desde: string | null; teto_trafego_cents: number; metas: Record<string, number>; curva: number[];
  };
  placar: { cliques: Num; impressoes: Num; gasto: Num; leads: number; pagina: number; checkout: number; ingressos: number; receita: Num; presentes: number };
  anuncios: { anuncio: string; conjunto: string; gasto: Num; cliques: Num; impressoes: Num; leads: number; vendas: number }[];
  etapas: { etapa: string; ordem: number; cor: string; leads: number }[];
  dias: { dia: string; vendas: number; receita: Num }[];
  fila: { lead_id: string; nome: string; telefone: string; anuncio: string | null; minutos: number }[];
  checkouts_abertos: { inscricao_id: string; lead_id: string | null; nome: string; telefone: string; valor: number; minutos: number }[];
  inscritos: { id: string; lead_id: string | null; nome: string; telefone: string; com_socio: boolean; socio_nome: string | null; valor: number; pago_em: string; presente_em: string | null }[];
  recentes: { id: number; tipo: string; em: string; nome: string | null; dados: Record<string, unknown> | null }[];
  agora: string;
}

const n = (v: Num) => Number(v || 0);
const brl = (v: Num) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: n(v) % 1 ? 2 : 0 });
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const pctTxt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TIPO: Record<string, string> = {
  pagina_vista: "abriu a página de venda", checkout_iniciado: "abriu o checkout", ingresso_pago: "pagou o ingresso",
  presenca: "chegou no evento", presenca_desfeita: "presença desmarcada",
};
const tempo = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${Math.floor(min / 1440)} d`);

function Barra({ valor, meta, cor = "#082B48" }: { valor: number; meta: number; cor?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct(valor, meta))}%`, background: cor }} />
    </div>
  );
}

function Placar({ rotulo, valor, meta, texto, cor }: { rotulo: string; valor: number; meta?: number; texto?: string; cor?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{rotulo}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold text-[#082B48] tabular-nums" style={cor ? { color: cor } : undefined}>{texto ?? valor.toLocaleString("pt-BR")}</span>
        {meta !== undefined && <span className="text-sm text-slate-400">/ {meta.toLocaleString("pt-BR")}</span>}
      </div>
      {meta !== undefined && <div className="mt-2"><Barra valor={valor} meta={meta} cor={valor >= meta ? "#16a34a" : "#082B48"} /></div>}
    </div>
  );
}

const CRMMiniEventosPage = () => {
  // só o master vê (Fabrício, 25/11/2026: "só eu vou ter acesso")
  const { isMaster } = useCRMContext();
  const [slug, setSlug] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<{ slug: string; nome: string; data_evento: string }[]>([]);
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pisca, setPisca] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [aba, setAba] = useState<"desenho" | "painel" | "playbook">("desenho");
  const rodando = useRef(false);

  useEffect(() => {
    db.from("miniev_turmas").select("slug, nome, data_evento").order("data_evento", { ascending: false }).then(({ data, error }: { data: typeof turmas | null; error: { message: string } | null }) => {
      if (error) { setErro(error.message); return; }
      setTurmas(data || []);
      const hoje = new Date().toISOString().slice(0, 10);
      const prox = [...(data || [])].reverse().find((t) => t.data_evento >= hoje) || (data || [])[0];
      if (prox) setSlug(prox.slug); else setErro("Nenhuma turma cadastrada.");
    });
  }, []);

  const carregar = useCallback(async () => {
    if (!slug || rodando.current) return;
    rodando.current = true;
    try {
      const { data, error } = await db.rpc("miniev_painel", { p_slug: slug });
      if (error) throw error;
      if (data) { setP(data as Painel); setErro(null); }
    } catch (e) {
      // Falhou: mantém o que estava na tela e avisa, em vez de zerar o painel
      setErro((e as { message?: string }).message || "Não consegui atualizar o painel.");
    } finally { rodando.current = false; }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setP(null); carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 30000);
    return () => clearInterval(t);
  }, [slug, carregar]);

  useEffect(() => {
    if (!p?.turma.id) return;
    const canal = supabase.channel(`miniev-${p.turma.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "miniev_eventos", filter: `turma_id=eq.${p.turma.id}` }, () => {
        setPisca(true); setTimeout(() => setPisca(false), 1500); carregar();
      }).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [p?.turma.id, carregar]);

  const checkin = async (id: string, presente: boolean) => {
    setMarcando(id);
    const { error } = await db.rpc("miniev_checkin", { p_inscricao: id, p_presente: presente });
    setMarcando(null);
    if (error) toast.error(error.message); else { toast.success(presente ? "Presença marcada" : "Presença desmarcada"); carregar(); }
  };

  const c = useMemo(() => {
    if (!p) return null;
    const m = p.turma.metas || {};
    const pl = p.placar;
    const gasto = n(pl.gasto), receita = n(pl.receita), cliques = n(pl.cliques);
    const etapa = (nome: string) => p.etapas.find((e) => e.etapa === nome)?.leads || 0;
    const aPartir = (ordem: number) => p.etapas.filter((e) => e.ordem >= ordem && e.ordem <= 8).reduce((s, e) => s + e.leads, 0);
    const cpl = pl.leads > 0 ? gasto / pl.leads : 0;
    // dias da janela de venda: do dia em que a venda abre até a véspera do evento
    const ini = p.turma.venda_desde ? new Date(p.turma.venda_desde + "T12:00:00") : null;
    const fim = new Date(p.turma.data_evento + "T12:00:00"); fim.setDate(fim.getDate() - 1);
    const dias: { ymd: string; rotulo: string; vendas: number; ref: number | null }[] = [];
    if (ini) for (let d = new Date(ini), i = 0; d <= fim && i < 14; d.setDate(d.getDate() + 1), i++) {
      const ymd = d.toISOString().slice(0, 10);
      dias.push({ ymd, rotulo: `${DIA[d.getDay()]} ${ymd.slice(8)}/${ymd.slice(5, 7)}`, vendas: p.dias.find((x) => x.dia === ymd)?.vendas || 0, ref: p.turma.curva?.[i] ?? null });
    }
    const maxDia = Math.max(1, ...dias.map((d) => Math.max(d.vendas, d.ref || 0)));
    const hoje = new Date().toISOString().slice(0, 10);
    const alertas: string[] = [];
    const atrasados = p.fila.filter((f) => f.minutos > 5).length;
    if (atrasados) alertas.push(`${atrasados} lead${atrasados > 1 ? "s" : ""} há mais de 5 minutos sem abordagem no WhatsApp`);
    if (pl.leads >= 5 && cpl > 30) alertas.push(`Custo por lead em ${brl(cpl)}, acima de R$ 30: revisar o criativo antes de escalar`);
    const parados = p.checkouts_abertos.filter((x) => x.minutos > 120).length;
    if (parados) alertas.push(`${parados} checkout${parados > 1 ? "s" : ""} aberto${parados > 1 ? "s" : ""} há mais de 2 horas sem pagamento`);
    if (gasto * 100 > p.turma.teto_trafego_cents) alertas.push(`Gasto de ${brl(gasto)} passou do teto de ${brl(p.turma.teto_trafego_cents / 100)}`);
    const meio = dias.reduce<(typeof dias)[number] | undefined>((m, x) => ((x.ref || 0) > (m?.ref || 0) ? x : m), dias[0]);
    if (meio && pl.ingressos === 0 && (hoje > meio.ymd || (hoje === meio.ymd && new Date().getHours() >= 21))) alertas.push("Dia do pico passou sem nenhuma venda: encerrar a campanha e trabalhar os leads pra call");
    // promessa = conjunto de anúncios
    const prom = new Map<string, { nome: string; gasto: number; cliques: number; impressoes: number; leads: number; vendas: number }>();
    for (const a of p.anuncios) {
      const k = a.conjunto || a.anuncio; const o = prom.get(k) || { nome: k, gasto: 0, cliques: 0, impressoes: 0, leads: 0, vendas: 0 };
      o.gasto += n(a.gasto); o.cliques += n(a.cliques); o.impressoes += n(a.impressoes); o.leads += a.leads; o.vendas += a.vendas; prom.set(k, o);
    }
    return {
      m, gasto, receita, cliques, cpl, dias, maxDia, alertas, etapa, aPartir,
      promessas: [...prom.values()].sort((a, b) => b.cliques - a.cliques),
      funil: [
        { nome: "Cliques", v: cliques, meta: m.cliques },
        { nome: "Leads", v: pl.leads, meta: m.leads, taxa: pct(pl.leads, cliques), metaTaxa: 10 },
        { nome: "Página de venda", v: pl.pagina, meta: m.pagina, taxa: pct(pl.pagina, pl.leads), metaTaxa: 90 },
        { nome: "Checkout", v: pl.checkout, meta: m.checkout, taxa: pct(pl.checkout, pl.pagina), metaTaxa: 50 },
        { nome: "Ingresso pago", v: pl.ingressos, meta: m.ingressos, taxa: pct(pl.ingressos, pl.leads), metaTaxa: 25 },
      ],
    };
  }, [p]);

  if (!isMaster) return <Navigate to="/crm" replace />;
  if (!p || !c) {
    return (
      <div className="p-8 text-center text-slate-500">
        {erro ? <p className="text-red-600 font-semibold">{erro}</p> : <Loader2 className="h-6 w-6 animate-spin mx-auto" />}
      </div>
    );
  }
  const t = p.turma, pl = p.placar;
  const dEv = `${t.data_evento.slice(8)}/${t.data_evento.slice(5, 7)}`;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${pisca ? "bg-red-500 scale-150" : "bg-green-500"} transition-all`} />
            Ao vivo · atualizado às {hora(p.agora)}
          </div>
          <h1 className="text-2xl font-extrabold text-[#082B48]">Mini-evento · {t.cidade} · {dEv} · {t.horario}</h1>
          {t.promessa && <p className="text-sm text-slate-600">Promessa da página: {t.promessa.replace(/\*/g, "")}</p>}
        </div>
        {turmas.length > 1 && (
          <select className="h-9 rounded-md border bg-white px-2 text-sm" value={slug || ""} onChange={(e) => setSlug(e.target.value)}>
            {turmas.map((x) => <option key={x.slug} value={x.slug}>{x.nome}</option>)}
          </select>
        )}
        <a href={`/evento/?t=${t.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-semibold text-[#082B48]">
          Página de venda <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button onClick={carregar} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#082B48] px-3 text-sm font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
      </div>

      {erro && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">Não consegui atualizar agora ({erro}). Os números na tela são da última leitura.</div>}
      {c.alertas.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1.5">
          {c.alertas.map((a) => <div key={a} className="flex items-start gap-2 text-sm font-semibold text-red-800"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{a}</div>)}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {([["desenho", "Desenho do funil"], ["painel", "Painel ao vivo"], ["playbook", "Playbook completo"]] as const).map(([k, r]) => (
          <button key={k} onClick={() => setAba(k)} className={`rounded-lg px-4 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors ${aba === k ? "bg-[#E91D2D] text-white" : "border bg-white text-[#082B48] hover:bg-slate-100"}`}>{r}</button>
        ))}
      </div>

      {aba === "desenho" && (
        <FunilDesenho d={{
          cidade: t.cidade, dataEv: dEv, horario: t.horario, preco: t.preco_cents / 100, vagas: t.vagas,
          cliques: c.cliques, gasto: c.gasto, receita: c.receita, leads: pl.leads, pagina: pl.pagina, checkout: pl.checkout, ingressos: pl.ingressos, presentes: pl.presentes,
          semAbordagem: p.fila.length, naoComprou: c.etapa("Não comprou ingresso"), pagouFaltou: c.etapa("Pagou e faltou"), presencaConfirmada: c.etapa("Presença confirmada"),
          callsAgendadas: c.aPartir(6), callsRealizadas: c.aPartir(7), fechados: c.etapa("Mastermind fechado"),
          metas: c.m, vencedora: c.promessas[0]?.cliques ? c.promessas[0].nome : null,
          conjuntos: c.promessas.length, anuncios: p.anuncios.length, dias: c.dias, maxDia: c.maxDia,
        }} />
      )}
      {aba === "playbook" && <Playbook />}

      {aba === "painel" && (<>
      {/* Linha 1: placar */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Placar rotulo="Ingressos" valor={pl.ingressos} meta={c.m.ingressos ?? t.vagas} />
        <Placar rotulo="Leads" valor={pl.leads} meta={c.m.leads} />
        <Placar rotulo="Cliques" valor={c.cliques} meta={c.m.cliques} />
        <Placar rotulo="Gasto" valor={c.gasto} texto={brl(c.gasto)} />
        <Placar rotulo="Receita" valor={c.receita} texto={brl(c.receita)} />
        <Placar rotulo="Saldo" valor={c.receita - c.gasto} texto={brl(c.receita - c.gasto)} cor={c.receita - c.gasto >= 0 ? "#16a34a" : "#dc2626"} />
      </div>

      {/* Linha 2: funil */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48] mb-3">Funil do ingresso</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {c.funil.map((f, i) => (
            <div key={f.nome} className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-500">{i + 1}. {f.nome}</div>
              <div className="text-2xl font-extrabold text-[#082B48] tabular-nums">{f.v.toLocaleString("pt-BR")}<span className="text-sm font-semibold text-slate-400"> / {f.meta ?? "?"}</span></div>
              <Barra valor={f.v} meta={f.meta || 1} cor="#E91D2D" />
              {f.taxa !== undefined && (
                <div className={`mt-1.5 text-xs font-bold ${f.v === 0 && f.taxa === 0 ? "text-slate-400" : f.taxa >= (f.metaTaxa || 0) ? "text-green-700" : "text-red-600"}`}>
                  {pctTxt(f.taxa)} <span className="font-medium text-slate-400">· meta {f.metaTaxa}%{i === 4 ? " dos leads" : ""}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-500">Custo por lead: <b className={c.cpl > 30 ? "text-red-600" : "text-slate-700"}>{pl.leads ? brl(c.cpl) : "sem lead ainda"}</b> (meta R$ 10 a 30) · Custo por ingresso: <b className="text-slate-700">{pl.ingressos ? brl(c.gasto / pl.ingressos) : "sem venda ainda"}</b></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Linha 3: semana */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48]">Semana de vendas</h2>
          <p className="text-xs text-slate-500 mb-3">Barra vermelha: vendas reais. Traço cinza: curva de referência do método.</p>
          {c.dias.length === 0 ? <p className="text-sm text-slate-500">Defina a data de abertura da venda na turma.</p> : (
            <div className="flex items-end gap-2 h-44">
              {c.dias.map((d) => (
                <div key={d.ymd} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-sm font-extrabold text-[#082B48] tabular-nums">{d.vendas}</span>
                  <div className="relative w-full flex-1 flex items-end">
                    <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${(d.vendas / c.maxDia) * 100}%`, background: "linear-gradient(180deg,#E91D2D,#CC572D)", minHeight: d.vendas ? 4 : 0 }} />
                    {d.ref !== null && <div className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400" style={{ bottom: `${(d.ref / c.maxDia) * 100}%` }} title={`Referência: ${d.ref}`} />}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{d.rotulo}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ao vivo */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48] mb-3">Acontecendo agora</h2>
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {p.recentes.length === 0 && <p className="text-sm text-slate-500">Nada ainda. Os eventos aparecem aqui na hora em que acontecem.</p>}
            {p.recentes.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs tabular-nums text-slate-400 w-11 shrink-0">{hora(r.em)}</span>
                <span className={`h-2 w-2 rounded-full shrink-0 ${r.tipo === "ingresso_pago" ? "bg-green-500" : r.tipo === "checkout_iniciado" ? "bg-yellow-500" : r.tipo === "presenca" ? "bg-blue-600" : "bg-slate-300"}`} />
                <span className="truncate"><b>{r.nome || "Visitante"}</b> {TIPO[r.tipo] || r.tipo}{r.tipo === "ingresso_pago" && r.dados?.valor ? ` (${brl(Number(r.dados.valor))})` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 4: promessas e criativos */}
      <div className="rounded-xl border bg-white p-4 overflow-x-auto">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48]">Promessas e criativos</h2>
        <p className="text-xs text-slate-500 mb-3">Promessa vencedora é a que tem mais cliques com o mesmo gasto. Gasto e cliques vêm do Meta, que o Nexus lê de 2 em 2 horas.</p>
        {c.promessas.length === 0 ? <p className="text-sm text-slate-500">Sem dado do Meta ainda. A tabela enche depois que a campanha roda e o Nexus sincroniza.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2 pr-3">Promessa / anúncio</th><th className="px-2 text-right">Gasto</th><th className="px-2 text-right">Cliques</th><th className="px-2 text-right">CTR</th><th className="px-2 text-right">Leads</th><th className="px-2 text-right">Custo/lead</th><th className="pl-2 text-right">Ingressos</th>
            </tr></thead>
            <tbody>
              {c.promessas.map((pr, i) => (
                <Fragment key={pr.nome}>
                  <tr className="border-b bg-slate-50 font-bold text-[#082B48]">
                    <td className="py-2 pr-3">{i === 0 && pr.cliques > 0 && <span className="mr-2 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">NA FRENTE</span>}{pr.nome}</td>
                    <td className="px-2 text-right tabular-nums">{brl(pr.gasto)}</td><td className="px-2 text-right tabular-nums">{pr.cliques}</td>
                    <td className="px-2 text-right tabular-nums">{pctTxt(pct(pr.cliques, pr.impressoes))}</td><td className="px-2 text-right tabular-nums">{pr.leads}</td>
                    <td className="px-2 text-right tabular-nums">{pr.leads ? brl(pr.gasto / pr.leads) : "-"}</td><td className="pl-2 text-right tabular-nums">{pr.vendas}</td>
                  </tr>
                  {p.anuncios.filter((a) => (a.conjunto || a.anuncio) === pr.nome).map((a) => (
                    <tr key={a.anuncio} className="border-b text-slate-600">
                      <td className="py-1.5 pr-3 pl-4">{a.anuncio.split("|").pop()?.trim() || a.anuncio}</td>
                      <td className="px-2 text-right tabular-nums">{brl(a.gasto)}</td><td className="px-2 text-right tabular-nums">{n(a.cliques)}</td>
                      <td className="px-2 text-right tabular-nums">{pctTxt(pct(n(a.cliques), n(a.impressoes)))}</td><td className="px-2 text-right tabular-nums">{a.leads}</td>
                      <td className="px-2 text-right tabular-nums">{a.leads ? brl(n(a.gasto) / a.leads) : "-"}</td><td className="pl-2 text-right tabular-nums">{a.vendas}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Linha 5: fila do WhatsApp */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48]">Fila do WhatsApp · sem abordagem ({p.fila.length})</h2>
          <p className="text-xs text-slate-500 mb-2">Lead tem que ser chamado em até 5 minutos. Sai daqui quando o card vai pra "Abordado no WhatsApp".</p>
          <div className="space-y-1 max-h-64 overflow-auto">
            {p.fila.length === 0 && <p className="text-sm text-slate-500">Ninguém esperando.</p>}
            {p.fila.map((f) => (
              <Link key={f.lead_id} to={`/crm/leads/${f.lead_id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-extrabold ${f.minutos > 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{tempo(f.minutos)}</span>
                <b className="truncate">{f.nome}</b><span className="ml-auto text-xs text-slate-400 shrink-0">{f.telefone}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48]">Checkout aberto sem pagamento ({p.checkouts_abertos.length})</h2>
          <p className="text-xs text-slate-500 mb-2">Quem gerou a cobrança e não pagou. É a lista de quem chamar primeiro.</p>
          <div className="space-y-1 max-h-64 overflow-auto">
            {p.checkouts_abertos.length === 0 && <p className="text-sm text-slate-500">Nenhum checkout parado.</p>}
            {p.checkouts_abertos.map((x) => (
              <Link key={x.inscricao_id} to={x.lead_id ? `/crm/leads/${x.lead_id}` : "#"} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-extrabold ${x.minutos > 120 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}`}>{tempo(x.minutos)}</span>
                <b className="truncate">{x.nome}</b><span className="ml-auto text-xs text-slate-400 shrink-0">{x.telefone} · {brl(x.valor)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Etapas do CRM + pós-evento */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48] mb-3">Leads por etapa do funil no CRM</h2>
        <div className="flex flex-wrap gap-2">
          {p.etapas.map((e) => (
            <div key={e.etapa} className="rounded-lg border px-3 py-2 min-w-[118px]" style={{ borderTopColor: e.cor, borderTopWidth: 3 }}>
              <div className="text-xl font-extrabold text-[#082B48] tabular-nums">{e.leads}</div>
              <div className="text-[11px] font-semibold text-slate-500 leading-tight">{e.etapa}</div>
            </div>
          ))}
        </div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48] mt-5 mb-3">Depois do evento</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Placar rotulo="Presentes" valor={pl.presentes} meta={c.m.presentes} />
          <Placar rotulo="Calls agendadas" valor={c.aPartir(6)} meta={c.m.calls_agendadas} />
          <Placar rotulo="Calls realizadas" valor={c.aPartir(7)} meta={c.m.calls_realizadas} />
          <Placar rotulo="Mastermind fechado" valor={c.etapa("Mastermind fechado")} meta={c.m.fechamentos} />
          <Placar rotulo="Receita nova por mês" valor={c.etapa("Mastermind fechado") * 1500} texto={brl(c.etapa("Mastermind fechado") * 1500)} />
        </div>
      </div>

      {/* Lista de presença */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#082B48]">Lista de presença · {pl.presentes} de {p.inscritos.length} presentes</h2>
        <p className="text-xs text-slate-500 mb-2">Marque na porta. O card do lead vai sozinho pra "Presente no evento".</p>
        <div className="grid md:grid-cols-2 gap-x-6">
          {p.inscritos.length === 0 && <p className="text-sm text-slate-500">Ninguém pagou ainda.</p>}
          {p.inscritos.map((i) => (
            <div key={i.id} className="flex items-center gap-2 border-b py-2 text-sm">
              <button disabled={marcando === i.id} onClick={() => checkin(i.id, !i.presente_em)}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-extrabold ${i.presente_em ? "bg-green-600 text-white" : "border bg-white text-slate-600"}`}>
                {marcando === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{i.presente_em ? "Presente" : "Marcar"}
              </button>
              <div className="min-w-0"><b className="block truncate">{i.nome}</b>{i.com_socio && <span className="text-xs text-violet-700">+ sócio: {i.socio_nome}</span>}</div>
              <span className="ml-auto text-xs text-slate-400 shrink-0">{i.telefone}</span>
            </div>
          ))}
        </div>
      </div>
      </>)}
    </div>
  );
};

export default CRMMiniEventosPage;
