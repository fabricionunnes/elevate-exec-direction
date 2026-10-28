// Time de IA — centro de comando no formato do vídeo de referência: fundo escuro,
// o Max (coordenador) em destaque com anel luminoso falando, os 7 agentes em
// cards com status ("de prontidão", "trabalhando", "entregou há 5 min"), microfone
// no rodapé. Conversa por voz é o padrão; texto fica num painel lateral, e a fila
// de aprovação em outro. Cores da UNV: navy #0D2B5E e vermelho #CC1B1B.
// Escopo por projeto (mesmo padrão do UNV Social) → resolve a empresa do projeto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Check, X, Mic, MicOff, SendHorizontal, MessageSquareText, Inbox, Volume2, VolumeX, ChevronDown, ChevronUp, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMaxVoice, temReconhecimento } from "./useMaxVoice";

// tabelas novas ainda não estão no types.ts gerado pelo Lovable
const db = supabase as any;

const NAVY = "#0D2B5E";
const RED = "#CC1B1B";

type AgentKey = "orquestrador" | "atendimento" | "briefing" | "anuncios" | "conteudo" | "reativacao" | "trafego" | "qualificacao";
interface Agent {
  id: string; agent_key: AgentKey; name: string; role_title: string; description: string | null;
  color: string; is_active: boolean; schedule: { hour?: string; days?: number[] } | null;
  config: Record<string, any>; last_run_at: string | null;
}
interface Run { id: string; agent_key: AgentKey; status: string; trigger: string; summary: string | null; started_at: string; finished_at: string | null }
interface Approval { id: string; agent_key: AgentKey; kind: "ad" | "post" | "message" | "action"; title: string; payload: Record<string, any>; status: string; created_at: string }
interface Msg { id: string; role: "user" | "assistant"; content: string; meta?: { actions?: { tool: string; input: any; result: any }[] } | null; created_at: string; pending?: boolean }

const RUNNABLE: AgentKey[] = ["briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"];
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const KIND_LABEL: Record<Approval["kind"], string> = { ad: "Anúncio", post: "Post", message: "Mensagem", action: "Ação" };
const SUGESTOES = ["Como está o caixa hoje?", "Quem eu devo ligar primeiro?", "O que tem na fila?", "Luna, o que está queimando verba?", "Por que o churn subiu?"];

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};
const scheduleLabel = (s: Agent["schedule"]) => {
  if (!s?.hour) return "por canal";
  const days = s.days?.length ? (s.days.length >= 6 ? "seg a sáb" : s.days.map((d) => DOW[d]).join(", ")) : "todo dia";
  return `${days} ${s.hour}`;
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

export default function TimeIAPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null); // "all" | agent_key
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [painel, setPainel] = useState<"nenhum" | "conversa" | "fila">("nenhum");
  const [selecionado, setSelecionado] = useState<AgentKey | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const abriuComVoz = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async (companyId: string) => {
    const [a, r, ap, m] = await Promise.all([
      db.from("ai_team_agents").select("*").eq("company_id", companyId),
      db.from("ai_team_runs").select("id, agent_key, status, trigger, summary, started_at, finished_at")
        .eq("company_id", companyId).order("started_at", { ascending: false }).limit(40),
      db.from("ai_team_approvals").select("id, agent_key, kind, title, payload, status, created_at")
        .eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }),
      db.from("ai_team_messages").select("id, role, content, meta, created_at")
        .eq("company_id", companyId).order("created_at", { ascending: false }).limit(60),
    ]);
    const order: AgentKey[] = ["orquestrador", "briefing", "qualificacao", "trafego", "anuncios", "conteudo", "reativacao", "atendimento"];
    setAgents(((a.data || []) as Agent[]).sort((x, y) => order.indexOf(x.agent_key) - order.indexOf(y.agent_key)));
    setRuns((r.data || []) as Run[]);
    setApprovals((ap.data || []) as Approval[]);
    setMessages((((m.data || []) as Msg[]).reverse()));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/onboarding-tasks/login"); return; }
        const { data: staff } = await supabase.from("onboarding_staff").select("id").eq("user_id", user.id).maybeSingle();
        setIsClient(!staff);
        const { data: project, error } = await supabase
          .from("onboarding_projects")
          .select("id, onboarding_company_id, product_name, onboarding_companies(id, name)")
          .eq("id", projectId).single();
        if (error) throw error;
        // onboarding_company_id aponta pra onboarding_companies; company_id é FK de portal_companies (outra coisa)
        const companyId = (project as any).onboarding_company_id;
        if (!companyId) { toast.error("Projeto sem empresa vinculada"); return; }
        setCompany({ id: companyId, name: (project as any).onboarding_companies?.name || project.product_name });
        await db.rpc("ai_team_seed_defaults", { p_company_id: companyId }); // monta o time na primeira abertura
        await loadData(companyId);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar o Time de IA");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, navigate, loadData]);

  useEffect(() => { if (painel === "conversa") bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending, painel]);

  const agentByKey = useMemo(() => new Map(agents.map((a) => [a.agent_key, a])), [agents]);
  const max = agentByKey.get("orquestrador");
  const maxName = max?.name || "Max";
  const lastRunByKey = useMemo(() => {
    const m = new Map<AgentKey, Run>();
    for (const r of runs) if (!m.has(r.agent_key)) m.set(r.agent_key, r);
    return m;
  }, [runs]);
  const pendingByKey = useMemo(() => {
    const m: Partial<Record<AgentKey, number>> = {};
    for (const ap of approvals) m[ap.agent_key] = (m[ap.agent_key] || 0) + 1;
    return m;
  }, [approvals]);

  // ── conversa (texto e voz usam o mesmo caminho) ──
  const ask = useCallback(async (msg: string, modo: "texto" | "voz" = "texto"): Promise<string> => {
    if (!company) throw new Error("empresa não carregada");
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: msg, created_at: new Date().toISOString(), pending: true }]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-team-chat", { body: { companyId: company.id, message: msg, modo } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await loadData(company.id);
      // Ordens de navegação: abrir o UNV Office (opcionalmente já indo pra uma sala), cliente ou tela
      for (const a of (data?.actions || []) as any[]) {
        const r = a.result || {};
        if (r.acao === "abrir_escritorio") { setTimeout(() => navigate("/onboarding-tasks/unv-office"), 1500); break; }
        if (r.acao === "ir_sala" && r.destino) { setTimeout(() => navigate(`/onboarding-tasks/unv-office?ir=${encodeURIComponent(r.destino)}`), 1500); break; }
        if ((r.acao === "abrir_cliente" || r.acao === "abrir_tela" || r.acao === "abrir_lead") && r.rota) { setTimeout(() => navigate(r.rota), 1500); break; }
      }
      return String(data?.reply || "");
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw e;
    }
  }, [company, loadData, navigate]);

  const askVoz = useCallback((msg: string) => ask(msg, "voz"), [ask]);
  const voz = useMaxVoice(askVoz);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !company || sending) return;
    setInput("");
    setSending(true);
    try { await ask(msg); } catch (e: any) { toast.error(e?.message || `O ${maxName} não respondeu`); setInput(msg); }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const runTeam = async (agentKey?: AgentKey) => {
    if (!company) return;
    setRunning(agentKey || "all");
    try {
      const { data, error } = await supabase.functions.invoke("ai-team-orchestrator", { body: { companyId: company.id, agentKey: agentKey || null } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data?.results?.[0];
      await loadData(company.id);
      if (r?.maxText && !agentKey) voz.falar(r.maxText);
      toast.success(r?.novasAprovacoes ? `${r.novasAprovacoes} item(ns) novos na fila` : "Rodada concluída");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao rodar o time");
    } finally { setRunning(null); }
  };

  const toggleAgent = async (agent: Agent, value: boolean) => {
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: value } : a));
    const { error } = await db.from("ai_team_agents").update({ is_active: value, updated_at: new Date().toISOString() }).eq("id", agent.id);
    if (error) { toast.error("Erro ao alterar status"); setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: !value } : a)); }
  };

  const decide = async (ap: Approval, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("ai_team_approvals").update({ status, decided_at: new Date().toISOString(), decided_by: user?.id || null }).eq("id", ap.id);
    if (error) { toast.error("Erro ao registrar decisão"); return; }
    setApprovals((prev) => prev.filter((p) => p.id !== ap.id));
    toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
  };

  // microfone: primeira vez, o Max se apresenta falando; depois alterna ouvir/parar
  const onMic = async () => {
    if (voz.fase === "ouvindo") { voz.parar(); return; }
    if (voz.fase === "falando") { voz.parar(); voz.ouvir(); return; }
    if (voz.fase === "pensando") return;
    if (!abriuComVoz.current) {
      abriuComVoz.current = true;
      const ultimo = [...messages].reverse().find((m) => m.role === "assistant");
      const abertura = ultimo
        ? `${saudacao()}. Retomando de onde paramos: ${ultimo.content.slice(0, 240)}`
        : `${saudacao()}. Sou o ${maxName}, coordeno o seu time de IA. Já li o caixa, os leads e o tráfego de hoje. Me pergunta o que quiser, ou manda alguém do time trabalhar.`;
      await voz.falar(abertura);
    }
    voz.ouvir();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}><Loader2 className="h-8 w-8 animate-spin text-white" /></div>;
  }
  if (!company) return null;

  const backPath = isClient ? `/onboarding-client/${projectId}` : `/onboarding-tasks/${projectId}`;
  const ultimaFalaMax = voz.falaAtual || [...messages].reverse().find((m) => m.role === "assistant")?.content || lastRunByKey.get("orquestrador")?.summary || "";
  const legendaFase = { ouvindo: "Estou ouvindo. Pode falar.", pensando: "Olhando os números...", falando: "", parado: temReconhecimento ? "Toque no microfone pra falar comigo" : "Seu navegador não tem voz. Use o painel de conversa." }[voz.fase];
  const maxAtivo = voz.fase !== "parado" || running === "all";
  const equipe = agents.filter((a) => a.agent_key !== "orquestrador");
  const sel = selecionado ? agentByKey.get(selecionado) : null;

  return (
    <div className="min-h-[100dvh] text-white flex flex-col relative overflow-hidden" style={{ background: `radial-gradient(1100px 520px at 50% -8%, #1a4a9c 0%, ${NAVY} 42%, #06162f 100%)` }}>
      <style>{`
        @keyframes tia-spin { to { transform: rotate(360deg); } }
        @keyframes tia-breathe { 0%,100% { transform: scale(1); opacity: .55 } 50% { transform: scale(1.08); opacity: 1 } }
        .tia-ring { background: conic-gradient(from 0deg, ${RED} 0%, rgba(204,27,27,0) 35%, rgba(255,255,255,.35) 55%, rgba(204,27,27,0) 70%, ${RED} 100%); }
        .tia-ring.on { animation: tia-spin 2.4s linear infinite; }
        .tia-glow.on { animation: tia-breathe 1.6s ease-in-out infinite; }
      `}</style>

      {/* Topo */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 hover:text-white shrink-0" onClick={() => navigate(backPath)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.25em] uppercase text-white/60">Time de IA</div>
            <div className="text-sm font-medium truncate">{company.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="text-white/85 hover:bg-white/10 hover:text-white gap-1.5 relative" onClick={() => setPainel(painel === "fila" ? "nenhum" : "fila")}>
            <Inbox className="h-4 w-4" /><span className="hidden sm:inline">Fila</span>
            {approvals.length > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[11px] font-semibold flex items-center justify-center text-white" style={{ background: RED }}>{approvals.length}</span>}
          </Button>
          <Button size="sm" variant="ghost" className="text-white/85 hover:bg-white/10 hover:text-white gap-1.5" onClick={() => setPainel(painel === "conversa" ? "nenhum" : "conversa")}>
            <MessageSquareText className="h-4 w-4" /><span className="hidden sm:inline">Conversa</span>
          </Button>
          <Button size="sm" className="gap-1.5 text-white hover:opacity-90" style={{ background: RED }} disabled={!!running} onClick={() => runTeam()}>
            {running === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}<span className="hidden sm:inline">Rodar o time</span>
          </Button>
        </div>
      </header>

      {/* Max em destaque */}
      <section className="flex flex-col items-center px-4 pt-2 md:pt-4">
        <div className="relative h-44 w-44 md:h-52 md:w-52 flex items-center justify-center">
          <div className={cn("tia-glow absolute inset-0 rounded-full blur-2xl", maxAtivo && "on")} style={{ background: voz.fase === "ouvindo" ? `${RED}66` : "rgba(255,255,255,.25)" }} />
          <div className={cn("tia-ring absolute inset-2 rounded-full", maxAtivo && "on")} style={{ opacity: maxAtivo ? 1 : 0.45 }} />
          <div className="absolute inset-[14px] rounded-full" style={{ background: NAVY }} />
          <div className="relative h-[136px] w-[136px] md:h-[164px] md:w-[164px] rounded-full overflow-hidden flex items-center justify-center shadow-2xl" style={{ background: "#fff", color: NAVY }}>
            {max?.config?.avatar_url
              ? <img src={max.config.avatar_url} alt={maxName} className="h-full w-full object-cover" />
              : voz.fase === "pensando" ? <Loader2 className="h-12 w-12 animate-spin" /> : <span className="text-6xl font-semibold">{maxName.slice(0, 1).toUpperCase()}</span>}
          </div>
        </div>
        <div className="mt-3 text-[11px] md:text-xs tracking-[0.3em] uppercase text-white/70">{maxName} · Agente de IA</div>
        <div className="mt-2 max-w-3xl text-center min-h-[64px]">
          {voz.fase === "ouvindo" && voz.parcial ? (
            <p className="text-lg md:text-2xl font-medium text-white/90">"{voz.parcial}"</p>
          ) : voz.fase === "falando" || (ultimaFalaMax && voz.fase === "parado") ? (
            <p className={cn("font-semibold leading-snug", ultimaFalaMax.length > 140 ? "text-base md:text-lg" : "text-xl md:text-3xl")}>{ultimaFalaMax.slice(0, 420)}{ultimaFalaMax.length > 420 ? "…" : ""}</p>
          ) : (
            <p className="text-xl md:text-3xl font-semibold">{voz.fase === "pensando" ? "" : `${saudacao()}, ${company.name.split(" ")[0]}.`}</p>
          )}
          {legendaFase && <p className="text-xs md:text-sm text-white/60 mt-1">{legendaFase}</p>}
          {voz.erro && <p className="text-sm mt-1" style={{ color: "#ffb4b4" }}>{voz.erro}</p>}
        </div>
      </section>

      {/* O time */}
      <section className="px-4 md:px-8 mt-4 md:mt-6 pb-36">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3 md:gap-5 max-w-5xl mx-auto">
          {equipe.map((agent) => {
            const last = lastRunByKey.get(agent.agent_key);
            const trabalhando = running === agent.agent_key || (running === "all" && RUNNABLE.includes(agent.agent_key)) || last?.status === "running";
            const recente = last && last.status === "done" && Date.now() - new Date(last.finished_at || last.started_at).getTime() < 864e5;
            const status = !agent.is_active ? "desligado" : trabalhando ? "trabalhando" : recente ? `entregou ${timeAgo(last!.finished_at || last!.started_at)}` : "de prontidão";
            const ring = !agent.is_active ? "rgba(255,255,255,.15)" : trabalhando ? RED : recente ? "#34d399" : "rgba(255,255,255,.45)";
            const pend = pendingByKey[agent.agent_key] || 0;
            return (
              <button key={agent.id} onClick={() => setSelecionado(selecionado === agent.agent_key ? null : agent.agent_key)}
                className={cn("flex flex-col items-center gap-2 rounded-2xl p-2 md:p-3 transition-colors hover:bg-white/5", selecionado === agent.agent_key && "bg-white/10", !agent.is_active && "opacity-50")}>
                <div className="relative">
                  <div className={cn("h-16 w-16 md:h-20 md:w-20 rounded-full p-[3px]", trabalhando && "animate-pulse")} style={{ background: ring, boxShadow: trabalhando ? `0 0 24px ${RED}99` : recente ? "0 0 16px rgba(52,211,153,.35)" : "none" }}>
                    <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center text-xl md:text-2xl font-semibold" style={{ background: agent.config?.avatar_url ? "#000" : agent.color, color: "#fff" }}>
                      {agent.config?.avatar_url ? <img src={agent.config.avatar_url} alt={agent.name} className="h-full w-full object-cover" /> : agent.name.slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  {pend > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[11px] font-semibold flex items-center justify-center text-white border-2" style={{ background: RED, borderColor: NAVY }}>{pend}</span>}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold leading-tight">{agent.name}</div>
                  <div className="text-[10px] md:text-[11px] text-white/60 leading-tight">{status}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalhe do agente selecionado */}
        {sel && (
          <div className="max-w-3xl mx-auto mt-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="font-semibold">{sel.name}</div>
              <div className="text-white/60 text-xs">{sel.role_title} · {scheduleLabel(sel.schedule)}</div>
              <div className="ml-auto flex items-center gap-2">
                {RUNNABLE.includes(sel.agent_key) && (
                  <Button size="sm" variant="ghost" className="h-7 text-white/90 hover:bg-white/10 hover:text-white gap-1" disabled={!!running || !sel.is_active} onClick={() => runTeam(sel.agent_key)}>
                    {running === sel.agent_key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Rodar agora
                  </Button>
                )}
                <div className="flex items-center gap-1 text-xs text-white/70"><Power className="h-3.5 w-3.5" /><Switch className="scale-75" checked={sel.is_active} onCheckedChange={(v) => toggleAgent(sel, v)} /></div>
              </div>
            </div>
            <p className="text-white/70 text-xs mt-1">{sel.description}</p>
            {lastRunByKey.get(sel.agent_key) && (
              <p className="mt-2 text-white/90 whitespace-pre-line text-[13px] leading-relaxed max-h-48 overflow-y-auto">
                <span className="text-white/50 text-xs">última entrega {timeAgo(lastRunByKey.get(sel.agent_key)!.finished_at || lastRunByKey.get(sel.agent_key)!.started_at)}: </span>
                {lastRunByKey.get(sel.agent_key)!.summary}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Rodapé: microfone */}
      <div className="fixed bottom-0 inset-x-0 flex items-end justify-center gap-6 pb-6 pt-10 pointer-events-none" style={{ background: "linear-gradient(to top, #06162f 30%, rgba(6,22,47,0))" }}>
        <Button variant="ghost" size="sm" className="pointer-events-auto text-white/70 hover:bg-white/10 hover:text-white gap-1.5 mb-3" onClick={() => voz.setMaosLivres(!voz.maosLivres)} title="Mãos livres: volta a ouvir sozinho depois da resposta">
          {voz.maosLivres ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}<span className="hidden sm:inline">{voz.maosLivres ? "mãos livres" : "toque pra falar"}</span>
        </Button>
        <button onClick={onMic} disabled={voz.fase === "pensando"}
          className={cn("pointer-events-auto h-20 w-20 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95", voz.fase === "ouvindo" && "ring-8 ring-white/15")}
          style={{ background: voz.fase === "ouvindo" ? RED : "#fff", color: voz.fase === "ouvindo" ? "#fff" : NAVY }}
          title={voz.fase === "ouvindo" ? "Parar de ouvir" : voz.fase === "falando" ? "Interromper e falar" : `Falar com o ${maxName}`}>
          {voz.fase === "ouvindo" ? <MicOff className="h-8 w-8" /> : voz.fase === "pensando" ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
        </button>
        <Button variant="ghost" size="sm" className="pointer-events-auto text-white/70 hover:bg-white/10 hover:text-white gap-1.5 mb-3" onClick={() => setPainel("conversa")}>
          <MessageSquareText className="h-4 w-4" /><span className="hidden sm:inline">digitar</span>
        </Button>
      </div>

      {/* Painel lateral: conversa ou fila */}
      {painel !== "nenhum" && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPainel("nenhum")} />
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[460px] flex flex-col shadow-2xl" style={{ background: "#0b2250" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-semibold">{painel === "conversa" ? `Conversa com o ${maxName}` : `Esperando sua aprovação (${approvals.length})`}</div>
              <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setPainel("nenhum")}><X className="h-5 w-5" /></Button>
            </div>

            {painel === "conversa" ? (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.length === 0 && <p className="text-sm text-white/60">Ainda não conversaram. Pergunta do caixa, dos leads, do tráfego, ou manda alguém do time trabalhar.</p>}
                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className="max-w-[88%] space-y-1">
                        {m.meta?.actions?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {m.meta.actions.map((a, i) => <span key={i} className="text-[10px] rounded-full px-2 py-0.5 bg-white/10 text-white/80">{labelAcao(a, (k) => agentByKey.get(k as AgentKey)?.name || k)}</span>)}
                          </div>
                        ) : null}
                        <div className={cn("rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed", m.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-white/10")} style={m.role === "user" ? { background: RED } : undefined}>{m.content}</div>
                        <div className={cn("text-[10px] text-white/40", m.role === "user" ? "text-right" : "")}>{m.role === "user" ? "você" : maxName} · {hora(m.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {sending && <div className="text-xs text-white/60 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{maxName} está olhando os números...</div>}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-white/10 px-3 pt-2 pb-3 space-y-2">
                  {messages.length < 4 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {SUGESTOES.map((s) => <button key={s} onClick={() => send(s)} disabled={sending} className="shrink-0 text-xs rounded-full border border-white/20 px-3 py-1.5 text-white/85 hover:bg-white/10">{s}</button>)}
                    </div>
                  )}
                  <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                    <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder={`Fala com o ${maxName}...`} rows={1}
                      className="flex-1 resize-none rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 max-h-40" />
                    <Button type="submit" size="icon" className="h-11 w-11 rounded-xl text-white hover:opacity-90 shrink-0" style={{ background: RED }} disabled={sending || !input.trim()}>
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                {approvals.length === 0 ? (
                  <p className="text-sm text-white/60 px-4 py-5">Nada na fila. Quando o time deixar anúncio, post ou mensagem pronta, aparece aqui. Você também pode aprovar pelo chat ou por voz.</p>
                ) : approvals.map((ap) => {
                  const agent = agentByKey.get(ap.agent_key);
                  const open = openItem === ap.id;
                  return (
                    <div key={ap.id} className="px-4 py-3 border-b border-white/10 space-y-2">
                      <button className="w-full text-left flex items-start gap-2" onClick={() => setOpenItem(open ? null : ap.id)}>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: agent?.color || NAVY }}>{(agent?.name || ap.agent_key).slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-white/55">{agent?.name} · {KIND_LABEL[ap.kind]} · {timeAgo(ap.created_at)}</div>
                          <div className="text-sm font-medium leading-snug">{ap.title}</div>
                        </div>
                        {open ? <ChevronUp className="h-4 w-4 text-white/50 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/50 shrink-0" />}
                      </button>
                      {open && <ApprovalBody ap={ap} />}
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-white/85 hover:bg-white/10 hover:text-white" onClick={() => decide(ap, "rejected")}><X className="h-3.5 w-3.5" />Rejeitar</Button>
                        <Button size="sm" className="h-7 gap-1 text-xs text-white hover:opacity-90" style={{ background: RED }} onClick={() => decide(ap, "approved")}><Check className="h-3.5 w-3.5" />Aprovar</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function labelAcao(a: { tool: string; input: any; result: any }, nameOf: (k: string) => string): string {
  const { tool: t, input: i, result: r } = a;
  if (t === "rodar_agente") return r?.ok ? `${nameOf(i.agent_key)} rodou${r.novos_itens_na_fila ? ` e deixou ${r.novos_itens_na_fila} item(ns) na fila` : ""}` : `Tentou rodar ${nameOf(i.agent_key)}: ${r?.erro || "falhou"}`;
  if (t === "decidir_item") return r?.ok ? `${i.decisao === "approved" ? "Aprovou" : "Rejeitou"}: ${r.item}` : `Não decidiu: ${r?.erro}`;
  if (t === "atualizar_agente") return r?.ok ? `Ajustou ${nameOf(i.agent_key)}` : `Não ajustou ${nameOf(i.agent_key)}: ${r?.erro}`;
  if (t === "ver_fila") return "Leu a fila";
  return t;
}

function ApprovalBody({ ap }: { ap: Approval }) {
  const p = ap.payload || {};
  const box = "text-sm space-y-1 rounded-md p-3 bg-white/5 border border-white/10";
  if (ap.kind === "ad") {
    return (
      <div className={box}>
        {p.angulo && <div className="text-[10px] uppercase tracking-wide text-white/50">{p.angulo}</div>}
        <p className="whitespace-pre-line">{p.texto}</p>
        <div className="text-xs text-white/60 pt-1">CTA: <b>{p.cta}</b>{p.publico ? ` · Público: ${p.publico}` : ""}</div>
        {p.racional && <div className="text-[11px] text-white/50 italic">{p.racional}</div>}
      </div>
    );
  }
  if (ap.kind === "post") {
    return (
      <div className={box}>
        <div className="text-[10px] uppercase tracking-wide text-white/50">{p.formato}{p.objetivo ? ` · ${p.objetivo}` : ""}</div>
        <p className="whitespace-pre-line">{p.legenda}</p>
      </div>
    );
  }
  if (ap.kind === "message") {
    return (
      <div className={box}>
        {p.contexto && <div className="text-[10px] uppercase tracking-wide text-white/50">{p.contexto}</div>}
        <p className="whitespace-pre-line">{p.mensagem}</p>
        {p.lead_id && <a className="text-[11px] underline text-white/70" href={`/crm/leads/${p.lead_id}`} target="_blank" rel="noreferrer">abrir lead no CRM</a>}
      </div>
    );
  }
  return <pre className="text-xs rounded-md p-3 bg-white/5 overflow-auto">{JSON.stringify(p, null, 2)}</pre>;
}
