// Time de IA: a tela onde o dono vê os 8 agentes (Max + 7 especialistas), o que
// cada um fez, aprova o que ficou na fila e dispara uma rodada sob demanda.
// Escopo por projeto (mesmo padrão do UNV Social) → resolve a empresa do projeto.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Check, X, Bot, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// tabelas novas ainda não estão no types.ts gerado pelo Lovable
const db = supabase as any;

type AgentKey = "orquestrador" | "atendimento" | "briefing" | "anuncios" | "conteudo" | "reativacao" | "trafego" | "qualificacao";
interface Agent {
  id: string; agent_key: AgentKey; name: string; role_title: string; description: string | null;
  color: string; is_active: boolean; schedule: { hour?: string; days?: number[] } | null;
  config: Record<string, any>; last_run_at: string | null;
}
interface Run { id: string; agent_key: AgentKey; status: string; trigger: string; summary: string | null; started_at: string; finished_at: string | null }
interface Approval { id: string; agent_key: AgentKey; kind: "ad" | "post" | "message" | "action"; title: string; payload: Record<string, any>; status: string; created_at: string }

const RUNNABLE: AgentKey[] = ["briefing", "anuncios", "conteudo", "reativacao"];
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const KIND_LABEL: Record<Approval["kind"], string> = { ad: "Anúncio", post: "Post", message: "Mensagem", action: "Ação" };

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
  if (!s?.hour) return "sob demanda / por canal";
  const days = s.days?.length ? (s.days.length >= 6 ? "seg a sáb" : s.days.map((d) => DOW[d]).join(", ")) : "todo dia";
  return `${days} às ${s.hour}`;
};

export default function TimeIAPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null); // "all" | agent_key

  const loadData = useCallback(async (companyId: string) => {
    const [a, r, ap] = await Promise.all([
      db.from("ai_team_agents").select("*").eq("company_id", companyId),
      db.from("ai_team_runs").select("id, agent_key, status, trigger, summary, started_at, finished_at")
        .eq("company_id", companyId).order("started_at", { ascending: false }).limit(40),
      db.from("ai_team_approvals").select("id, agent_key, kind, title, payload, status, created_at")
        .eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    const order: AgentKey[] = ["orquestrador", "briefing", "atendimento", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"];
    setAgents(((a.data || []) as Agent[]).sort((x, y) => order.indexOf(x.agent_key) - order.indexOf(y.agent_key)));
    setRuns((r.data || []) as Run[]);
    setApprovals((ap.data || []) as Approval[]);
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
          .select("id, company_id, onboarding_company_id, product_name, onboarding_companies(id, name)")
          .eq("id", projectId).single();
        if (error) throw error;
        const companyId = (project as any).company_id || (project as any).onboarding_company_id;
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

  const runTeam = async (agentKey?: AgentKey) => {
    if (!company) return;
    setRunning(agentKey || "all");
    try {
      const { data, error } = await supabase.functions.invoke("ai-team-orchestrator", {
        body: { companyId: company.id, agentKey: agentKey || null },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      const novas = r?.novasAprovacoes || 0;
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

  const agentByKey = useMemo(() => new Map(agents.map((a) => [a.agent_key, a])), [agents]);
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

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!company) return null;

  const backPath = isClient ? `/onboarding-client/${projectId}` : `/onboarding-tasks/${projectId}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-[#0D2B5E] flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base md:text-lg leading-tight">Time de IA</h1>
              <p className="text-xs text-muted-foreground truncate">{company.name}</p>
            </div>
          </div>
          <Button size="sm" className="gap-2" disabled={!!running} onClick={() => runTeam()}>
            {running === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">Rodar o time agora</span>
            <span className="sm:hidden">Rodar</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-6 space-y-6">
        {/* Recado do Max */}
        <Card className="border-[#0D2B5E]/30 bg-[#0D2B5E]/5">
          <CardContent className="p-4 md:p-5 flex gap-3 md:gap-4">
            <Avatar name={agentByKey.get("orquestrador")?.name || "Max"} color="#0D2B5E" size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{agentByKey.get("orquestrador")?.name || "Max"}</span>
                <span className="text-xs text-muted-foreground">Coordenador do time</span>
                {maxRun && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(maxRun.finished_at || maxRun.started_at)}</span>}
              </div>
              <p className="text-sm mt-1 whitespace-pre-line">
                {maxRun?.summary || "O time está montado. Clique em \"Rodar o time agora\" pra primeira rodada — eu volto aqui com o que cada um entregou."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fila de aprovação */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#CC1B1B]" />Esperando sua aprovação</h2>
            <Badge variant={approvals.length ? "destructive" : "secondary"}>{approvals.length}</Badge>
          </div>
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada na fila. Quando o time deixar anúncio, post ou mensagem pronta, aparece aqui.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {approvals.map((ap) => {
                const agent = agentByKey.get(ap.agent_key);
                return (
                  <Card key={ap.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={agent?.name || ap.agent_key} color={agent?.color || "#0D2B5E"} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-muted-foreground">{agent?.name} · {KIND_LABEL[ap.kind]} · {timeAgo(ap.created_at)}</div>
                          <div className="font-medium truncate">{ap.title}</div>
                        </div>
                      </div>
                      <ApprovalBody ap={ap} />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => decide(ap, "rejected")}><X className="h-4 w-4" />Rejeitar</Button>
                        <Button size="sm" className="gap-1" onClick={() => decide(ap, "approved")}><Check className="h-4 w-4" />Aprovar</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* O time */}
        <section>
          <h2 className="font-semibold mb-3">O time</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agents.filter((a) => a.agent_key !== "orquestrador").map((agent) => {
              const last = lastRunByKey.get(agent.agent_key);
              const pending = pendingByKey[agent.agent_key] || 0;
              const runnable = RUNNABLE.includes(agent.agent_key);
              return (
                <Card key={agent.id} className={cn(!agent.is_active && "opacity-60")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar name={agent.name} color={agent.color} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.role_title}</div>
                      </div>
                      <Switch checked={agent.is_active} onCheckedChange={(v) => toggleAgent(agent, v)} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{agent.description}</p>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{scheduleLabel(agent.schedule)}</div>
                      <div>
                        <span className="text-muted-foreground">Última ação: </span>
                        <span className={cn(last?.status === "error" && "text-destructive")}>
                          {last ? `${timeAgo(last.finished_at || last.started_at)} — ${last.summary?.slice(0, 90) || last.status}` : "ainda não rodou"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {pending > 0 ? <Badge variant="destructive">{pending} pra aprovar</Badge> : <span />}
                      {runnable && (
                        <Button variant="ghost" size="sm" className="gap-1 h-7" disabled={!!running || !agent.is_active} onClick={() => runTeam(agent.agent_key)}>
                          {running === agent.agent_key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Rodar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Atividade */}
        <section>
          <h2 className="font-semibold mb-3">Atividade recente</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma rodada ainda.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 20).map((r) => {
                const agent = agentByKey.get(r.agent_key);
                return (
                  <div key={r.id} className="flex gap-3 items-start text-sm">
                    <Avatar name={agent?.name || r.agent_key} color={agent?.color || "#0D2B5E"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{agent?.name || r.agent_key}</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(r.finished_at || r.started_at)} · {r.trigger === "cron" ? "automático" : "manual"}</span>
                        {r.status !== "done" && <Badge variant={r.status === "error" ? "destructive" : "secondary"} className="text-[10px] h-4">{r.status}</Badge>}
                      </div>
                      <p className="text-muted-foreground whitespace-pre-line">{r.summary || "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 text-lg" : size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-semibold shrink-0", cls)} style={{ backgroundColor: color }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ApprovalBody({ ap }: { ap: Approval }) {
  const p = ap.payload || {};
  if (ap.kind === "ad") {
    return (
      <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
        {p.angulo && <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.angulo}</div>}
        <p className="whitespace-pre-line">{p.texto}</p>
        <div className="text-xs text-muted-foreground pt-1">CTA: <b>{p.cta}</b>{p.publico ? ` · Público: ${p.publico}` : ""}</div>
      </div>
    );
  }
  if (ap.kind === "post") {
    return (
      <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.formato}{p.objetivo ? ` · ${p.objetivo}` : ""}</div>
        <p className="whitespace-pre-line">{p.legenda}</p>
      </div>
    );
  }
  if (ap.kind === "message") {
    return (
      <div className="text-sm bg-muted/50 rounded-md p-3">
        <p className="whitespace-pre-line">{p.mensagem}</p>
      </div>
    );
  }
  return <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto">{JSON.stringify(p, null, 2)}</pre>;
}
