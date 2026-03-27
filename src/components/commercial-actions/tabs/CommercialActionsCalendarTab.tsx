import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ACTION_STATUSES, MONTH_NAMES, COMMERCIAL_NICHES, type CommercialAction } from "../types";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";

interface Props {
  projectId: string;
  companySegment?: string | null;
  consultantStaffId?: string | null;
  staffList: { id: string; name: string; role: string }[];
}

export const CommercialActionsCalendarTab = ({ projectId, companySegment, consultantStaffId, staffList }: Props) => {
  const [actions, setActions] = useState<CommercialAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedNiche, setSelectedNiche] = useState(companySegment || "");

  useEffect(() => { fetchActions(); }, [projectId, selectedYear]);

  const fetchActions = async () => {
    const { data } = await supabase
      .from("commercial_actions")
      .select("*, responsible_staff:onboarding_staff!commercial_actions_responsible_staff_id_fkey(id, name, avatar_url)")
      .eq("project_id", projectId)
      .eq("year", selectedYear)
      .order("month").order("week").order("created_at");
    setActions((data as any[]) || []);
    setLoading(false);
  };

  const monthActions = useMemo(() => {
    return actions.filter(a => a.month === selectedMonth);
  }, [actions, selectedMonth]);

  const weekGroups = useMemo(() => {
    const groups: Record<number, CommercialAction[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    monthActions.forEach(a => {
      const w = a.week || 1;
      if (!groups[w]) groups[w] = [];
      groups[w].push(a);
    });
    return groups;
  }, [monthActions]);

  const getStatusBadge = (status: string) => {
    const s = ACTION_STATUSES.find(st => st.value === status);
    return <Badge className={`text-xs ${s?.color || ""}`}>{s?.label || status}</Badge>;
  };

  const handleGenerate = async () => {
    const niche = selectedNiche || companySegment;
    if (!niche) {
      toast.error("Selecione o nicho da empresa para gerar ações");
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke("generate-commercial-actions", {
        body: {
          project_id: projectId,
          niche,
          year: selectedYear,
          consultant_staff_id: consultantStaffId,
        },
      });

      if (response.error) throw response.error;

      toast.success(`Ações geradas com sucesso para ${niche}!`);
      fetchActions();
    } catch (error: any) {
      console.error("Error generating actions:", error);
      toast.error("Erro ao gerar ações: " + (error.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  const yearStats = useMemo(() => {
    const total = actions.length;
    const completed = actions.filter(a => a.status === "completed").length;
    const inProgress = actions.filter(a => a.status === "in_progress").length;
    return { total, completed, inProgress, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [actions]);

  return (
    <div className="space-y-4">
      {/* Year navigation and generate */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xl font-bold">{selectedYear}</span>
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>{yearStats.total} ações</span>
            <span>•</span>
            <span className="text-green-600">{yearStats.completed} concluídas</span>
            <span>•</span>
            <span>{yearStats.rate}% taxa</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!companySegment && (
            <Select value={selectedNiche || "none"} onValueChange={v => setSelectedNiche(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o nicho..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione o nicho</SelectItem>
                {COMMERCIAL_NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar Calendário com IA"}
          </Button>
        </div>
      </div>

      {/* Month selector - horizontal scrollable */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MONTH_NAMES.map((name, idx) => {
          const monthNum = idx + 1;
          const count = actions.filter(a => a.month === monthNum).length;
          return (
            <Button
              key={monthNum}
              variant={selectedMonth === monthNum ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonth(monthNum)}
              className="whitespace-nowrap relative"
            >
              {name.substring(0, 3)}
              {count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{count}</Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Calendar content - weeks */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : monthActions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma ação para {MONTH_NAMES[selectedMonth - 1]}</p>
          <p className="text-sm mt-1">Clique em "Gerar Calendário com IA" para criar ações automaticamente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(weekGroups).map(([week, weekActions]) => {
            if (weekActions.length === 0) return null;
            return (
              <Card key={week}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Semana {week}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {weekActions.map(action => (
                      <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{action.title}</span>
                            {getStatusBadge(action.status)}
                            <Badge variant="outline" className="text-xs">{action.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {action.responsible_staff && <span>{action.responsible_staff.name}</span>}
                            {action.goal && <span>Meta: {action.goal}</span>}
                            {action.result && <span className="text-green-600">Resultado: {action.result}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
