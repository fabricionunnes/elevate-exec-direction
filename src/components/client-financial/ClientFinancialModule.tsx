import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  TrendingUp,
  FileText,
  Settings,
  Lock,
} from "lucide-react";
import { useClientFinancialPermissions } from "./useClientFinancialPermissions";
import { ClientFinancialDashboard } from "./ClientFinancialDashboard";
import { ClientReceivablesPanel } from "./ClientReceivablesPanel";
import { ClientPayablesPanel } from "./ClientPayablesPanel";
import { ClientRecurringPanel } from "./ClientRecurringPanel";
import { ClientCashFlowPanel } from "./ClientCashFlowPanel";
import { ClientFinancialReportsPanel } from "./ClientFinancialReportsPanel";
import { ClientFinancialSettingsPanel } from "./ClientFinancialSettingsPanel";
import type { FinancialViewType } from "./types";

interface Props {
  projectId: string;
  userRole?: string;
}

export function ClientFinancialModule({ projectId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<FinancialViewType>("dashboard");
  const { canEdit, isReadOnly } = useClientFinancialPermissions(userRole);

  const tabs = [
    { id: "dashboard" as FinancialViewType, label: "Visão Geral", icon: LayoutDashboard },
    { id: "receivables" as FinancialViewType, label: "A Receber", icon: ArrowDownCircle },
    { id: "payables" as FinancialViewType, label: "A Pagar", icon: ArrowUpCircle },
    { id: "recurring" as FinancialViewType, label: "Recorrências", icon: RefreshCw },
    { id: "cashflow" as FinancialViewType, label: "Fluxo de Caixa", icon: TrendingUp },
    { id: "reports" as FinancialViewType, label: "Relatórios", icon: FileText },
    { id: "settings" as FinancialViewType, label: "Configurações", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Lock className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Modo somente leitura - Apenas o cliente pode editar dados financeiros
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FinancialViewType)} className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          <ClientFinancialDashboard projectId={projectId} />
        </TabsContent>

        <TabsContent value="receivables" className="mt-0">
          <ClientReceivablesPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="payables" className="mt-0">
          <ClientPayablesPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-0">
          <ClientRecurringPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-0">
          <ClientCashFlowPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ClientFinancialReportsPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <ClientFinancialSettingsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
