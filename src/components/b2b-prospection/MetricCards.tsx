import { Card, CardContent } from "@/components/ui/card";
import { Users, Download, List, Search as SearchIcon } from "lucide-react";

interface MetricCardsProps {
  totalProspected: number;
  exportedThisMonth: number;
  savedLists: number;
  searchesToday: number;
}

export function MetricCards({ totalProspected, exportedThisMonth, savedLists, searchesToday }: MetricCardsProps) {
  const cards = [
    { label: "Total Prospectados", value: totalProspected, icon: Users, color: "text-blue-600" },
    { label: "Exportados (mês)", value: exportedThisMonth, icon: Download, color: "text-green-600" },
    { label: "Listas Salvas", value: savedLists, icon: List, color: "text-purple-600" },
    { label: "Buscas Hoje", value: searchesToday, icon: SearchIcon, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <card.icon className={`h-8 w-8 ${card.color} opacity-40`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
