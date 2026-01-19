import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, Calendar, TrendingUp, TrendingDown, Minus, User, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NewCompanyCardProps {
  company: {
    id: string;
    company_name: string;
    consultant_name?: string;
    health_score: number;
    completed_tasks: number;
    total_tasks: number;
    last_meeting_date?: string | null;
    days_since_start: number;
  };
  index: number;
  onClick: () => void;
  onCreateInternalTask?: (projectId: string, companyName: string) => void;
}

export function NewCompanyCard({ company, index, onClick, onCreateInternalTask }: NewCompanyCardProps) {
  const progressPercent = company.total_tasks > 0 
    ? Math.round((company.completed_tasks / company.total_tasks) * 100) 
    : 0;
  const hasMeeting = !!company.last_meeting_date;

  // Health score status
  const getHealthStatus = (score: number) => {
    if (score >= 70) return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", icon: TrendingUp, label: "Saudável" };
    if (score >= 40) return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", icon: Minus, label: "Atenção" };
    return { color: "text-red-600 dark:text-red-400", bg: "bg-red-500", icon: TrendingDown, label: "Crítico" };
  };

  const healthStatus = getHealthStatus(company.health_score);
  const HealthIcon = healthStatus.icon;

  // Days badge color based on onboarding phase
  const getDaysBadgeStyle = (days: number) => {
    if (days <= 15) return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700";
    if (days <= 30) return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    if (days <= 60) return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700";
    return "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.03, duration: 0.3 }}
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-2xl cursor-pointer transition-all duration-300",
        "bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-800/80",
        "border border-slate-200/80 dark:border-slate-700/80",
        "hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5",
        "hover:border-blue-300 dark:hover:border-blue-600",
        "hover:-translate-y-1"
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-300" />
      
      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
            {company.company_name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1.5">
            <User className="h-3 w-3 text-muted-foreground/70" />
            <span className="text-xs text-muted-foreground truncate">
              {company.consultant_name || "N/A"}
            </span>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs font-semibold shrink-0 px-2.5 py-0.5",
            getDaysBadgeStyle(company.days_since_start)
          )}
        >
          {company.days_since_start}d
        </Badge>
      </div>
      
      {/* Health Score - Visual Indicator */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              company.health_score >= 70 ? "bg-emerald-100 dark:bg-emerald-900/40" :
              company.health_score >= 40 ? "bg-amber-100 dark:bg-amber-900/40" : 
              "bg-red-100 dark:bg-red-900/40"
            )}>
              <Activity className={cn("h-3.5 w-3.5", healthStatus.color)} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Saúde</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HealthIcon className={cn("h-3.5 w-3.5", healthStatus.color)} />
            <span className={cn("text-lg font-bold tabular-nums", healthStatus.color)}>
              {company.health_score}
            </span>
          </div>
        </div>
        {/* Health bar */}
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(company.health_score, 100)}%` }}
            transition={{ delay: 0.2 + index * 0.03, duration: 0.5, ease: "easeOut" }}
            className={cn("h-full rounded-full", healthStatus.bg)}
          />
        </div>
      </div>

      {/* Tasks Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Tarefas</span>
          </div>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {company.completed_tasks}/{company.total_tasks}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ delay: 0.3 + index * 0.03, duration: 0.5, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full transition-colors",
              progressPercent >= 70 ? "bg-blue-500" :
              progressPercent >= 30 ? "bg-blue-400" : "bg-red-400"
            )}
          />
        </div>
      </div>

      {/* Meeting Status */}
      <div className={cn(
        "flex items-center justify-between p-2.5 rounded-xl",
        hasMeeting 
          ? "bg-slate-50 dark:bg-slate-800/50" 
          : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-800/50"
      )}>
        <div className="flex items-center gap-2">
          <Calendar className={cn(
            "h-4 w-4",
            hasMeeting ? "text-slate-500 dark:text-slate-400" : "text-orange-500"
          )} />
          <span className={cn(
            "text-xs",
            hasMeeting ? "text-muted-foreground" : "text-orange-600 dark:text-orange-400 font-medium"
          )}>
            {hasMeeting 
              ? `Última: ${format(new Date(company.last_meeting_date!), "dd/MM", { locale: ptBR })}`
              : "Sem reunião"
            }
          </span>
        </div>
        {!hasMeeting && (
          <Badge 
            variant="outline" 
            className="text-[10px] bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 font-semibold"
          >
            Pendente
          </Badge>
        )}
      </div>

      {/* Create Internal Task Button */}
      {onCreateInternalTask && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={(e) => {
            e.stopPropagation();
            onCreateInternalTask(company.id, company.company_name);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Tarefa Interna
        </Button>
      )}
    </motion.div>
  );
}
