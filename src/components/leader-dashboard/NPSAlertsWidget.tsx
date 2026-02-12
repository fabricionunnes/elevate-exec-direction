import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ThumbsDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NPSAlert {
  id: string;
  score: number;
  respondent_name: string | null;
  respondent_email: string | null;
  feedback: string | null;
  what_can_improve: string | null;
  would_recommend_why: string | null;
  created_at: string;
  company_name: string | null;
}

export function NPSAlertsWidget({ daysBack = 90 }: { daysBack?: number }) {
  const [alerts, setAlerts] = useState<NPSAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNPSAlerts();
  }, [daysBack]);

  const fetchNPSAlerts = async () => {
    try {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const { data, error } = await supabase
        .from("onboarding_nps_responses")
        .select(`
          id, score, respondent_name, respondent_email, feedback,
          what_can_improve, would_recommend_why, created_at,
          project:onboarding_projects!inner(
            company:onboarding_companies(name)
          )
        `)
        .lt("score", 8)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: NPSAlert[] = (data || []).map((r: any) => ({
        id: r.id,
        score: r.score,
        respondent_name: r.respondent_name,
        respondent_email: r.respondent_email,
        feedback: r.feedback,
        what_can_improve: r.what_can_improve,
        would_recommend_why: r.would_recommend_why,
        created_at: r.created_at,
        company_name: r.project?.company?.name || null,
      }));

      setAlerts(mapped);
    } catch (err) {
      console.error("Error fetching NPS alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  const detractors = alerts.filter((a) => a.score <= 6);
  const neutrals = alerts.filter((a) => a.score === 7);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            NPS Críticos (Nota &lt; 8)
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive">{detractors.length} detratores</Badge>
            <Badge variant="outline" className="text-amber-600 border-amber-400">
              {neutrals.length} neutros
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma resposta NPS abaixo de 8 no período selecionado 🎉
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  a.score <= 6
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                    : "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {a.score <= 6 ? (
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Minus className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="font-semibold text-sm">
                      Nota {a.score}
                    </span>
                    <Badge
                      variant={a.score <= 6 ? "destructive" : "outline"}
                      className={a.score === 7 ? "text-amber-600 border-amber-400" : ""}
                    >
                      {a.score <= 6 ? "Detrator" : "Neutro"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {a.respondent_name && <span>👤 {a.respondent_name}</span>}
                  {a.company_name && <span>🏢 {a.company_name}</span>}
                  {a.respondent_email && <span>✉️ {a.respondent_email}</span>}
                </div>

                {/* Responses */}
                <div className="space-y-1.5 text-sm">
                  {a.would_recommend_why && (
                    <div>
                      <span className="font-medium text-muted-foreground">Por que essa nota: </span>
                      <span>{a.would_recommend_why}</span>
                    </div>
                  )}
                  {a.what_can_improve && (
                    <div>
                      <span className="font-medium text-muted-foreground">O que melhorar: </span>
                      <span>{a.what_can_improve}</span>
                    </div>
                  )}
                  {a.feedback && (
                    <div>
                      <span className="font-medium text-muted-foreground">Feedback: </span>
                      <span>{a.feedback}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
