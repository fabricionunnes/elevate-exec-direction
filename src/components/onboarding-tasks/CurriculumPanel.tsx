import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  userRole: string;
}

interface Pillar {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface GradeItem {
  id: string;
  pillar_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "na";
  due_date: string | null;
  task_id: string | null;
  source: "padrao" | "briefing";
  sort_order: number;
}

interface ReportCard {
  id: string;
  pillar_id: string;
  period: string;
  score: number;
  commentary: string | null;
  graded_by: string;
}

const STATUS_LABEL: Record<GradeItem["status"], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  na: "Não se aplica",
};

const scoreColor = (score: number) =>
  score >= 8 ? "text-emerald-600" : score >= 6 ? "text-amber-600" : "text-red-600";

const scoreBg = (score: number) =>
  score >= 8
    ? "bg-emerald-500/10 border-emerald-500/30"
    : score >= 6
      ? "bg-amber-500/10 border-amber-500/30"
      : "bg-red-500/10 border-red-500/30";

export const CurriculumPanel = ({ projectId, userRole }: Props) => {
  const isStaff = userRole !== "client";
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [items, setItems] = useState<GradeItem[]>([]);
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [grading, setGrading] = useState(false);
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: it }, { data: rc }] = await Promise.all([
        (supabase as any)
          .from("curriculum_pillars")
          .select("id, key, name, description, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        (supabase as any)
          .from("project_curriculum_items")
          .select("id, pillar_id, title, description, status, due_date, task_id, source, sort_order")
          .eq("project_id", projectId)
          .order("sort_order"),
        (supabase as any)
          .from("project_report_cards")
          .select("id, pillar_id, period, score, commentary, graded_by")
          .eq("project_id", projectId)
          .order("period", { ascending: false }),
      ]);
      setPillars(p || []);
      setItems(it || []);
      setCards(rc || []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const latestPeriod = cards[0]?.period || null;
  const latestCards = useMemo(
    () => (latestPeriod ? cards.filter((c) => c.period === latestPeriod) : []),
    [cards, latestPeriod],
  );
  const media = useMemo(() => {
    if (!latestCards.length) return null;
    return latestCards.reduce((s, c) => s + Number(c.score), 0) / latestCards.length;
  }, [latestCards]);

  const itemsByPillar = useMemo(() => {
    const map = new Map<string, GradeItem[]>();
    for (const it of items) {
      const list = map.get(it.pillar_id) || [];
      list.push(it);
      map.set(it.pillar_id, list);
    }
    return map;
  }, [items]);

  const overallProgress = useMemo(() => {
    const relevant = items.filter((i) => i.status !== "na");
    if (!relevant.length) return 0;
    return Math.round((relevant.filter((i) => i.status === "done").length / relevant.length) * 100);
  }, [items]);

  const runEngine = async (action: "generate" | "boletim", force = false) => {
    const setter = action === "generate" ? setGenerating : setGrading;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("curriculum-engine", {
        body: { action, projectId, force },
      });
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* mantém genérica */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if (action === "generate") {
        toast.success(`Grade gerada: ${(data as any).created} itens (tarefas criadas na Jornada)`);
      } else {
        toast.success("Boletim atualizado");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar");
    } finally {
      setter(false);
    }
  };

  const updateItemStatus = async (item: GradeItem, status: GradeItem["status"]) => {
    const prev = item.status;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status } : i)));
    const { error } = await (supabase as any)
      .from("project_curriculum_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status: prev } : i)));
      toast.error("Erro ao atualizar item");
      return;
    }
    // item concluído fecha a tarefa ligada na Jornada
    if (item.task_id && status === "done") {
      await (supabase as any)
        .from("onboarding_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", item.task_id);
    }
  };

  const saveManualScore = async (card: ReportCard) => {
    const value = Number(scoreDraft.replace(",", "."));
    if (Number.isNaN(value) || value < 0 || value > 10) {
      toast.error("Nota deve ser de 0 a 10");
      return;
    }
    const { error } = await (supabase as any)
      .from("project_report_cards")
      .update({ score: Math.round(value * 10) / 10, graded_by: "manual", updated_at: new Date().toISOString() })
      .eq("id", card.id);
    if (error) {
      toast.error("Erro ao salvar nota");
      return;
    }
    setEditingScore(null);
    toast.success("Nota ajustada");
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando grade...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Grade Curricular
          </h3>
          <p className="text-xs text-muted-foreground">
            Plano de implantação dos serviços por pilar — cada item vira tarefa na Jornada
          </p>
        </div>
        {isStaff && (
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={grading}
                onClick={() => runEngine("boletim")}
              >
                {grading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar boletim
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={generating}
              onClick={() => runEngine("generate", items.length > 0)}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {items.length > 0 ? "Regenerar grade" : "Gerar grade do briefing"}
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Este projeto ainda não tem grade curricular.</p>
            {isStaff ? (
              <p className="mt-1">
                Clique em <span className="font-medium text-foreground">Gerar grade do briefing</span> — a IA lê o
                briefing da empresa, monta a grade por pilar e cria as tarefas na Jornada.
              </p>
            ) : (
              <p className="mt-1">Em breve o seu plano de implantação aparece aqui.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Boletim */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide">Boletim da empresa</h4>
                  {latestPeriod && (
                    <Badge variant="outline" className="text-[10px]">
                      {format(new Date(`${latestPeriod}-15`), "MMMM/yyyy", { locale: ptBR })}
                    </Badge>
                  )}
                </div>
                {media !== null && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-muted-foreground">Média geral</span>
                    <span className={cn("text-2xl font-black", scoreColor(media))}>{media.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {latestCards.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Boletim ainda não emitido{isStaff ? " — clique em Atualizar boletim." : "."}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pillars
                    .filter((p) => latestCards.some((c) => c.pillar_id === p.id))
                    .map((p) => {
                      const card = latestCards.find((c) => c.pillar_id === p.id)!;
                      const score = Number(card.score);
                      return (
                        <div key={p.id} className={cn("rounded-lg border p-3 space-y-1.5", scoreBg(score))}>
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-semibold leading-tight">{p.name}</span>
                            {editingScore === card.id ? (
                              <Input
                                autoFocus
                                value={scoreDraft}
                                onChange={(e) => setScoreDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveManualScore(card);
                                  if (e.key === "Escape") setEditingScore(null);
                                }}
                                onBlur={() => setEditingScore(null)}
                                className="h-6 w-14 text-sm px-1 text-right"
                              />
                            ) : (
                              <button
                                className={cn("text-xl font-black leading-none", scoreColor(score), isStaff && "hover:opacity-70")}
                                title={isStaff ? "Clique pra ajustar a nota" : undefined}
                                onClick={() => {
                                  if (!isStaff) return;
                                  setEditingScore(card.id);
                                  setScoreDraft(String(score));
                                }}
                              >
                                {score.toFixed(1)}
                              </button>
                            )}
                          </div>
                          {card.commentary && (
                            <p className="text-[11px] text-muted-foreground leading-snug">{card.commentary}</p>
                          )}
                          {card.graded_by !== "ia" && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1">ajuste manual</Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progresso geral */}
          <div className="flex items-center gap-3">
            <Progress value={overallProgress} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {overallProgress}% da grade concluída
            </span>
          </div>

          {/* Grade por pilar */}
          <Accordion type="multiple" className="space-y-2">
            {pillars
              .filter((p) => (itemsByPillar.get(p.id) || []).length > 0)
              .map((p) => {
                const list = itemsByPillar.get(p.id) || [];
                const relevant = list.filter((i) => i.status !== "na");
                const done = relevant.filter((i) => i.status === "done").length;
                const today = new Date().toISOString().slice(0, 10);
                const late = relevant.filter(
                  (i) => i.status !== "done" && i.due_date && i.due_date < today,
                ).length;
                return (
                  <AccordionItem key={p.id} value={p.key} className="border border-border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                        <span className="font-semibold text-sm truncate">{p.name}</span>
                        {late > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                            <AlertTriangle className="h-3 w-3" /> {late} atrasado{late > 1 ? "s" : ""}
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {done}/{relevant.length}
                        </span>
                        <Progress
                          value={relevant.length ? (done / relevant.length) * 100 : 0}
                          className="h-1.5 w-24 shrink-0 hidden sm:block"
                        />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="divide-y divide-border">
                        {list.map((it) => (
                          <div key={it.id} className="py-2.5 flex items-start gap-3">
                            <CheckCircle2
                              className={cn(
                                "h-4 w-4 mt-0.5 shrink-0",
                                it.status === "done" ? "text-emerald-500" : "text-muted-foreground/30",
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "text-sm font-medium",
                                    it.status === "done" && "line-through text-muted-foreground",
                                    it.status === "na" && "text-muted-foreground/60",
                                  )}
                                >
                                  {it.title}
                                </span>
                                {it.source === "briefing" && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/40 text-primary">
                                    do briefing
                                  </Badge>
                                )}
                              </div>
                              {it.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{it.description}</p>
                              )}
                              {it.due_date && (
                                <p
                                  className={cn(
                                    "text-[11px] mt-0.5",
                                    it.status !== "done" && it.due_date < new Date().toISOString().slice(0, 10)
                                      ? "text-red-500 font-medium"
                                      : "text-muted-foreground/70",
                                  )}
                                >
                                  entrega {format(new Date(`${it.due_date}T12:00:00`), "dd/MM/yyyy")}
                                </p>
                              )}
                            </div>
                            {isStaff && (
                              <Select
                                value={it.status}
                                onValueChange={(v) => updateItemStatus(it, v as GradeItem["status"])}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(STATUS_LABEL) as GradeItem["status"][]).map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">
                                      {STATUS_LABEL[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {!isStaff && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {STATUS_LABEL[it.status]}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </>
      )}
    </div>
  );
};
