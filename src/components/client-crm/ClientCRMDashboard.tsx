import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Briefcase, Clock, CheckCircle } from "lucide-react";
import type { ClientDeal, ClientContact, ClientActivity, ClientStage } from "./hooks/useClientCRM";

interface Props {
  deals: ClientDeal[];
  contacts: ClientContact[];
  activities: ClientActivity[];
  stages: ClientStage[];
}

export const ClientCRMDashboard = ({ deals, contacts, activities, stages }: Props) => {
  const openDeals = deals.filter((d) => !d.closed_at);
  const wonDeals = deals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stage_id);
    return stage?.final_type === "won";
  });
  const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const pendingActivities = activities.filter((a) => a.status === "pending").length;
  const completedActivities = activities.filter((a) => a.status === "completed").length;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const stats = [
    { label: "Negócios Abertos", value: openDeals.length, icon: Briefcase, color: "text-blue-500" },
    { label: "Valor no Pipeline", value: formatCurrency(totalValue), icon: TrendingUp, color: "text-amber-500" },
    { label: "Negócios Ganhos", value: wonDeals.length, icon: CheckCircle, color: "text-green-500" },
    { label: "Valor Ganho", value: formatCurrency(wonValue), icon: BarChart3, color: "text-green-600" },
    { label: "Contatos", value: contacts.length, icon: Users, color: "text-violet-500" },
    { label: "Atividades Pendentes", value: pendingActivities, icon: Clock, color: "text-orange-500" },
  ];

  // Deals per stage for funnel
  const stageData = stages
    .filter((s) => !s.is_final)
    .map((stage) => ({
      name: stage.name,
      color: stage.color,
      count: deals.filter((d) => d.stage_id === stage.id).length,
      value: deals.filter((d) => d.stage_id === stage.id).reduce((sum, d) => sum + (d.value || 0), 0),
    }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stageData.map((stage, i) => {
                const maxCount = Math.max(...stageData.map((s) => s.count), 1);
                const width = Math.max((stage.count / maxCount) * 100, 8);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm w-28 text-muted-foreground truncate">{stage.name}</span>
                    <div className="flex-1">
                      <div
                        className="h-8 rounded-md flex items-center px-3 text-white text-xs font-medium"
                        style={{ width: `${width}%`, backgroundColor: stage.color }}
                      >
                        {stage.count} ({formatCurrency(stage.value)})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
