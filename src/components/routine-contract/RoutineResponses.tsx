import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, Wand2, Users, Briefcase } from "lucide-react";
import { format } from "date-fns";

interface Props {
  projectId: string;
  isAdmin: boolean;
  onGenerateContract: (responseId: string) => void;
}

export const RoutineResponses = ({ projectId, isAdmin, onGenerateContract }: Props) => {
  const [search, setSearch] = useState("");
  const [viewingResponse, setViewingResponse] = useState<any | null>(null);

  const { data: responses, isLoading } = useQuery({
    queryKey: ["routine-responses", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_form_responses")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = responses?.filter((r) =>
    r.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.employee_role || "").toLowerCase().includes(search.toLowerCase())
  );

  // Agrupa por cargo, "Sem cargo" sempre por último
  const groups = (filtered || []).reduce<Record<string, typeof filtered>>((acc, r) => {
    const key = r.employee_role?.trim() || "Sem cargo";
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});
  const groupNames = Object.keys(groups).sort((a, b) => {
    if (a === "Sem cargo") return 1;
    if (b === "Sem cargo") return -1;
    return a.localeCompare(b, "pt-BR");
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline">{filtered?.length || 0} respostas</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !filtered?.length ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma resposta recebida ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupNames.map((groupName) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">{groupName}</h4>
                <Badge variant="secondary">{groups[groupName]!.length}</Badge>
              </div>
              <div className="grid gap-3">
                {groups[groupName]!.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium">{r.employee_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {r.employee_department || "Sem setor"} • {format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingResponse(r)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                          {isAdmin && (
                            <Button size="sm" onClick={() => onGenerateContract(r.id)}>
                              <Wand2 className="h-3.5 w-3.5 mr-1" />
                              Gerar Contrato
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Response Dialog */}
      <Dialog open={!!viewingResponse} onOpenChange={() => setViewingResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Respostas de {viewingResponse?.employee_name}</DialogTitle>
          </DialogHeader>
          {viewingResponse && (
            <div className="space-y-4 text-sm">
              {[
                { label: "Cargo", value: viewingResponse.employee_role },
                { label: "Setor", value: viewingResponse.employee_department },
                { label: "Tempo de empresa", value: viewingResponse.employee_tenure },
                { label: "Atividades diárias", value: viewingResponse.daily_activities },
                { label: "Atividades mais importantes", value: viewingResponse.most_important_activities },
                { label: "Tempo por atividade", value: viewingResponse.time_per_activity },
                { label: "Atividades semanais", value: viewingResponse.weekly_activities },
                { label: "Lista de atividades semanais", value: viewingResponse.weekly_activities_list },
                { label: "Contatos por dia", value: viewingResponse.daily_contacts },
                { label: "Reuniões por semana", value: viewingResponse.weekly_meetings },
                { label: "Vendas por mês", value: viewingResponse.monthly_sales },
                { label: "Responsabilidades", value: viewingResponse.main_responsibilities },
                { label: "Desafios", value: viewingResponse.main_challenges },
                { label: "Sugestões", value: viewingResponse.productivity_suggestions },
              ].map((item) => item.value ? (
                <div key={item.label}>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{item.value}</p>
                </div>
              ) : null)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
