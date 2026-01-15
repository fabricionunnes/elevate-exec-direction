import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowRight, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface CriticalProject {
  id: string;
  companyName: string;
  score: number;
  riskLevel: string;
  mainRiskFactor?: string;
  churnProbability?: number;
}

interface CriticalAlertsPanelProps {
  projects: CriticalProject[];
  maxItems?: number;
}

export function CriticalAlertsPanel({ projects, maxItems = 5 }: CriticalAlertsPanelProps) {
  const navigate = useNavigate();
  
  const displayedProjects = projects.slice(0, maxItems);

  const getRiskBadge = (riskLevel: string, score: number) => {
    if (riskLevel === "critical" || score < 40) {
      return (
        <Badge className="bg-gradient-to-r from-rose-500 to-rose-600 text-white border-0 shadow-sm shadow-rose-500/30">
          Crítico
        </Badge>
      );
    }
    if (riskLevel === "high" || score < 60) {
      return (
        <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 shadow-sm shadow-orange-500/30">
          Alto Risco
        </Badge>
      );
    }
    return (
      <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-sm shadow-amber-500/30">
        Atenção
      </Badge>
    );
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-rose-500/5">
      {/* Background decorations */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-rose-500/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-orange-500/5 to-transparent rounded-full blur-2xl" />
      
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="text-lg flex items-center gap-2">
          <motion.div 
            className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/10"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </motion.div>
          <span className="bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent font-bold">
            Alertas Críticos ({projects.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        {displayedProjects.length === 0 ? (
          <motion.div 
            className="text-center py-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-medium text-foreground">Nenhum projeto em situação crítica</p>
            <p className="text-sm text-muted-foreground mt-1">Excelente! Seu portfólio está saudável.</p>
          </motion.div>
        ) : (
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-2">
              {displayedProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  className="group relative overflow-hidden p-3 rounded-xl cursor-pointer transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.05) 100%)"
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
                  whileHover={{ scale: 1.02, x: 4 }}
                >
                  {/* Glassmorphism overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 border border-rose-200/30 rounded-xl" />
                  
                  <div className="relative z-10 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">{project.companyName}</span>
                        {getRiskBadge(project.riskLevel, project.score)}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-rose-600">
                          <TrendingDown className="h-3.5 w-3.5" />
                          <span className="font-medium">Score: {project.score.toFixed(0)}</span>
                        </span>
                        {project.churnProbability !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-xs font-medium">
                            {(project.churnProbability * 100).toFixed(0)}% prob. churn
                          </span>
                        )}
                      </div>
                      {project.mainRiskFactor && (
                        <p className="text-xs text-muted-foreground mt-1.5 truncate">
                          {project.mainRiskFactor}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="shrink-0 h-8 w-8 rounded-full bg-white/50 dark:bg-white/10 group-hover:bg-rose-500 group-hover:text-white transition-all"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {projects.length > maxItems && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Button
              variant="outline"
              className="w-full mt-3 bg-gradient-to-r from-rose-500/5 to-orange-500/5 border-rose-200/50 hover:border-rose-300 hover:bg-rose-500/10 transition-all"
              onClick={() => navigate("/onboarding-tasks/churn-prediction")}
            >
              Ver todos os {projects.length} alertas
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
