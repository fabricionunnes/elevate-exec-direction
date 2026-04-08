import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, Building2, AlertCircle, Pencil } from "lucide-react";
import type { DiagnosticRecord } from "./StrategicDiagnosticModule";

interface Props {
  records: DiagnosticRecord[];
  loading: boolean;
  onView: (record: DiagnosticRecord) => void;
  onEdit?: (record: DiagnosticRecord) => void;
}

const urgencyColors: Record<string, string> = {
  "Alta": "bg-red-100 text-red-700 border-red-200",
  "Média": "bg-amber-100 text-amber-700 border-amber-200",
  "Baixa": "bg-green-100 text-green-700 border-green-200",
};

export function StrategicDiagnosticHistory({ records, loading, onView }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg">Nenhum diagnóstico ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Diagnóstico" para criar o primeiro check-point estratégico.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {records.map(record => (
        <Card key={record.id} className="p-4 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onView(record)}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold truncate">{record.empresa}</span>
                {record.nivel_urgencia && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyColors[record.nivel_urgencia] || "bg-muted text-muted-foreground"}`}>
                    {record.nivel_urgencia}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(record.data_checkpoint), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                {record.consultor_unv && <span>Consultor: {record.consultor_unv}</span>}
                {record.proximo_passo && <span className="hidden md:inline">→ {record.proximo_passo}</span>}
              </div>
              {record.produtos_oferecer && record.produtos_oferecer.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {record.produtos_oferecer.map(p => (
                    <span key={p} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
