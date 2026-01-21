import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  ArrowRightLeft,
  BarChart3,
  Settings,
  Lock,
  Users,
  ClipboardList,
} from "lucide-react";
import { useClientInventoryPermissions } from "./useClientInventoryPermissions";
import { ClientInventoryDashboard } from "./ClientInventoryDashboard";
import { ClientInventoryProductsPanel } from "./ClientInventoryProductsPanel";
import { ClientInventoryPurchasesPanel } from "./ClientInventoryPurchasesPanel";
import { ClientInventorySuppliersPanel } from "./ClientInventorySuppliersPanel";
import { ClientInventoryBudgetsPanel } from "./ClientInventoryBudgetsPanel";
import { ClientInventoryMovementsPanel } from "./ClientInventoryMovementsPanel";
import { ClientInventoryReportsPanel } from "./ClientInventoryReportsPanel";
import { ClientInventorySettingsPanel } from "./ClientInventorySettingsPanel";
import { ClientCustomersPanel } from "./ClientCustomersPanel";
import { ClientSaleBudgetsPanel } from "./ClientSaleBudgetsPanel";
import type { InventoryViewType } from "./types";

interface Props {
  projectId: string;
  userRole?: string;
}

export function ClientInventoryModule({ projectId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<InventoryViewType>("dashboard");
  const { canEdit, isReadOnly } = useClientInventoryPermissions(userRole);

  const tabs = [
    { id: "dashboard" as InventoryViewType, label: "Visão Geral", icon: LayoutDashboard },
    { id: "products" as InventoryViewType, label: "Produtos", icon: Package },
    { id: "customers" as InventoryViewType, label: "Clientes", icon: Users },
    { id: "purchases" as InventoryViewType, label: "Compras", icon: ShoppingCart },
    { id: "suppliers" as InventoryViewType, label: "Fornecedores", icon: Truck },
    { id: "budgets" as InventoryViewType, label: "Orç. Compras", icon: FileText },
    { id: "sale_budgets" as InventoryViewType, label: "Orç. Vendas", icon: ClipboardList },
    { id: "movements" as InventoryViewType, label: "Movimentações", icon: ArrowRightLeft },
    { id: "reports" as InventoryViewType, label: "Relatórios", icon: BarChart3 },
    { id: "settings" as InventoryViewType, label: "Configurações", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Lock className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Modo somente leitura - Apenas o cliente pode editar dados de estoque
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InventoryViewType)} className="space-y-4">
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
          <ClientInventoryDashboard projectId={projectId} />
        </TabsContent>

        <TabsContent value="products" className="mt-0">
          <ClientInventoryProductsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="customers" className="mt-0">
          <ClientCustomersPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-0">
          <ClientInventoryPurchasesPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0">
          <ClientInventorySuppliersPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="budgets" className="mt-0">
          <ClientInventoryBudgetsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="sale_budgets" className="mt-0">
          <ClientSaleBudgetsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="movements" className="mt-0">
          <ClientInventoryMovementsPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ClientInventoryReportsPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <ClientInventorySettingsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
