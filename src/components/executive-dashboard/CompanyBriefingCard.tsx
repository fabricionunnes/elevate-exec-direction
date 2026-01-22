import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Calendar, 
  Target, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ExternalLink,
  Sparkles,
  Clock,
  Users,
  Phone,
  FileText,
  Lightbulb,
  ArrowRight,
  Flag,
  Zap,
  BarChart3,
  Plus,
  DollarSign
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";

interface KPIData {
  name: string;
  target: number;
  result: number;
  percentage: number;
  kpiType: string;
}

export interface TaskData {
  id: string;
  title: string;
  due_date?: string;
  completed_at?: string;
  status: string;
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  date: string;
}

export interface MeetingsByMonth {
  month: string; // "2026-01"
  monthLabel: string; // "Janeiro 2026"
  meetings: MeetingHistoryItem[];
}

interface CompanyBriefingCardProps {
  project: {
    id: string;
    company_name: string;
    health_score: number;
    risk_level: string;
    goal_projection?: number;
    last_meeting_date?: string;
    overdue_tasks: number;
    nps_score?: number;
    next_action?: string;
    ai_insight?: string;
    days_since_meeting?: number;
    segment?: string;
    contract_value?: number;
    renewal_date?: string;
    main_contact?: string;
    last_nps_feedback?: string;
    pending_support_tickets?: number;
    completed_tasks_this_month?: number;
    total_tasks_this_month?: number;
    kpis?: KPIData[];
    meetingHistory?: MeetingsByMonth[];
    lastSalesEntryDate?: string;
    upcomingTasks?: TaskData[];
    completedTasks?: TaskData[];
  };
  index: number;
  expanded?: boolean;
  onCreateInternalTask?: (projectId: string, companyName: string) => void;
  onTaskClick?: (taskId: string, projectId: string) => void;
  onMeetingClick?: (meetingId: string, projectId: string) => void;
}

export function CompanyBriefingCard({ project, index, expanded = true, onCreateInternalTask, onTaskClick, onMeetingClick }: CompanyBriefingCardProps) {
  const navigate = useNavigate();

  const getHealthColor = (score: number) => {
    if (score >= 70) return "from-green-500 to-green-400";
    if (score >= 40) return "from-yellow-500 to-yellow-400";
    return "from-red-500 to-red-400";
  };

  const getHealthBg = (score: number) => {
    if (score >= 70) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
    if (score >= 40) return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
    return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 70) return "text-green-700 dark:text-green-400";
    if (score >= 40) return "text-yellow-700 dark:text-yellow-400";
    return "text-red-700 dark:text-red-400";
  };

  const getNPSBadge = (score?: number) => {
    if (score === undefined || score === null) return null;
    if (score >= 9) return { label: "Promotor", className: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700" };
    if (score >= 7) return { label: "Neutro", className: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700" };
    return { label: "Detrator", className: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700" };
  };

  const npsBadge = getNPSBadge(project.nps_score);

  // Generate talking points based on project data
  const getTalkingPoints = () => {
    const points: { type: 'warning' | 'success' | 'info' | 'action'; text: string }[] = [];
    
    // Health score issues
    if (project.health_score < 40) {
      points.push({ type: 'warning', text: `Health Score crítico (${project.health_score}). Investigar causas raiz e definir plano de ação imediato.` });
    } else if (project.health_score < 60) {
      points.push({ type: 'warning', text: `Health Score abaixo do ideal (${project.health_score}). Revisar métricas que estão impactando.` });
    }

    // Goal projection
    if (project.goal_projection !== undefined) {
      if (project.goal_projection < 50) {
        points.push({ type: 'warning', text: `Meta do mês em apenas ${project.goal_projection.toFixed(0)}%. Discutir estratégias de aceleração.` });
      } else if (project.goal_projection >= 100) {
        points.push({ type: 'success', text: `Meta atingida (${project.goal_projection.toFixed(0)}%)! Avaliar se há espaço para aumentar objetivos.` });
      }
    }

    // Meeting frequency
    if (project.days_since_meeting !== undefined) {
      if (project.days_since_meeting > 14) {
        points.push({ type: 'action', text: `Sem reunião há ${project.days_since_meeting} dias. Agendar follow-up urgente.` });
      } else if (project.days_since_meeting > 7) {
        points.push({ type: 'info', text: `Última reunião há ${project.days_since_meeting} dias. Considerar próximo contato.` });
      }
    }

    // Overdue tasks
    if (project.overdue_tasks > 3) {
      points.push({ type: 'warning', text: `${project.overdue_tasks} tarefas atrasadas. Priorizar resolução de blockers.` });
    } else if (project.overdue_tasks > 0) {
      points.push({ type: 'info', text: `${project.overdue_tasks} tarefa(s) atrasada(s). Verificar dependências.` });
    }

    // NPS
    if (project.nps_score !== undefined) {
      if (project.nps_score <= 6) {
        points.push({ type: 'warning', text: `NPS detrator (${project.nps_score}). Entender insatisfação e criar plano de recuperação.` });
      } else if (project.nps_score >= 9) {
        points.push({ type: 'success', text: `NPS promotor (${project.nps_score}). Oportunidade de case de sucesso ou indicação.` });
      }
    }

    // Renewal
    if (project.renewal_date) {
      const daysToRenewal = differenceInDays(new Date(project.renewal_date), new Date());
      if (daysToRenewal <= 30 && daysToRenewal > 0) {
        points.push({ type: 'action', text: `Renovação em ${daysToRenewal} dias. Iniciar conversas de renovação.` });
      } else if (daysToRenewal <= 60 && daysToRenewal > 30) {
        points.push({ type: 'info', text: `Renovação em ${daysToRenewal} dias. Preparar proposta de renovação.` });
      }
    }

    // Support tickets
    if (project.pending_support_tickets && project.pending_support_tickets > 0) {
      points.push({ type: 'warning', text: `${project.pending_support_tickets} ticket(s) de suporte aberto(s). Verificar status.` });
    }

    return points;
  };

  // Generate suggested questions for 1:1 - personalized based on project context
  const getSuggestedQuestions = () => {
    const companyName = project.company_name;

    const hashString = (value: string) => {
      // Simple deterministic hash (djb2)
      let hash = 5381;
      for (let i = 0; i < value.length; i++) {
        hash = (hash * 33) ^ value.charCodeAt(i);
      }
      return Math.abs(hash);
    };

    const pickUnique = (pool: string[], seed: string, count: number) => {
      const chosen: string[] = [];
      const used = new Set<number>();
      if (pool.length === 0) return chosen;

      let attempts = 0;
      while (chosen.length < Math.min(count, pool.length) && attempts < 50) {
        const idx = (hashString(`${seed}:${attempts}`) + hashString(project.id)) % pool.length;
        attempts++;
        if (used.has(idx)) continue;
        used.add(idx);
        chosen.push(pool[idx]);
      }

      return chosen;
    };

    // KPIs context (pick the worst KPI if available)
    const kpis = project.kpis ?? [];
    const worstKpi = [...kpis].sort((a, b) => a.percentage - b.percentage)[0];

    const questions: string[] = [];

    // --- Category pools (varied phrasings) ---

    // Health / risk
    const healthCritical = [
      `Qual foi o evento gatilho que derrubou a saúde de ${companyName}?`,
      `Se você tivesse que apontar 1 causa raiz do risco de ${companyName}, qual seria?`,
      `Quais sinais de churn você está percebendo em ${companyName} esta semana?`,
      `Qual é o plano de recuperação (3 ações) para estabilizar ${companyName} nos próximos 7 dias?`,
      `O que está mais comprometendo a entrega de valor percebida por ${companyName}?`,
    ];

    const healthMedium = [
      `Qual é o gargalo que mais está travando a evolução de ${companyName}?`,
      `Qual mudança de comportamento do cliente faria ${companyName} melhorar de patamar?`,
      `O que você precisa de mim (ou do time) para destravar ${companyName}?`,
      `Qual é a próxima decisão estratégica que precisamos induzir em ${companyName}?`,
    ];

    // Goals / KPIs
    const goalsLow = [
      `O que explica o baixo atingimento de metas em ${companyName}: volume, conversão ou ticket?`,
      `Qual etapa do funil de ${companyName} está mais fraca hoje?`,
      `O que o cliente precisa fazer (ação concreta) para melhorar o resultado ainda este mês?`,
      `Quais 2 iniciativas você priorizaria para acelerar a meta de ${companyName}?`,
    ];

    const goalsHigh = [
      `${companyName} está performando bem — qual foi o driver principal desse resultado?`,
      `O que podemos padronizar do que funcionou em ${companyName} para replicar em outros clientes?`,
      `Existe espaço para elevar a meta do próximo ciclo mantendo execução saudável?`,
    ];

    // Meetings / responsiveness
    const meetingStale = [
      `${companyName} está há alguns dias sem reunião — é problema de agenda, prioridade do cliente ou fricção?`,
      `Quem é o verdadeiro decisor em ${companyName} e ele está participando?`,
      `Qual é o próximo contato que você vai fazer (quando e por qual canal) com ${companyName}?`,
    ];

    // Tasks / execution
    const execution = [
      `O que está impedindo a execução das tarefas em ${companyName}: dependência do cliente, do time ou falta de clareza?`,
      `Qual tarefa atrasada em ${companyName} destrava mais resultado se for concluída primeiro?`,
      `O cliente entende o “porquê” das tarefas ou estamos só pedindo execução sem contexto?`,
    ];

    // NPS / feedback
    const npsDetractor = [
      `${companyName} deu NPS baixo — o motivo foi entrega, comunicação ou expectativa desalinhada?`,
      `Qual conversa difícil precisa acontecer com ${companyName} para reverter a percepção?`,
      `Qual ação de recuperação você vai executar nas próximas 48h para ${companyName}?`,
    ];

    const expansion = [
      `Qual oportunidade de expansão (upsell/cross-sell) faz sentido para ${companyName} agora?`,
      `Quem mais dentro de ${companyName} deveríamos influenciar para ampliar impacto?`,
      `Qual resultado rápido (quick win) pode virar case em ${companyName}?`,
    ];

    // --- Build based on real signals ---

    // 1) Health score bucket
    if (project.health_score < 40) {
      questions.push(...pickUnique(healthCritical, "health_critical", 2));
    } else if (project.health_score < 60) {
      questions.push(...pickUnique(healthMedium, "health_medium", 1));
    }

    // 2) Goal projection or KPI performance
    const goalPct = project.goal_projection;
    const worstKpiPct = worstKpi?.percentage;

    const hasWeakKpi = typeof worstKpiPct === "number" && worstKpiPct > 0 && worstKpiPct < 80;

    if ((typeof goalPct === "number" && goalPct < 80) || hasWeakKpi) {
      const base = pickUnique(goalsLow, `goals_low:${goalPct ?? "na"}:${worstKpi?.name ?? "none"}`, 1);
      questions.push(...base);

      if (worstKpi && worstKpi.percentage < 80) {
        questions.push(
          `O KPI “${worstKpi.name}” está em ${worstKpi.percentage.toFixed(0)}%. Qual é a causa e qual ação você vai priorizar?`
        );
      }
    } else if (typeof goalPct === "number" && goalPct >= 100) {
      questions.push(...pickUnique(goalsHigh, "goals_high", 1));
    }

    // 3) Meeting cadence
    if (typeof project.days_since_meeting === "number" && project.days_since_meeting > 7) {
      questions.push(...pickUnique(meetingStale, `meeting:${project.days_since_meeting}`, 1));
    }

    // 4) Overdue tasks
    if (project.overdue_tasks > 0) {
      questions.push(...pickUnique(execution, `tasks:${project.overdue_tasks}`, 1));
    }

    // 5) NPS and feedback
    if (typeof project.nps_score === "number" && project.nps_score <= 6) {
      questions.push(...pickUnique(npsDetractor, `nps:${project.nps_score}`, 1));
    }

    if (project.last_nps_feedback) {
      const feedback = project.last_nps_feedback.trim();
      if (feedback.length > 0) {
        const snippet = feedback.length > 80 ? `${feedback.slice(0, 80)}…` : feedback;
        questions.push(`No NPS, ${companyName} disse: “${snippet}”. O que já foi endereçado e o que falta?`);
      }
    }

    // 6) Healthy fallback
    if (questions.length < 3) {
      questions.push(...pickUnique(expansion, "expansion", 3));
    }

    // Final: unique + deterministic shuffle + return top 3
    const unique = Array.from(new Set(questions));
    const seed = `${project.id}:${project.health_score}:${project.overdue_tasks}:${project.nps_score ?? "na"}`;

    unique.sort((a, b) => (hashString(`${seed}:${a}`) % 1000) - (hashString(`${seed}:${b}`) % 1000));

    return unique.slice(0, 3);
  };

  const talkingPoints = getTalkingPoints();
  const suggestedQuestions = getSuggestedQuestions();

  const getPointIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />;
      case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
      case 'action': return <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
      default: return <Flag className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 shrink-0" />;
    }
  };

  const getPointBg = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800';
      case 'success': return 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800';
      case 'action': return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800';
      default: return 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`relative overflow-hidden border-2 ${getHealthBg(project.health_score)} backdrop-blur-xl hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 group`}>
        {/* Animated gradient accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${getHealthColor(project.health_score)}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
        
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${getHealthColor(project.health_score)} shadow-lg shadow-primary/20`}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {project.company_name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs font-medium ${getHealthBg(project.health_score)}`}>
                    {project.risk_level === 'critical' ? '🔴 Crítico' : 
                     project.risk_level === 'high' ? '🟠 Alto' : 
                     project.risk_level === 'medium' ? '🟡 Médio' : '🟢 Baixo'}
                  </Badge>
                  {project.segment && (
                    <Badge variant="secondary" className="text-xs">
                      {project.segment}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Health Score Circle - Enhanced */}
            <div className="relative">
              <div className={`absolute inset-0 blur-xl opacity-50 bg-gradient-to-br ${getHealthColor(project.health_score)}`} />
              <svg className="w-16 h-16 -rotate-90 relative">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-muted/20"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="url(#healthGradient)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(project.health_score / 100) * 163.4} 163.4`}
                />
                <defs>
                  <linearGradient id={`healthGradient-${project.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={project.health_score >= 70 ? "#10b981" : project.health_score >= 40 ? "#f59e0b" : "#ef4444"} />
                    <stop offset="100%" stopColor={project.health_score >= 70 ? "#34d399" : project.health_score >= 40 ? "#fbbf24" : "#f87171"} />
                  </linearGradient>
                </defs>
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${getHealthTextColor(project.health_score)}`}>
                {project.health_score}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-5 gap-2">
            {/* Goal Projection */}
            <div className="p-3 rounded-lg bg-muted border">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-xl font-bold ${(project.goal_projection || 0) >= 100 ? 'text-green-600 dark:text-green-400' : (project.goal_projection || 0) >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {project.goal_projection?.toFixed(0) || 0}%
                </span>
                {(project.goal_projection || 0) >= 100 ? 
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" /> : 
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                }
              </div>
            </div>

            {/* Last Meeting */}
            <div className="p-3 rounded-lg bg-muted border">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reunião</span>
              </div>
              <p className={`text-sm font-bold ${(project.days_since_meeting || 0) > 14 ? 'text-yellow-600 dark:text-yellow-400' : (project.days_since_meeting || 0) > 7 ? 'text-foreground' : 'text-green-600 dark:text-green-400'}`}>
                {project.days_since_meeting !== undefined ? 
                  (project.days_since_meeting === 0 ? 'Hoje' : 
                   project.days_since_meeting === 1 ? 'Ontem' : 
                   `${project.days_since_meeting}d`) : 
                  'N/A'}
              </p>
            </div>

            {/* Overdue Tasks */}
            <div className="p-3 rounded-lg bg-muted border">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Atrasadas</span>
              </div>
              <p className={`text-xl font-bold ${project.overdue_tasks > 3 ? 'text-red-600 dark:text-red-400' : project.overdue_tasks > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                {project.overdue_tasks}
              </p>
            </div>

            {/* NPS */}
            <div className="p-3 rounded-lg bg-muted border">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">NPS</span>
              </div>
              {npsBadge ? (
                <div className="flex items-center gap-1">
                  <span className={`text-xl font-bold ${project.nps_score! >= 9 ? 'text-green-600 dark:text-green-400' : project.nps_score! >= 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {project.nps_score}
                  </span>
                  <span className={`text-[10px] ${npsBadge.className} px-1.5 py-0.5 rounded border`}>
                    {npsBadge.label}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">N/A</span>
              )}
            </div>

            {/* Last Sales Entry */}
            <div className="p-3 rounded-lg bg-muted border">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Últ. Venda</span>
              </div>
              {project.lastSalesEntryDate ? (
                <p className="text-sm font-bold text-foreground">
                  {format(parseDateLocal(project.lastSalesEntryDate), "dd/MM", { locale: ptBR })}
                </p>
              ) : (
                <span className="text-sm text-muted-foreground">N/A</span>
              )}
            </div>
          </div>

          {expanded && (
            <>
              <Separator className="bg-border" />

              {/* Talking Points */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <h5 className="text-sm font-semibold text-foreground">Pontos para Discussão</h5>
                </div>
                <div className="space-y-2">
                  {talkingPoints.length > 0 ? (
                    talkingPoints.slice(0, 4).map((point, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border ${getPointBg(point.type)}`}
                      >
                        {getPointIcon(point.type)}
                        <p className="text-xs text-foreground leading-relaxed">{point.text}</p>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <p className="text-xs text-green-700 dark:text-green-300">Cliente saudável, sem pontos críticos para discussão.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Questions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h5 className="text-sm font-semibold text-foreground">Perguntas Sugeridas</h5>
                </div>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((question, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors border border-blue-200 dark:border-blue-800"
                    >
                      <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      <p className="text-xs text-foreground">{question}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Metrics Section - Health Score + KPIs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <h5 className="text-sm font-semibold text-foreground">Métricas & Saúde</h5>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Health Score Card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`p-2.5 rounded-lg border ${getHealthBg(project.health_score)}`}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      Health Score
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold ${
                        project.health_score >= 70 ? 'text-green-600 dark:text-green-400' :
                        project.health_score >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {project.health_score}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/ 100</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          project.health_score >= 70 ? 'bg-green-500' : 
                          project.health_score >= 40 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${project.health_score}%` }}
                      />
                    </div>
                  </motion.div>

                  {/* KPI Cards */}
                  {project.kpis && project.kpis.slice(0, 3).map((kpi, i) => {
                    const hasTarget = kpi.target > 0;
                    const getKPIColor = (pct: number, hasTarget: boolean) => {
                      if (!hasTarget) return 'text-blue-600 dark:text-blue-400';
                      if (pct >= 100) return 'text-green-600 dark:text-green-400';
                      if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400';
                      return 'text-red-600 dark:text-red-400';
                    };
                    const getKPIBg = (pct: number, hasTarget: boolean) => {
                      if (!hasTarget) return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800';
                      if (pct >= 100) return 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800';
                      if (pct >= 70) return 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800';
                      return 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800';
                    };
                    const formatValue = (val: number, type: string) => {
                      if (type === 'monetary') {
                        return val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val.toFixed(0)}`;
                      }
                      return val.toFixed(0);
                    };

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        className={`p-2.5 rounded-lg border ${getKPIBg(kpi.percentage, hasTarget)}`}
                      >
                        <p className="text-[10px] font-medium text-muted-foreground truncate mb-1">
                          {kpi.name}
                        </p>
                        <div className="flex items-baseline gap-1">
                          {hasTarget ? (
                            <>
                              <span className={`text-lg font-bold ${getKPIColor(kpi.percentage, hasTarget)}`}>
                                {kpi.percentage.toFixed(0)}%
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({formatValue(kpi.result, kpi.kpiType)}/{formatValue(kpi.target, kpi.kpiType)})
                              </span>
                            </>
                          ) : (
                            <span className={`text-lg font-bold ${getKPIColor(kpi.percentage, hasTarget)}`}>
                              {formatValue(kpi.result, kpi.kpiType)}
                            </span>
                          )}
                        </div>
                        {hasTarget && (
                          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${kpi.percentage >= 100 ? 'bg-green-500' : kpi.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(kpi.percentage, 100)}%` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  
                  {/* Empty state if no KPIs */}
                  {(!project.kpis || project.kpis.length === 0) && (
                    <div className="p-2.5 rounded-lg bg-muted border text-center">
                      <p className="text-xs text-muted-foreground">Sem KPIs</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Meeting History Section */}
              {project.meetingHistory && project.meetingHistory.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <h5 className="text-sm font-semibold text-foreground">Histórico de Reuniões</h5>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {project.meetingHistory.reduce((acc, m) => acc + m.meetings.length, 0)} reuniões
                    </Badge>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {project.meetingHistory.map((monthData) => (
                      <div key={monthData.month} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground capitalize">
                            {monthData.monthLabel}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {monthData.meetings.length} {monthData.meetings.length === 1 ? 'reunião' : 'reuniões'}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {monthData.meetings.map((meeting) => (
                            <motion.div
                              key={meeting.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-2 p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 ${onMeetingClick ? 'cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-950/50 transition-colors' : ''}`}
                              onClick={() => onMeetingClick?.(meeting.id, project.id)}
                            >
                              <Calendar className="h-3 w-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground truncate" title={meeting.title}>
                                  {meeting.title || "Reunião sem título"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(parseDateLocal(meeting.date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Sections */}
              {((project.upcomingTasks && project.upcomingTasks.length > 0) || 
                (project.completedTasks && project.completedTasks.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upcoming Tasks */}
                  {project.upcomingTasks && project.upcomingTasks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <h5 className="text-sm font-semibold text-foreground">Próximas Tarefas</h5>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {project.upcomingTasks.length}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {project.upcomingTasks.map((task, i) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className={`flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 ${onTaskClick ? 'cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors' : ''}`}
                            onClick={() => onTaskClick?.(task.id, project.id)}
                          >
                            <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate" title={task.title}>
                                {task.title}
                              </p>
                              {task.due_date && (
                                <p className="text-[10px] text-muted-foreground">
                                  Vence: {format(parseDateLocal(task.due_date), "dd/MM", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Tasks */}
                  {project.completedTasks && project.completedTasks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <h5 className="text-sm font-semibold text-foreground">Últimas Concluídas</h5>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {project.completedTasks.length}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {project.completedTasks.map((task, i) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className={`flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 ${onTaskClick ? 'cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors' : ''}`}
                            onClick={() => onTaskClick?.(task.id, project.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate" title={task.title}>
                                {task.title}
                              </p>
                              {task.completed_at && (
                                <p className="text-[10px] text-muted-foreground">
                                  Concluída: {format(parseDateLocal(task.completed_at), "dd/MM", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Insight */}
              {project.ai_insight && (
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Insight da IA</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {project.ai_insight}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onCreateInternalTask && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateInternalTask(project.id, project.company_name);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Tarefa Interna
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={onCreateInternalTask ? "flex-1" : "w-full"}
              onClick={() => window.open(`/onboarding-tasks/${project.id}`, '_blank')}
            >
              Ver Projeto
              <ExternalLink className="h-3.5 w-3.5 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
