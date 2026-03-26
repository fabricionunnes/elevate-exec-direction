import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, RotateCw, Trash2 } from "lucide-react";
import type { B2BSearchHistoryItem } from "@/types/b2bProspection";

interface SearchHistoryProps {
  onRepeatSearch: (params: { niches: string[]; state?: string; city?: string }) => void;
}

export function SearchHistory({ onRepeatSearch }: SearchHistoryProps) {
  const [history, setHistory] = useState<B2BSearchHistoryItem[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("b2b_search_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as B2BSearchHistoryItem[]);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("b2b_search_history").delete().eq("id", id);
    setHistory(history.filter((h) => h.id !== id));
  };

  if (!history.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma busca realizada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((item) => (
        <Card key={item.id} className="hover:border-primary/30 transition-colors">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                {item.niches.map((n) => (
                  <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {item.city && `${item.city}, `}{item.state || "Brasil"} · {item.results_count} resultados · {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onRepeatSearch({
                  niches: item.niches,
                  state: item.state || undefined,
                  city: item.city || undefined,
                })}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
