// Time de IA: conversa com o Max (coordenador) no centro, o time e a fila de
// aprovação ao lado. O Max responde com os dados reais do Nexus e aciona os
// outros agentes por mensagem (function ai-team-chat). Cores da UNV: navy
// #0D2B5E, vermelho #CC1B1B, fundo claro.
// Escopo por projeto (mesmo padrão do UNV Social) → resolve a empresa do projeto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Check, X, Bot, Clock, SendHorizontal, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

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
const SUGESTOES = [
  "Como está o caixa hoje?",
  "Quem eu devo ligar primeiro?",
  "O que tem na fila pra eu aprovar?",
  "Luna, o que está queimando verba?",
  "Por que o churn subiu?",
  "Manda o Theo escrever pros leads parados",
];

const timeAgo = (iso: string | null) => {
  if (!iso) return "ainda não rodou";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
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
  const [tab, setTab] = useState<"conversa" | "time" | "fila">("conversa");
  const [openItem, setOpenItem] = useState<string | null>(null);
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

        // monta o time padrão na primeira abertura
        await db.rpc("ai_team_seed_defaults", { p_company_id: companyId });
        await loadData(companyId);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar o Time de IA");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, navigate, loadData]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  const agentByKey = useMemo(() => new Map(agents.map((a) => [a.agent_key, a])), [agents]);
  const max = agentByKey.get("orquestrador");
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
  const maxRun = lastRunByKey.get("orquestrador");

  // ── conversa ──
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !company || sending) return;
    setInput("");
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: msg, created_at: new Date().toISOString(), pending: true }]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-team-chat", { body: { companyId: company.id, message: msg } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const acted = (data?.actions || []).some((a: any) => ["rodar_agente", "decidir_item", "atualizar_agente"].includes(a.tool));
      await loadData(company.id);
      if (acted) toast.success("O Max mexeu no time; painel atualizado");
    } catch (e: any) {
      toast.error(e?.message || "O Max não respondeu");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── ações do painel ──
  const runTeam = async (agentKey?: AgentKey) => {
    if (!company) return;
    setRunning(agentKey || "all");
    try {
      const { data, error } = await supabase.functions.invoke("ai-team-orchestrator", {
        body: { companyId: company.id, agentKey: agentKey || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const novas = data?.results?.[0]?.novasAprovacoes || 0;
      toast.success(novas ? `Rodada concluída: ${novas} item(ns) pra você aprovar` : "Rodada concluída");
      await loadData(company.id);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao rodar o time");
    } finally {
      setRunning(null);
    }
  };

  const toggleAgent = async (agent: Agent, value: boolean) => {
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: value } : a));
    const { error } = await db.from("ai_team_agents").update({ is_active: value, updated_at: new Date().toISOString() }).eq("id", agent.id);
    if (error) {
      toast.error("Erro ao alterar status");
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: !value } : a));
    } else toast.success(value ? `${agent.name} ligado` : `${agent.name} desligado`);
  };

  const decide = async (ap: Approval, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("ai_team_approvals")
      .update({ status, decided_at: new Date().toISOString(), decided_by: user?.id || null }).eq("id", ap.id);
    if (error) { toast.error("Erro ao registrar decisão"); return; }
    setApprovals((prev) => prev.filter((p) => p.id !== ap.id));
    toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F6FA" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} /></div>;
  }
  if (!company) return null;

  const backPath = isClient ? `/onboarding-client/${projectId}` : `/onboarding-tasks/${projectId}`;
  const abertura = maxRun?.summary
    ? maxRun.summary
    : `Fala, ${company.name.split(" ")[0]}. Sou o Max, coordeno o seu time de IA. Me pergunta do caixa, dos leads, do tráfego, ou manda alguém do time trabalhar. Se quiser ver todo mundo rodando de uma vez, é o botão "Rodar o time".`;

  return (
    <div className="h-[100dvh] flex flex-col" style={{ background: "#F4F6FA" }}>
      {/* Header navy */}
      <header className="shrink-0 text-white" style={{ background: NAVY }}>
        <div className="flex items-center justify-between px-3 md:px-5 py-2.5 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base md:text-lg leading-tight">Time de IA</h1>
              <p className="text-[11px] md:text-xs text-white/70 truncate">{company.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white hidden sm:flex" onClick={() => loadData(company.id)} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" className="gap-2 text-white hover:opacity-90" style={{ background: RED }} disabled={!!running} onClick={() => runTeam()}>
              {running === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="hidden sm:inline">Rodar o time</span>
              <span className="sm:hidden">Rodar</span>
            </Button>
          </div>
        </div>
        {/* Tabs (mobile) */}
        <div className="lg:hidden flex border-t border-white/10">
          {([["conversa", "Conversa"], ["time", "Time"], ["fila", `Fila${approvals.length ? ` (${approvals.length})` : ""}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", tab === k ? "border-white text-white" : "border-transparent text-white/60")}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Corpo */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto lg:grid lg:grid-cols-[1fr_380px] lg:gap-4 lg:p-4">
        {/* ── Conversa com o Max ── */}
        <section className={cn("h-full min-h-0 flex flex-col bg-white lg:rounded-2xl lg:border lg:shadow-sm", tab !== "conversa" && "hidden lg:flex")}>
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Avatar name={max?.name || "Max"} color={NAVY} size="md" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight" style={{ color: NAVY }}>{max?.name || "Max"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Coordenador do time · lendo o Nexus em tempo real
              </div>
            </div>
            {maxRun && <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1"><Clock className="h-3 w-3" />última rodada {timeAgo(maxRun.finished_at || maxRun.started_at)}</span>}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-5 py-4 space-y-4">
            <Bubble role="assistant" name={max?.name || "Max"} text={abertura} />
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} name={m.role === "assistant" ? (max?.name || "Max") : "Você"} text={m.content} time={hora(m.created_at)} actions={m.meta?.actions} agentByKey={agentByKey} />
            ))}
            {sending && (
              <div className="flex items-end gap-2">
                <Avatar name={max?.name || "Max"} color={NAVY} size="sm" />
                <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{max?.name || "Max"} está olhando os números...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t px-3 md:px-4 pt-2 pb-3 space-y-2">
            {messages.length < 4 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={sending}
                    className="shrink-0 text-xs rounded-full border px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors" style={{ borderColor: `${NAVY}33`, color: NAVY }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`Fala com o ${max?.name || "Max"}...`}
                rows={1}
                className="flex-1 resize-none rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 max-h-40"
                style={{ ["--tw-ring-color" as any]: `${NAVY}55` }}
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-xl text-white hover:opacity-90 shrink-0" style={{ background: RED }} disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
              </Button>
            </form>
          </div>
        </section>

        {/* ── Lateral: time + fila ── */}
        <aside className="h-full min-h-0 overflow-y-auto space-y-4 p-3 lg:p-0">
          {/* Fila */}
          <div className={cn("bg-white rounded-2xl border shadow-sm", tab !== "fila" && "hidden lg:block")}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-semibold text-sm" style={{ color: NAVY }}>Esperando sua aprovação</h2>
              <Badge className="text-white" style={{ background: approvals.length ? RED : "#94a3b8" }}>{approvals.length}</Badge>
            </div>
            {approvals.length === 0 ? (
              <p className="text-xs text-muted-foreground px-4 py-4">Nada na fila. Quando o time deixar anúncio, post ou mensagem pronta, aparece aqui. Você também pode aprovar pelo chat.</p>
            ) : (
              <div className="divide-y">
                {approvals.map((ap) => {
                  const agent = agentByKey.get(ap.agent_key);
                  const open = openItem === ap.id;
                  return (
                    <div key={ap.id} className="px-4 py-3 space-y-2">
                      <button className="w-full text-left flex items-start gap-2" onClick={() => setOpenItem(open ? null : ap.id)}>
                        <Avatar name={agent?.name || ap.agent_key} color={agent?.color || NAVY} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-muted-foreground">{agent?.name} · {KIND_LABEL[ap.kind]} · {timeAgo(ap.created_at)}</div>
                          <div className="text-sm font-medium leading-snug">{ap.title}</div>
                        </div>
                        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                      {open && <ApprovalBody ap={ap} />}
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => decide(ap, "rejected")}><X className="h-3.5 w-3.5" />Rejeitar</Button>
                        <Button size="sm" className="h-7 gap-1 text-xs text-white hover:opacity-90" style={{ background: NAVY }} onClick={() => decide(ap, "approved")}><Check className="h-3.5 w-3.5" />Aprovar</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time */}
          <div className={cn("bg-white rounded-2xl border shadow-sm", tab !== "time" && "hidden lg:block")}>
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-sm" style={{ color: NAVY }}>O time</h2>
            </div>
            <div className="divide-y">
              {agents.filter((a) => a.agent_key !== "orquestrador").map((agent) => {
                const last = lastRunByKey.get(agent.agent_key);
                const pending = pendingByKey[agent.agent_key] || 0;
                const runnable = RUNNABLE.includes(agent.agent_key);
                return (
                  <div key={agent.id} className={cn("px-4 py-3 flex gap-3", !agent.is_active && "opacity-55")}>
                    <Avatar name={agent.name} color={agent.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm leading-tight">{agent.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{agent.role_title}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {runnable && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!!running || !agent.is_active} onClick={() => runTeam(agent.agent_key)} title={`Rodar ${agent.name} agora`}>
                              {running === agent.agent_key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Switch className="scale-75" checked={agent.is_active} onCheckedChange={(v) => toggleAgent(agent, v)} />
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{scheduleLabel(agent.schedule)}</div>
                      <div className="text-xs mt-1 line-clamp-2">
                        {last ? <><span className="text-muted-foreground">{timeAgo(last.finished_at || last.started_at)}: </span><span className={cn(last.status === "error" && "text-destructive")}>{last.summary?.slice(0, 140) || last.status}</span></> : <span className="text-muted-foreground">ainda não rodou</span>}
                      </div>
                      {pending > 0 && <Badge variant="outline" className="mt-1 text-[10px] h-4" style={{ borderColor: RED, color: RED }}>{pending} pra aprovar</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 text-lg" : size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-semibold shrink-0", cls)} style={{ backgroundColor: color }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const TOOL_LABEL: Record<string, (input: any, result: any, nameOf: (k: string) => string) => string> = {
  rodar_agente: (i, r, nameOf) => r?.ok ? `${nameOf(i.agent_key)} rodou${r.novos_itens_na_fila ? ` e deixou ${r.novos_itens_na_fila} item(ns) na fila` : ""}` : `Tentou rodar ${nameOf(i.agent_key)}: ${r?.erro || "falhou"}`,
  decidir_item: (i, r) => r?.ok ? `${i.decisao === "approved" ? "Aprovou" : "Rejeitou"}: ${r.item}` : `Não conseguiu decidir: ${r?.erro}`,
  atualizar_agente: (i, r, nameOf) => r?.ok ? `Ajustou ${nameOf(i.agent_key)} (${(r.alterado || []).join(", ")})` : `Não ajustou ${nameOf(i.agent_key)}: ${r?.erro}`,
  ver_fila: () => "Leu a fila de aprovação",
};

function Bubble({ role, name, text, time, actions, agentByKey }: { role: "user" | "assistant"; name: string; text: string; time?: string; actions?: { tool: string; input: any; result: any }[]; agentByKey?: Map<AgentKey, Agent> }) {
  const nameOf = (k: string) => agentByKey?.get(k as AgentKey)?.name || k;
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white whitespace-pre-wrap" style={{ background: RED }}>{text}</div>
          {time && <div className="text-[10px] text-muted-foreground text-right mt-0.5 pr-1">{time}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Avatar name={name} color={NAVY} size="sm" />
      <div className="max-w-[88%] md:max-w-[78%] space-y-1">
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {actions.map((a, i) => (
              <span key={i} className="text-[10px] rounded-full px-2 py-0.5 border" style={{ borderColor: `${NAVY}33`, color: NAVY, background: `${NAVY}0D` }}>
                {(TOOL_LABEL[a.tool] || (() => a.tool))(a.input, a.result, nameOf)}
              </span>
            ))}
          </div>
        )}
        <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed" style={{ borderLeft: `3px solid ${NAVY}` }}>{text}</div>
        {time && <div className="text-[10px] text-muted-foreground mt-0.5 pl-1">{name} · {time}</div>}
      </div>
    </div>
  );
}

function ApprovalBody({ ap }: { ap: Approval }) {
  const p = ap.payload || {};
  if (ap.kind === "ad") {
    return (
      <div className="text-sm space-y-1 bg-slate-50 rounded-md p-3">
        {p.angulo && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.angulo}</div>}
        <p className="whitespace-pre-line">{p.texto}</p>
        <div className="text-xs text-muted-foreground pt-1">CTA: <b>{p.cta}</b>{p.publico ? ` · Público: ${p.publico}` : ""}</div>
        {p.racional && <div className="text-[11px] text-muted-foreground italic">{p.racional}</div>}
      </div>
    );
  }
  if (ap.kind === "post") {
    return (
      <div className="text-sm space-y-1 bg-slate-50 rounded-md p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.formato}{p.objetivo ? ` · ${p.objetivo}` : ""}</div>
        <p className="whitespace-pre-line">{p.legenda}</p>
      </div>
    );
  }
  if (ap.kind === "message") {
    return (
      <div className="text-sm bg-slate-50 rounded-md p-3 space-y-1">
        {p.contexto && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.contexto}</div>}
        <p className="whitespace-pre-line">{p.mensagem}</p>
        {p.lead_id && <a className="text-[11px] underline" style={{ color: NAVY }} href={`/crm/leads/${p.lead_id}`} target="_blank" rel="noreferrer">abrir lead no CRM</a>}
      </div>
    );
  }
  return <pre className="text-xs bg-slate-50 rounded-md p-3 overflow-auto">{JSON.stringify(p, null, 2)}</pre>;
}
