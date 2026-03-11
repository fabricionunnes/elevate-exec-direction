import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { InstagramContentSuggestion } from "../types";

interface InstagramSuggestionsProps {
  accountId: string;
  projectId: string;
}

export const InstagramSuggestions = ({ accountId, projectId }: InstagramSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<InstagramContentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSuggestions = async () => {
    const { data } = await supabase
      .from("instagram_content_suggestions")
      .select("*")
      .eq("account_id", accountId)
      .order("generated_at", { ascending: false })
      .limit(20);
    setSuggestions((data || []) as InstagramContentSuggestion[]);
    setLoading(false);
  };

  useEffect(() => { fetchSuggestions(); }, [accountId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: { action: "generate_suggestions", accountId, projectId },
      });
      if (error) throw error;
      toast.success("Sugestões geradas!");
      fetchSuggestions();
    } catch {
      toast.error("Erro ao gerar sugestões");
    } finally {
      setGenerating(false);
    }
  };

  const markUsed = async (id: string) => {
    await supabase.from("instagram_content_suggestions").update({ is_used: true }).eq("id", id);
    fetchSuggestions();
  };

  const typeColors: Record<string, string> = {
    educativo: "bg-blue-100 text-blue-800",
    autoridade: "bg-purple-100 text-purple-800",
    prova_social: "bg-green-100 text-green-800",
    viral: "bg-pink-100 text-pink-800",
    conversao: "bg-orange-100 text-orange-800",
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Sugestões de Conteúdo
        </h3>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Sugestões
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma sugestão gerada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {suggestions.map((s) => (
            <Card key={s.id} className={s.is_used ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {s.theme}
                  <Badge className={typeColors[s.suggestion_type] || "bg-muted text-muted-foreground"} variant="secondary">
                    {s.suggestion_type}
                  </Badge>
                  {s.is_used && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.format && <p className="text-xs"><strong>Formato:</strong> {s.format}</p>}
                {s.objective && <p className="text-xs"><strong>Objetivo:</strong> {s.objective}</p>}
                {s.cta && <p className="text-xs"><strong>CTA:</strong> {s.cta}</p>}
                {s.visual_style && <p className="text-xs"><strong>Visual:</strong> {s.visual_style}</p>}
                {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                {!s.is_used && (
                  <Button variant="outline" size="sm" onClick={() => markUsed(s.id)} className="mt-2">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar como Usado
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
