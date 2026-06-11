import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Landmark,
  ReceiptText,
  Banknote,
  Users,
  HandCoins,
  BarChart3,
  ListPlus,
  Download,
  Lock,
} from "lucide-react";
import { useClientFinancialPermissions } from "../useClientFinancialPermissions";
import { CfinVisaoGeralPanel } from "./CfinVisaoGeralPanel";
import { CfinExtratosPanel } from "./CfinExtratosPanel";
import { CfinDespesasFixasPanel, CfinRetiradasPanel } from "./CfinDespesasRetiradasPanels";
import { CfinFolhaPanel } from "./CfinFolhaPanel";
import { CfinEmprestimosPanel } from "./CfinEmprestimosPanel";
import { CfinDrePanel } from "./CfinDrePanel";
import { CfinCadastrosPanel } from "./CfinCadastrosPanel";
import { CfinBackupPanel } from "./CfinBackupPanel";

type SistemaTab = "visao" | "extratos" | "despesas" | "retiradas" | "folha" | "emprestimos" | "dre" | "cadastros" | "backup";

interface Props {
  projectId: string;
  userRole?: string;
}

/**
 * Sistema Financeiro completo do cliente (migrado de planilha) — módulo independente,
 * separado do módulo financeiro padrão do Nexus.
 */
export function CfinSistemaModule({ projectId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<SistemaTab>("visao");
  const { canEdit, isReadOnly } = useClientFinancialPermissions(userRole);

  const tabs: { id: SistemaTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "visao", label: "Visão Geral", icon: LayoutDashboard },
    { id: "extratos", label: "Contas e Extratos", icon: Landmark },
    { id: "despesas", label: "Despesas Fixas", icon: ReceiptText },
    { id: "retiradas", label: "Retiradas", icon: Banknote },
    { id: "folha", label: "Folha de Pagamento", icon: Users },
    { id: "emprestimos", label: "Empréstimos", icon: HandCoins },
    { id: "dre", label: "Relatórios (DRE)", icon: BarChart3 },
    { id: "cadastros", label: "Cadastros", icon: ListPlus },
    { id: "backup", label: "Backup", icon: Download },
  ];

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Lock className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Modo somente leitura - Apenas o cliente pode editar os dados
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SistemaTab)} className="space-y-4">
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

        <TabsContent value="visao" className="mt-0">
          <CfinVisaoGeralPanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="extratos" className="mt-0">
          <CfinExtratosPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="despesas" className="mt-0">
          <CfinDespesasFixasPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="retiradas" className="mt-0">
          <CfinRetiradasPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="folha" className="mt-0">
          <CfinFolhaPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="emprestimos" className="mt-0">
          <CfinEmprestimosPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="dre" className="mt-0">
          <CfinDrePanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="cadastros" className="mt-0">
          <CfinCadastrosPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="backup" className="mt-0">
          <CfinBackupPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
