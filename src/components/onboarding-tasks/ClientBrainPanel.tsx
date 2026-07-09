import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, RefreshCw, AlertTriangle, CheckCircle2, Clock, Quote,
  HeartPulse, Trophy, Flame, ListChecks, MessagesSquare, Plus, Loader2,
} from "lucide-react";
import { format, formatDistanceToNow, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// CÉREBRO DO CLIENTE — estado vivo consolidado (reuniões, WhatsApp, KPIs,
// entregas, saúde, NPS) com promessas, riscos e próximas ações. A geração
// acontece na edge `client-brain` (cache 12h; Regenerar força).

interface BrainData {
  momento?: string;
  termometro?: "seguro" | "atencao" | "risco_alto";
  termometro_motivo?: string;
  promessas?: { o_que: string; quem: string; status: string; evidencia?: string }[];
  dores_atuais?: string[];
  vitorias_recentes?: string[];
  riscos?: { sinal: string; evidencia?: string; gravidade: string }[];
  proximas_acoes?: { acao: string; motivo?: string; urgencia: string }[];
  relacionamento?: { ultima_reuniao?: string | null; dias_sem_reuniao?: number | null; whatsapp?: string; resumo?: string };
  citacoes_chave?: { quem: string; frase: string; quando?: string; leitura?: string }[];
}

const TERMO_STYLE: Record<string, { label: string; cls: string }> = {
  seguro: { label: "Seguro", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  atencao: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  risco_alto: { label: "Risco Alto", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
};

const URGENCIA_STYLE: Record<string, string> = {
  hoje: "bg-red-500/15 text-red-600 dark:text-red-400",
  esta_semana: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  este_mes: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

const PROMESSA_STYLE: Record<string, string> = {
  vencida: "bg-red-500/15 text-red-600 dark:text-red-400",
  pendente: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  cumprida: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export const ClientBrainPanel = ({ projectId }: { projectId: string }) => {
  const [brain, setBrain] = useState<BrainData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState<number | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Set<number>>(new Set());

  // Vira a ação sugerida numa tarefa real do projeto (dono = usuário atual).
  // Guarda: se já existe tarefa igual/parecida (aberta ou concluída há pouco),
  // não duplica — o cérebro já é instruído a não repetir, isto é a rede de segurança.
  const norm = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const isSimilar = (a: string, b: string) => {
    const wa = new Set(norm(a));
    const wb = new Set(norm(b));
    if (wa.size === 0 || wb.size === 0) return false;
    let inter = 0;
    wa.forEach((w) => { if (wb.has(w)) inter++; });
    const jaccard = inter / (wa.size + wb.size - inter);
    return jaccard >= 0.5; // metade das palavras significativas em comum
  };

  const createTask = async (idx: number, acao: { acao: string; motivo?: string; urgencia: string }) => {
    setCreatingTask(idx);
    try {
      // 1) Já existe tarefa parecida no projeto? (aberta ou concluída nos últimos 60 dias)
      const cutoff = format(addDays(new Date(), -60), "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("onboarding_tasks")
        .select("title, status, completed_at")
        .eq("project_id", projectId)
        .or(`status.neq.completed,completed_at.gte.${cutoff}`)
        .limit(200);
      const dup = (existing || []).find((t: any) => isSimilar(t.title || "", acao.acao));
      if (dup) {
        const feita = (dup as any).status === "completed";
        toast.info(feita ? "Já existe uma tarefa parecida concluída — não criei de novo." : "Já existe uma tarefa parecida em aberto — não criei de novo.");
        setCreatedTasks((s) => new Set(s).add(idx));
        setCreatingTask(null);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      let staffId: string | null = null;
      if (userData?.user?.id) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        staffId = staff?.id || null;
      }
      const dueDays = acao.urgencia === "hoje" ? 0 : acao.urgencia === "esta_semana" ? 3 : 14;
      const { error: insErr } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        title: acao.acao.slice(0, 140),
        description: acao.motivo ? `${acao.motivo}\n\n(Origem: Cérebro do Cliente)` : "(Origem: Cérebro do Cliente)",
        due_date: format(addDays(new Date(), dueDays), "yyyy-MM-dd"),
        status: "pending",
        priority: acao.urgencia === "hoje" ? "high" : "medium",
        is_internal: true,
        responsible_staff_id: staffId,
      } as never);
      if (insErr) throw insErr;
      setCreatedTasks((s) => new Set(s).add(idx));
      toast.success("Tarefa criada no projeto");
    } catch {
      toast.error("Erro ao criar a tarefa");
    } finally {
      setCreatingTask(null);
    }
  };

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("client-brain", {
        body: { projectId, force },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message);
      setBrain(data.brain);
      setGeneratedAt(data.generated_at);
      if (force && data?.auto_completed > 0) {
        toast.success(
          data.auto_completed === 1
            ? "1 tarefa que o time já executou foi registrada como concluída."
            : `${data.auto_completed} tarefas que o time já executou foram registradas como concluídas.`,
        );
      }
    } catch (e: any) {
      setError(e.message || "Erro ao gerar o cérebro do cliente");
      toast.error("Erro ao gerar o cérebro do cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Consolidando reuniões, conversas, resultados e entregas do cliente...
        </p>
      </div>
    );
  }

  if (error || !brain) {
    return (
      <div className="py-12 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">{error || "Sem dados suficientes ainda."}</p>
        <Button variant="outline" size="sm" onClick={() => load(true)} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const termo = TERMO_STYLE[brain.termometro || "atencao"] || TERMO_STYLE.atencao;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Cérebro do Cliente</h2>
            <p className="text-[11px] text-muted-foreground">
              {generatedAt
                ? `Atualizado ${formatDistanceToNow(new Date(generatedAt), { locale: ptBR, addSuffix: true })}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("border text-xs px-2.5 py-1", termo.cls)} title={brain.termometro_motivo}>
            {termo.label}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => load(true)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerar
          </Button>
        </div>
      </div>

      {/* Momento */}
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <p className="text-sm leading-relaxed">{brain.momento}</p>
          {brain.termometro_motivo && (
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Termômetro:</strong> {brain.termometro_motivo}
            </p>
          )}
          {brain.relacionamento?.resumo && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <MessagesSquare className="h-3 w-3" />
              {brain.relacionamento.resumo}
              {brain.relacionamento.whatsapp && <span>· WhatsApp: {brain.relacionamento.whatsapp}</span>}
              {typeof brain.relacionamento.dias_sem_reuniao === "number" && (
                <span>· {brain.relacionamento.dias_sem_reuniao} dias sem reunião</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Próximas ações + Riscos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Próximas ações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(brain.proximas_acoes || []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma ação sugerida.</p>
            )}
            {(brain.proximas_acoes || []).map((a, i) => (
              <div key={i} className="rounded-lg border border-border/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{a.acao}</p>
                  <Badge className={cn("border-0 text-[10px] shrink-0", URGENCIA_STYLE[a.urgencia] || URGENCIA_STYLE.este_mes)}>
                    {a.urgencia === "hoje" ? "Hoje" : a.urgencia === "esta_semana" ? "Esta semana" : "Este mês"}
                  </Badge>
                </div>
                {a.motivo && <p className="text-xs text-muted-foreground mt-1">{a.motivo}</p>}
                <div className="mt-1.5">
                  {createdTasks.has(i) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Tarefa criada
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1"
                      disabled={creatingTask !== null}
                      onClick={() => createTask(i, a)}
                    >
                      {creatingTask === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Criar tarefa
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" /> Riscos de churn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(brain.riscos || []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum risco identificado agora.</p>
            )}
            {(brain.riscos || []).map((r, i) => (
              <div key={i} className="rounded-lg border border-border/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{r.sinal}</p>
                  <Badge
                    className={cn(
                      "border-0 text-[10px] shrink-0",
                      r.gravidade === "alta"
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : r.gravidade === "media"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-zinc-500/15 text-zinc-500",
                    )}
                  >
                    {r.gravidade}
                  </Badge>
                </div>
                {r.evidencia && <p className="text-xs text-muted-foreground mt-1">{r.evidencia}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Promessas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Promessas e compromissos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(brain.promessas || []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma promessa mapeada.</p>
          )}
          {(brain.promessas || []).map((p, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border/60 p-2.5">
              <Badge className={cn("border-0 text-[10px] shrink-0 mt-0.5", PROMESSA_STYLE[p.status] || PROMESSA_STYLE.pendente)}>
                {p.status}
              </Badge>
              <div className="min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-medium">{p.quem === "UNV" ? "UNV" : "Cliente"}:</span> {p.o_que}
                </p>
                {p.evidencia && <p className="text-xs text-muted-foreground mt-0.5">{p.evidencia}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Vitórias + Dores */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" /> Vitórias pra lembrar ao cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {(brain.vitorias_recentes || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nada mapeado — gerar vitória é a próxima missão.</p>
              )}
              {(brain.vitorias_recentes || []).map((v, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-amber-500" /> Dores vivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {(brain.dores_atuais || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma dor ativa mapeada.</p>
              )}
              {(brain.dores_atuais || []).map((d, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Citações-chave */}
      {(brain.citacoes_chave || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Quote className="h-4 w-4 text-primary" /> O cliente disse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(brain.citacoes_chave || []).map((c, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm italic">"{c.frase}"</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  — {c.quem}
                  {c.quando ? `, ${format(new Date(c.quando), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                  {c.leitura ? ` · ${c.leitura}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
