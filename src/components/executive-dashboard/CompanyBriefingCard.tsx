import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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
  };
  index: number;
}

export function CompanyBriefingCard({ project, index }: CompanyBriefingCardProps) {
  const navigate = useNavigate();

  const getHealthColor = (score: number) => {
    if (score >= 70) return "from-emerald-500 to-green-400";
    if (score >= 40) return "from-amber-500 to-yellow-400";
    return "from-red-500 to-rose-400";
  };

  const getHealthBg = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 40) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getNPSBadge = (score?: number) => {
    if (score === undefined || score === null) return null;
    if (score >= 9) return { label: "Promotor", variant: "default" as const, className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    if (score >= 7) return { label: "Neutro", variant: "secondary" as const, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    return { label: "Detrator", variant: "destructive" as const, className: "bg-red-500/20 text-red-400 border-red-500/30" };
  };

  const npsBadge = getNPSBadge(project.nps_score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`relative overflow-hidden border ${getHealthBg(project.health_score)} backdrop-blur-xl hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group`}>
        {/* Gradient accent */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getHealthColor(project.health_score)}`} />
        
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${getHealthColor(project.health_score)} shadow-lg`}>
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {project.company_name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${getHealthBg(project.health_score)}`}>
                    {project.risk_level === 'critical' ? 'Crítico' : 
                     project.risk_level === 'high' ? 'Alto' : 
                     project.risk_level === 'medium' ? 'Médio' : 'Baixo'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Health Score Circle */}
            <div className="relative">
              <svg className="w-14 h-14 -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="url(#healthGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(project.health_score / 100) * 150.8} 150.8`}
                />
                <defs>
                  <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={project.health_score >= 70 ? "#10b981" : project.health_score >= 40 ? "#f59e0b" : "#ef4444"} />
                    <stop offset="100%" stopColor={project.health_score >= 70 ? "#34d399" : project.health_score >= 40 ? "#fbbf24" : "#f87171"} />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {project.health_score}
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {/* Goal Projection */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground text-xs">Meta</span>
                <div className="flex items-center gap-1">
                  <span className={`font-medium ${(project.goal_projection || 0) >= 100 ? 'text-emerald-400' : (project.goal_projection || 0) >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                    {project.goal_projection?.toFixed(0) || 0}%
                  </span>
                  {(project.goal_projection || 0) >= 100 ? 
                    <TrendingUp className="h-3 w-3 text-emerald-400" /> : 
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  }
                </div>
              </div>
            </div>

            {/* Last Meeting */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground text-xs">Reunião</span>
                <p className={`font-medium text-xs ${(project.days_since_meeting || 0) > 14 ? 'text-amber-400' : 'text-foreground'}`}>
                  {project.days_since_meeting !== undefined ? 
                    (project.days_since_meeting === 0 ? 'Hoje' : 
                     project.days_since_meeting === 1 ? 'Ontem' : 
                     `${project.days_since_meeting}d atrás`) : 
                    'Sem registro'}
                </p>
              </div>
            </div>

            {/* Overdue Tasks */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              {project.overdue_tasks > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
              <div>
                <span className="text-muted-foreground text-xs">Atrasadas</span>
                <p className={`font-medium ${project.overdue_tasks > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {project.overdue_tasks} tarefa{project.overdue_tasks !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* NPS */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground text-xs">NPS</span>
                <div className="flex items-center gap-1">
                  {npsBadge ? (
                    <Badge variant={npsBadge.variant} className={`text-xs px-1.5 py-0 ${npsBadge.className}`}>
                      {project.nps_score} - {npsBadge.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI Insight */}
          {project.ai_insight && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {project.ai_insight}
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs hover:bg-primary/10"
            onClick={() => navigate(`/onboarding-tasks/project/${project.id}`)}
          >
            Ver Detalhes
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
