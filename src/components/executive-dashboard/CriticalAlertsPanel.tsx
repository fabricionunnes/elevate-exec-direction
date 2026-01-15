import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowRight, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
      return <Badge variant="destructive">Crítico</Badge>;
    }
    if (riskLevel === "high" || score < 60) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Alto Risco</Badge>;
    }
    return <Badge variant="secondary">Atenção</Badge>;
  };

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          Alertas Críticos ({projects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayedProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum projeto em situação crítica</p>
            <p className="text-sm">Excelente! Seu portfólio está saudável.</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {displayedProjects.map((project) => (
                <div
                  key={project.id}
                  className="p-3 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{project.companyName}</span>
                        {getRiskBadge(project.riskLevel, project.score)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          Score: {project.score.toFixed(0)}
                        </span>
                        {project.churnProbability !== undefined && (
                          <span className="text-red-600">
                            {(project.churnProbability * 100).toFixed(0)}% prob. churn
                          </span>
                        )}
                      </div>
                      {project.mainRiskFactor && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {project.mainRiskFactor}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {projects.length > maxItems && (
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={() => navigate("/onboarding-tasks/churn-prediction")}
          >
            Ver todos os {projects.length} alertas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
