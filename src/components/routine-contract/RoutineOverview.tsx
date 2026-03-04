import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, ClipboardList, CheckCircle2 } from "lucide-react";

interface Props {
  projectId: string;
}

export const RoutineOverview = ({ projectId }: Props) => {
  const { data: responses } = useQuery({
    queryKey: ["routine-responses-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("routine_form_responses")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      return count || 0;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["routine-contracts-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("routine_contracts")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      return count || 0;
    },
  });

  const { data: links } = useQuery({
    queryKey: ["routine-links-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("routine_form_links")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("is_active", true);
      return count || 0;
    },
  });

  const stats = [
    { label: "Links Ativos", value: links ?? 0, icon: ClipboardList, color: "text-blue-600" },
    { label: "Respostas Recebidas", value: responses ?? 0, icon: Users, color: "text-amber-600" },
    { label: "Contratos Gerados", value: contracts ?? 0, icon: FileText, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Como funciona</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3 items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <p><strong>Configure o formulário</strong> — Crie um link público para enviar aos colaboradores</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <p><strong>Receba as respostas</strong> — Os colaboradores preenchem descrevendo sua rotina</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <p><strong>Ajuste com IA</strong> — A IA organiza a rotina de forma estruturada</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <p><strong>Gere o contrato</strong> — Exporte um PDF institucional profissional</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
