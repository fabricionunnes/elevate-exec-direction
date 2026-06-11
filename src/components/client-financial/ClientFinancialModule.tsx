import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Building2,
  Package,
  Landmark,
  Users,
  HandCoins,
  Download,
} from "lucide-react";
import { CfinExtratosPanel } from "./cfin/CfinExtratosPanel";
import { CfinFolhaPanel } from "./cfin/CfinFolhaPanel";
import { CfinEmprestimosPanel } from "./cfin/CfinEmprestimosPanel";
import { CfinBackupPanel } from "./cfin/CfinBackupPanel";
import { useClientFinancialPermissions } from "./useClientFinancialPermissions";
import { ClientFinancialDashboard } from "./ClientFinancialDashboard";
import { ClientReceivablesPanel } from "./ClientReceivablesPanel";
import { ClientPayablesPanel } from "./ClientPayablesPanel";
import { ClientRecurringPanel } from "./ClientRecurringPanel";
import { ClientCashFlowPanel } from "./ClientCashFlowPanel";
import { ClientFinancialReportsPanel } from "./ClientFinancialReportsPanel";
import { ClientFinancialSettingsPanel } from "./ClientFinancialSettingsPanel";
import { ClientBankAccountsPanel } from "./ClientBankAccountsPanel";
import { ClientProductsPanel } from "./ClientProductsPanel";
import type { FinancialViewType } from "./types";

interface Props {
  projectId: string;
  userRole?: string;
}

export function ClientFinancialModule({ projectId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<FinancialViewType>("dashboard");
  const { canEdit, isReadOnly } = useClientFinancialPermissions(userRole);
  // projetos com dados migrados de planilha (cfin_*) ganham abas extras
  const [temCfin, setTemCfin] = useState(false);

  useEffect(() => {
    supabase.from("cfin_contas_bancarias").select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .then(({ count }) => setTemCfin((count ?? 0) > 0));
  }, [projectId]);

  const cfinTabs = temCfin ? [
    { id: "cfin_extratos" as FinancialViewType, label: "Extratos", icon: Landmark },
    { id: "cfin_folha" as FinancialViewType, label: "Folha de Pagamento", icon: Users },
    { id: "cfin_emprestimos" as FinancialViewType, label: "Empréstimos", icon: HandCoins },
    { id: "cfin_backup" as FinancialViewType, label: "Backup", icon: Download },
  ] : [];

  const tabs = [
    { id: "dashboard" as FinancialViewType, label: "Visão Geral", icon: LayoutDashboard },
    { id: "receivables" as FinancialViewType, label: "A Receber", icon: ArrowDownCircle },
    { id: "payables" as FinancialViewType, label: "A Pagar", icon: ArrowUpCircle },
    { id: "banks" as FinancialViewType, label: "Bancos", icon: Building2 },
    { id: "recurring" as FinancialViewType, label: "Recorrências", icon: RefreshCw },
    { id: "cashflow" as FinancialViewType, label: "Fluxo de Caixa", icon: TrendingUp },
    { id: "products" as FinancialViewType, label: "Produtos", icon: Package },
    { id: "reports" as FinancialViewType, label: "Relatórios", icon: FileText },
    ...cfinTabs,
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

        <TabsContent value="banks" className="mt-0">
          <ClientBankAccountsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-0">
          <ClientRecurringPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-0">
          <ClientCashFlowPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="products" className="mt-0">
          <ClientProductsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ClientFinancialReportsPanel projectId={projectId} />
        </TabsContent>

        {temCfin && (
          <>
            <TabsContent value="cfin_extratos" className="mt-0">
              <CfinExtratosPanel projectId={projectId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="cfin_folha" className="mt-0">
              <CfinFolhaPanel projectId={projectId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="cfin_emprestimos" className="mt-0">
              <CfinEmprestimosPanel projectId={projectId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="cfin_backup" className="mt-0">
              <CfinBackupPanel projectId={projectId} />
            </TabsContent>
          </>
        )}

        <TabsContent value="settings" className="mt-0">
          <ClientFinancialSettingsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
