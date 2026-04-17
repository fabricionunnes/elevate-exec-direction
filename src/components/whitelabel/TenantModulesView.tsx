import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, BarChart3, ListTodo, MessageSquare, Calendar,
  Search, GraduationCap, Share2, DollarSign, Building2, CheckCircle2, XCircle,
} from "lucide-react";

const MODULE_CATALOG: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { key: "onboarding", label: "Onboarding", description: "Empresas, projetos e jornada", icon: Building2 },
  { key: "crm", label: "CRM Comercial", description: "Funil, leads e atividades", icon: BarChart3 },
  { key: "tasks", label: "Tarefas", description: "Gestão de tarefas internas", icon: ListTodo },
  { key: "meetings", label: "Reuniões", description: "Agenda e atas", icon: Calendar },
  { key: "financial", label: "Financeiro", description: "Contas a pagar e receber", icon: DollarSign },
  { key: "kpis", label: "KPIs / Resultados", description: "Painéis de performance", icon: BarChart3 },
  { key: "whatsapp", label: "WhatsApp Hub", description: "Atendimento e instâncias", icon: MessageSquare },
  { key: "social", label: "Social / Posts", description: "Publicação em redes", icon: Share2 },
  { key: "academy", label: "Academy", description: "Trilhas e quizzes", icon: GraduationCap },
  { key: "hr", label: "Recursos Humanos", description: "Vagas e candidatos", icon: Users },
  { key: "b2b", label: "Prospecção B2B", description: "Captura via Google Places", icon: Search },
];

/**
 * Visão somente leitura dos módulos contratados pelo tenant white-label.
 * Para alterar é preciso falar com o time UNV (master).
 */
export function TenantModulesView() {
  const { tenant } = useTenant();
  const enabled = tenant?.enabled_modules || {};
  const enabledCount = MODULE_CATALOG.filter((m) => enabled[m.key]).length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Módulos Contratados</h3>
            <p className="text-sm text-muted-foreground">
              {enabledCount} de {MODULE_CATALOG.length} módulos habilitados no seu plano.
              Para alterar entre em contato com o suporte UNV.
            </p>
          </div>
          <Badge variant="secondary">{enabledCount}/{MODULE_CATALOG.length}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULE_CATALOG.map((m) => {
            const Icon = m.icon;
            const on = Boolean(enabled[m.key]);
            return (
              <div
                key={m.key}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  on ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20 opacity-70"
                }`}
              >
                <div
                  className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${
                    on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{m.label}</p>
                    {on ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
