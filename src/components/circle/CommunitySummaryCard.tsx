import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sparkles, 
  Calendar, 
  Users, 
  MessageSquare, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CommunitySummaryCardProps {
  communityId: string;
  communityName: string;
}

export function CommunitySummaryCard({ communityId, communityName }: CommunitySummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Fetch latest summary
  const { data: summary, refetch, isLoading } = useQuery({
    queryKey: ["circle-community-summary", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_community_summaries")
        .select("*")
        .eq("community_id", communityId)
        .eq("is_active", true)
        .order("week_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });

  // Fetch top contributors profiles
  const { data: contributors } = useQuery({
    queryKey: ["circle-summary-contributors", summary?.top_contributors],
    queryFn: async () => {
      if (!summary?.top_contributors || summary.top_contributors.length === 0) return [];

      const { data, error } = await supabase
        .from("circle_profiles")
        .select("id, display_name, avatar_url")
        .in("id", summary.top_contributors);

      if (error) throw error;
      return data;
    },
    enabled: !!summary?.top_contributors && summary.top_contributors.length > 0,
  });

  // Generate new summary
  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      const weekEnd = new Date();
      const weekStart = subDays(weekEnd, 7);

      const { error } = await supabase.functions.invoke("circle-community-summary", {
        body: {
          communityId,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
        },
      });

      if (error) throw error;

      toast({ title: "Resumo gerado com sucesso!" });
      refetch();
    } catch (err) {
      console.error("Error generating summary:", err);
      toast({ title: "Erro ao gerar resumo", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Resumo da Semana
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={generateSummary}
              disabled={isGenerating}
            >
              <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {summary && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(summary.week_start), "dd MMM", { locale: ptBR })} -{" "}
            {format(new Date(summary.week_end), "dd MMM", { locale: ptBR })}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-2 space-y-4">
          {!summary ? (
            <div className="text-center py-6 space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum resumo disponível ainda
              </p>
              <Button size="sm" onClick={generateSummary} disabled={isGenerating}>
                {isGenerating ? "Gerando..." : "Gerar Resumo com IA"}
              </Button>
            </div>
          ) : (
            <>
              {/* Summary Text */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {summary.summary_content}
              </p>

              {/* Main Topics */}
              {summary.main_topics && summary.main_topics.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <MessageSquare className="h-3 w-3" />
                    Principais Temas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {summary.main_topics.map((topic, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {summary.insights && summary.insights.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Lightbulb className="h-3 w-3 text-yellow-500" />
                    Insights
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {summary.insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top Contributors */}
              {contributors && contributors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Users className="h-3 w-3" />
                    Top Contribuidores
                  </div>
                  <div className="flex -space-x-2">
                    {contributors.slice(0, 5).map((profile) => (
                      <Avatar key={profile.id} className="h-7 w-7 border-2 border-background">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {profile.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
