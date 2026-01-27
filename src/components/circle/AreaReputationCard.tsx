import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Users, 
  Megaphone, 
  Briefcase, 
  Code, 
  DollarSign, 
  Award,
  HeartHandshake 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AreaReputationCardProps {
  profileId: string;
  compact?: boolean;
}

const AREA_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  vendas: { icon: TrendingUp, label: "Vendas", color: "text-green-500" },
  gestao: { icon: Users, label: "Gestão", color: "text-blue-500" },
  marketing: { icon: Megaphone, label: "Marketing", color: "text-purple-500" },
  rh: { icon: HeartHandshake, label: "RH", color: "text-pink-500" },
  tech: { icon: Code, label: "Tech", color: "text-cyan-500" },
  financeiro: { icon: DollarSign, label: "Financeiro", color: "text-yellow-500" },
  lideranca: { icon: Award, label: "Liderança", color: "text-orange-500" },
  atendimento: { icon: Briefcase, label: "Atendimento", color: "text-indigo-500" },
};

const LEVEL_THRESHOLDS = [0, 50, 200, 500, 1000];

export function AreaReputationCard({ profileId, compact = false }: AreaReputationCardProps) {
  const { data: reputations, isLoading } = useQuery({
    queryKey: ["circle-area-reputation", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_area_reputation")
        .select("*")
        .eq("profile_id", profileId)
        .order("reputation_score", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reputations || reputations.length === 0) {
    if (compact) return null;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4" />
            Reputação por Área
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-muted-foreground text-center py-4">
            Participe de comunidades e publique conteúdos para construir sua reputação!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getProgressPercent = (score: number) => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_THRESHOLDS[i]) {
        const nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i] * 2;
        const currentThreshold = LEVEL_THRESHOLDS[i];
        return ((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
      }
    }
    return 0;
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {reputations.slice(0, 4).map((rep) => {
          const config = AREA_CONFIG[rep.area];
          if (!config) return null;
          const Icon = config.icon;

          return (
            <Badge key={rep.id} variant="secondary" className="gap-1">
              <Icon className={cn("h-3 w-3", config.color)} />
              {config.label}: {rep.level_name}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Award className="h-4 w-4" />
          Reputação por Área
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        {reputations.map((rep) => {
          const config = AREA_CONFIG[rep.area];
          if (!config) return null;
          const Icon = config.icon;

          return (
            <div key={rep.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Nível {rep.level} - {rep.level_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {rep.reputation_score} pts
                  </span>
                </div>
              </div>
              <Progress value={getProgressPercent(rep.reputation_score)} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
