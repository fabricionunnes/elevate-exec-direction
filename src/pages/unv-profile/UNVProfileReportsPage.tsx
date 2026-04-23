import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const REPORTS = [
  { title: "Recrutamento", desc: "Vagas, candidatos, tempo médio, taxa de conversão" },
  { title: "Turnover", desc: "Entradas, saídas, motivos e tendência" },
  { title: "Desempenho", desc: "Notas, ranking, evolução por área" },
  { title: "PDI", desc: "Status, conclusão, gaps de desenvolvimento" },
  { title: "Clima", desc: "eNPS, evolução, comentários por área" },
  { title: "Retenção", desc: "Tempo de casa, churn previsto" },
  { title: "Sucessão", desc: "Mapa de prontidão e gaps de liderança" },
];

export default function UNVProfileReportsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exporte relatórios estratégicos com filtros</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r, i) => (
          <Card key={i}>
            <CardHeader><CardTitle className="text-base">{r.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{r.desc}</p>
              <Button size="sm" variant="outline" className="w-full"><Download className="w-3 h-3 mr-2" />Exportar PDF/CSV</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
