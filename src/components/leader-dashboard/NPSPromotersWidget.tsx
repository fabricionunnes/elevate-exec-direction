import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NPSPromoter {
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

export function NPSPromotersWidget({ daysBack = 30 }: { daysBack?: number }) {
  const [promoters, setPromoters] = useState<NPSPromoter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromoters();
  }, [daysBack]);

  const fetchPromoters = async () => {
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
        .gte("score", 8)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: NPSPromoter[] = (data || []).map((r: any) => ({
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

      setPromoters(mapped);
    } catch (err) {
      console.error("Error fetching NPS promoters:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  const score9and10 = promoters.filter((p) => p.score >= 9);
  const score8 = promoters.filter((p) => p.score === 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-green-500" />
            NPS Promotores (Nota ≥ 8)
          </div>
          <div className="flex gap-2">
            <Badge className="bg-green-500">{score9and10.length} promotores</Badge>
            <Badge variant="outline" className="text-green-600 border-green-400">
              {score8.length} nota 8
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {promoters.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma resposta NPS acima de 8 nos últimos {daysBack} dias
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {promoters.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  p.score >= 9
                    ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                    : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-800"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {p.score === 10 ? (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                    )}
                    <span className="font-semibold text-sm">
                      Nota {p.score}
                    </span>
                    <Badge className={p.score >= 9 ? "bg-green-500" : "bg-emerald-400"}>
                      {p.score >= 9 ? "Promotor" : "Satisfeito"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {p.respondent_name && <span>👤 {p.respondent_name}</span>}
                  {p.company_name && <span>🏢 {p.company_name}</span>}
                  {p.respondent_email && <span>✉️ {p.respondent_email}</span>}
                </div>

                {/* Responses */}
                <div className="space-y-1.5 text-sm">
                  {p.would_recommend_why && (
                    <div>
                      <span className="font-medium text-muted-foreground">Por que essa nota: </span>
                      <span>{p.would_recommend_why}</span>
                    </div>
                  )}
                  {p.feedback && (
                    <div>
                      <span className="font-medium text-muted-foreground">Feedback: </span>
                      <span>{p.feedback}</span>
                    </div>
                  )}
                  {p.what_can_improve && (
                    <div>
                      <span className="font-medium text-muted-foreground">Sugestão: </span>
                      <span>{p.what_can_improve}</span>
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
