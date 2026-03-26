import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Building2, Globe, Phone, MapPin, User, Briefcase, Instagram,
  RefreshCw, Thermometer, Target, AlertTriangle, TrendingUp,
  Calendar, Clock, CheckCircle, XCircle, Tag, StickyNote,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { LeadSummaryData } from "./useLeadSummary";

interface Props {
  data: LeadSummaryData | null;
  loading: boolean;
  onRegenerate: () => void;
}

export const LeadSummaryOverview = ({ data, loading, onRegenerate }: Props) => {
  if (loading) return <OverviewSkeleton />;

  if (!data) return (
    <div className="p-6 text-center text-muted-foreground text-sm">
      Ainda não há dados para exibir. Carregando...
    </div>
  );

  const { ai, lead, journey, meetings, activities } = data;
  const tempIcon = ai?.temperature === "hot" ? "🔥" : ai?.temperature === "warm" ? "🌤️" : "❄️";
  const tempLabel = ai?.temperature === "hot" ? "Quente" : ai?.temperature === "warm" ? "Morno" : "Frio";
  const tempColor = ai?.temperature === "hot"
    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
    : ai?.temperature === "warm"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";

  // Determine which stages the lead has passed through
  const passedStageNames = new Set<string>();
  (journey.stage_changes || []).forEach(sc => {
    if (sc.from) passedStageNames.add(sc.from);
    if (sc.to) passedStageNames.add(sc.to);
  });
  if (lead.current_stage) passedStageNames.add(lead.current_stage);

  // Calculate days per stage from history
  const stageDurations: Record<string, number> = {};
  const sortedChanges = [...(journey.stage_changes || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (sortedChanges.length > 0) {
    // First stage: from lead creation to first change
    const firstChange = sortedChanges[0];
    if (firstChange.from) {
      const daysFirst = Math.floor(
        (new Date(firstChange.date).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      stageDurations[firstChange.from] = daysFirst;
    }
    for (let i = 0; i < sortedChanges.length; i++) {
      const current = sortedChanges[i];
      const next = sortedChanges[i + 1];
      if (current.to) {
        const endDate = next ? new Date(next.date) : new Date();
        const days = Math.floor((endDate.getTime() - new Date(current.date).getTime()) / (1000 * 60 * 60 * 24));
        stageDurations[current.to] = days;
      }
    }
  }

  // Meeting activities for table
  const meetingActivities = activities.filter(a => a.type === "meeting" || a.type === "call");

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header with regenerate */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Visão Geral — {lead.name}</h3>
        <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerar
        </Button>
      </div>

      {/* Section 1: Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Identidade da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCard icon={Building2} label="Empresa" value={lead.company || lead.name} />
            <InfoCard icon={Briefcase} label="Segmento" value={lead.segment} />
            {lead.trade_name && <InfoCard icon={Instagram} label="Instagram" value={`@${lead.trade_name.replace('@', '')}`} link={`https://instagram.com/${lead.trade_name.replace('@', '')}`} />}
            <InfoCard icon={Globe} label="Website" value={lead.email} />
            <InfoCard icon={Phone} label="Telefone" value={lead.phone} link={lead.phone ? `tel:${lead.phone}` : undefined} />
            <InfoCard icon={MapPin} label="Localização" value={[lead.city, lead.state].filter(Boolean).join("/")} />
            <InfoCard icon={Briefcase} label="Porte" value={lead.employee_count} />
            <InfoCard icon={User} label="Responsável" value={lead.name} />
            <InfoCard icon={User} label="Cargo" value={lead.role} />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: AI Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Resumo da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">{ai?.company_summary || "Não foi possível gerar o resumo."}</p>
        </CardContent>
      </Card>

      {/* Section 3: Journey */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Jornada no CRM
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Tempo total no funil: <strong>{lead.days_in_funnel} dias</strong>
          </p>
        </CardHeader>
        <CardContent>
          {/* Desktop horizontal */}
          <div className="hidden sm:flex items-start gap-0 overflow-x-auto pb-2">
            {journey.stages.map((stage, idx) => {
              const isCurrent = stage.name === lead.current_stage;
              const isPassed = passedStageNames.has(stage.name);
              const days = stageDurations[stage.name];
              return (
                <div key={stage.id} className="flex items-start flex-shrink-0">
                  <div className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border min-w-[100px] transition-all",
                    isCurrent ? "border-primary bg-primary/10 ring-2 ring-primary/30" :
                    isPassed ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30" :
                    "border-border bg-muted/30"
                  )}>
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      isCurrent ? "bg-primary" : isPassed ? "bg-green-500" : "bg-muted-foreground/30"
                    )} />
                    <span className={cn("text-[10px] font-medium text-center leading-tight", isCurrent && "text-primary")}>
                      {stage.name}
                    </span>
                    {days !== undefined && (
                      <span className="text-[9px] text-muted-foreground">{days}d</span>
                    )}
                  </div>
                  {idx < journey.stages.length - 1 && (
                    <div className={cn(
                      "w-6 h-[2px] mt-5 flex-shrink-0",
                      isPassed ? "bg-green-400" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Mobile vertical */}
          <div className="sm:hidden space-y-2">
            {journey.stages.map((stage) => {
              const isCurrent = stage.name === lead.current_stage;
              const isPassed = passedStageNames.has(stage.name);
              const days = stageDurations[stage.name];
              return (
                <div key={stage.id} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border",
                  isCurrent ? "border-primary bg-primary/10" :
                  isPassed ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30" :
                  "border-border bg-muted/30 opacity-60"
                )}>
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0",
                    isCurrent ? "bg-primary" : isPassed ? "bg-green-500" : "bg-muted-foreground/30"
                  )} />
                  <span className="text-xs font-medium flex-1">{stage.name}</span>
                  {days !== undefined && <span className="text-[10px] text-muted-foreground">{days}d</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Meetings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Histórico de Reuniões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MiniStat label="Realizadas" value={meetings.total_realized} icon={CheckCircle} color="text-green-500" />
            <MiniStat label="Reagendadas" value={meetings.total_rescheduled} icon={Clock} color="text-amber-500" />
            <MiniStat label="No Show" value={meetings.total_no_show} icon={XCircle} color="text-red-500" />
            <MiniStat label="Dias desde 1º contato" value={lead.days_in_funnel} icon={Calendar} color="text-blue-500" />
          </div>

          {meetingActivities.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {meetingActivities.map((activity) => (
                <AccordionItem key={activity.id} value={activity.id}>
                  <AccordionTrigger className="text-xs hover:no-underline py-2">
                    <div className="flex items-center gap-3 w-full pr-2">
                      <span className="text-muted-foreground text-[10px] min-w-[70px]">
                        {activity.scheduled_at ? format(new Date(activity.scheduled_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </span>
                      <span className="font-medium truncate flex-1 text-left">{activity.title}</span>
                      <Badge variant={activity.status === "completed" ? "default" : "secondary"} className="text-[9px] h-5">
                        {activity.status === "completed" ? "Realizada" : activity.status === "scheduled" ? "Agendada" : activity.status}
                      </Badge>
                      {activity.responsible && (
                        <span className="text-muted-foreground text-[10px]">{activity.responsible}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-xs space-y-1 pl-4">
                      {activity.description && <p><strong>Descrição:</strong> {activity.description}</p>}
                      {activity.notes && <p><strong>Notas:</strong> {activity.notes}</p>}
                      {!activity.description && !activity.notes && (
                        <p className="text-muted-foreground italic">Sem detalhes registrados</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma reunião registrada</p>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Temperature */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-primary" />
            Status e Temperatura do Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className={cn("rounded-lg p-3 text-center", tempColor)}>
              <span className="text-2xl">{tempIcon}</span>
              <p className="text-sm font-semibold mt-1">{tempLabel}</p>
              <p className="text-[10px] mt-0.5">{ai?.temperature_reason}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Interesse</p>
              <p className="text-sm font-semibold mt-1">
                {ai?.interest_level === "high" ? "Alto" : ai?.interest_level === "medium" ? "Médio" : "Baixo"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Probabilidade</p>
              <p className="text-lg font-bold mt-1">{ai?.close_probability || 0}%</p>
              <p className="text-[10px] text-muted-foreground">{ai?.close_probability_reason}</p>
            </div>
            <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Principal Dor
              </p>
              <p className="text-xs mt-1">{ai?.main_pain || "Não identificada"}</p>
            </div>
            <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Principal Objeção</p>
              <p className="text-xs mt-1">{ai?.main_objection || "Nenhuma registrada"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Tags & Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Observações e Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" style={{ borderLeftColor: tag.color, borderLeftWidth: 3 }} className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
          {lead.notes && (
            <div className="rounded-lg border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium mb-1 flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> Notas
              </p>
              <p className="text-xs whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
          {/* Last 3 notes from activities */}
          {activities.filter(a => a.notes).slice(0, 3).map(a => (
            <div key={a.id} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {a.responsible || "—"} • {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <Badge variant="outline" className="text-[9px] h-4">{a.type}</Badge>
              </div>
              <p className="text-xs">{a.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

function InfoCard({ icon: Icon, label, value, link }: { icon: any; label: string; value: string | null | undefined; link?: string }) {
  if (!value) return (
    <div className="rounded-lg border p-2.5 bg-muted/20">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">—</p>
    </div>
  );
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 block truncate">
          {value}
        </a>
      ) : (
        <p className="text-xs font-medium mt-0.5 truncate">{value}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <Icon className={cn("h-4 w-4 mx-auto", color)} />
      <p className="text-lg font-bold mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(j => <Skeleton key={j} className="h-16 rounded-lg" />)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
