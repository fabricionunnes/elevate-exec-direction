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
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  };
  index: number;
  expanded?: boolean;
}

export function CompanyBriefingCard({ project, index, expanded = true }: CompanyBriefingCardProps) {
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
    const questions: string[] = [];
    const companyName = project.company_name;
    
    // Critical health score - prioritize understanding root cause
    if (project.health_score < 40) {
      questions.push(`O que está causando a queda drástica na saúde de ${companyName}?`);
      questions.push(`Você identificou algum problema grave que ainda não foi escalado?`);
      questions.push(`Qual é o nível de engajamento do decisor principal neste momento?`);
    } 
    // Medium health - focus on recovery
    else if (project.health_score < 60) {
      questions.push(`Quais são os principais blockers para melhorar a performance de ${companyName}?`);
      questions.push(`O cliente está receptivo às suas sugestões de mudança?`);
    }
    
    // Goal projection issues - dig into sales execution
    if (project.goal_projection !== undefined) {
      if (project.goal_projection < 50) {
        questions.push(`A meta de ${companyName} está em ${project.goal_projection.toFixed(0)}%. O time comercial está executando o processo?`);
        questions.push(`Existe algum problema de mercado ou sazonalidade afetando as vendas?`);
      } else if (project.goal_projection < 80) {
        questions.push(`O que falta para ${companyName} atingir a meta este mês?`);
        questions.push(`O funil de vendas está saudável ou há gargalos específicos?`);
      } else if (project.goal_projection >= 100) {
        questions.push(`${companyName} bateu a meta! Qual foi o diferencial este mês?`);
        questions.push(`Há espaço para aumentar as metas do próximo ciclo?`);
      }
    }
    
    // Meeting frequency issues - understand communication
    if (project.days_since_meeting !== undefined) {
      if (project.days_since_meeting > 14) {
        questions.push(`${companyName} está há ${project.days_since_meeting} dias sem reunião. O cliente está evitando contato?`);
        questions.push(`Existe algum conflito ou insatisfação não resolvida?`);
      } else if (project.days_since_meeting > 7) {
        questions.push(`A última reunião com ${companyName} foi há ${project.days_since_meeting} dias. Ficou algo pendente?`);
      }
    }

    // NPS specific questions
    if (project.nps_score !== undefined) {
      if (project.nps_score <= 6) {
        questions.push(`${companyName} deu NPS ${project.nps_score}. Qual foi o feedback específico do cliente?`);
        questions.push(`Já conversou com o cliente sobre o que podemos fazer diferente?`);
      } else if (project.nps_score >= 9) {
        questions.push(`${companyName} é promotor (NPS ${project.nps_score}). Podemos pedir um depoimento ou indicação?`);
      }
    }

    // Overdue tasks
    if (project.overdue_tasks > 5) {
      questions.push(`${companyName} tem ${project.overdue_tasks} tarefas atrasadas. O que está impedindo a execução?`);
    } else if (project.overdue_tasks > 0) {
      questions.push(`Como está a execução das ${project.overdue_tasks} tarefa(s) pendente(s)?`);
    }

    // Renewal proximity
    if (project.renewal_date) {
      const daysToRenewal = differenceInDays(new Date(project.renewal_date), new Date());
      if (daysToRenewal <= 30 && daysToRenewal > 0) {
        questions.push(`A renovação de ${companyName} é em ${daysToRenewal} dias. O cliente já sinalizou intenção de renovar?`);
      } else if (daysToRenewal <= 60 && daysToRenewal > 30) {
        questions.push(`Qual é a percepção de valor do cliente pensando na renovação?`);
      }
    }

    // Support tickets
    if (project.pending_support_tickets && project.pending_support_tickets > 2) {
      questions.push(`${companyName} tem ${project.pending_support_tickets} tickets abertos. São problemas recorrentes?`);
    }

    // Fallback for healthy projects
    if (questions.length === 0) {
      questions.push(`${companyName} está saudável. Quais são as próximas oportunidades de crescimento?`);
      questions.push(`Há algum upsell ou cross-sell que podemos explorar?`);
      questions.push(`O cliente mencionou alguma dor nova que podemos resolver?`);
    }

    // Return max 3 unique questions
    return [...new Set(questions)].slice(0, 3);
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
          <div className="grid grid-cols-4 gap-2">
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

          {/* Action Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
          >
            Ver Projeto Completo
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
