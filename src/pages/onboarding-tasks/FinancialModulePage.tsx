import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Users, 
  Building2, 
  CreditCard, 
  FileText, 
  Calculator, 
  Bot, 
  Link2,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Bell,
  Truck,
  MessageSquare,
  Headphones,
  FileCheck,
  Code2
} from "lucide-react";
import { useFinancialPermissions } from "@/hooks/useFinancialPermissions";

// Import financial components
import { FinancialOverview } from "@/components/financial/FinancialOverview";
import { ReceivablesPanel } from "@/components/financial/ReceivablesPanel";
import { PayablesPanel } from "@/components/financial/PayablesPanel";
import { ClientsContractsPanel } from "@/components/financial/ClientsContractsPanel";
import { BankAccountsPanel } from "@/components/financial/BankAccountsPanel";
import { BillingPaymentsPanel } from "@/components/financial/BillingPaymentsPanel";
import { FinancialReportsPanel } from "@/components/financial/FinancialReportsPanel";
import { FinancialPlanningPanel } from "@/components/financial/FinancialPlanningPanel";
import { CFOInsightsPanel } from "@/components/financial/CFOInsightsPanel";
import { IntegrationsPanel } from "@/components/financial/IntegrationsPanel";
import { BillingRulesPanel } from "@/components/financial/BillingRulesPanel";
import { SuppliersPanel } from "@/components/financial/SuppliersPanel";
import { WhatsAppInstancePanel } from "@/components/financial/WhatsAppInstancePanel";
import { FinancialInboxPanel } from "@/components/financial/FinancialInboxPanel";
import { BankStatementFullPanel } from "@/components/financial/BankStatementFullPanel";
import { NfsePanel } from "@/components/financial/NfsePanel";
import { GeneralStatementPanel } from "@/components/financial/GeneralStatementPanel";
import { FinancialApiDocs } from "@/components/financial-api/FinancialApiDocs";
import { SystemApiDocs } from "@/components/financial-api/SystemApiDocs";

// Map tab IDs to financial permission keys (null = always visible if user has financial access)
const TAB_PERMISSION_MAP: Record<string, string | null> = {
  overview: "fin_dashboard",
  receivables: "fin_receivables_view",
  payables: "fin_payables_view",
  clients: null, // always visible
  banks: "fin_banks",
  billing: null, // always visible
  reports: "fin_dre", // reports group
  planning: null, // always visible
  cfo: "fin_cfo_executive",
  integrations: null, // always visible
  "billing-rules": "fin_billing_rules",
  suppliers: null, // always visible
  inbox: "fin_inbox",
  "whatsapp-instance": "fin_whatsapp_instance",
  "bank-statement": "fin_bank_statement",
  "general-statement": null, // always visible
  "nfse": null, // always visible
  "api": "admin_master_only", // admin and master only
};

const ALL_TABS = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "receivables", label: "Contas a Receber", icon: ArrowDownCircle },
  { id: "payables", label: "Contas a Pagar", icon: ArrowUpCircle },
  { id: "clients", label: "Clientes & Contratos", icon: Users },
  { id: "banks", label: "Bancos & Saldos", icon: Building2 },
  { id: "billing", label: "Cobranças", icon: CreditCard },
  { id: "reports", label: "Relatórios", icon: FileText },
  { id: "planning", label: "Planejamento", icon: Calculator },
  { id: "cfo", label: "IA CFO", icon: Bot },
  { id: "integrations", label: "Integrações", icon: Link2 },
  { id: "billing-rules", label: "Régua de Cobranças", icon: Bell },
  { id: "suppliers", label: "Fornecedores", icon: Truck },
  { id: "inbox", label: "Atendimentos", icon: Headphones },
  { id: "whatsapp-instance", label: "Instância", icon: MessageSquare },
  { id: "bank-statement", label: "Extrato Bancário", icon: FileText },
  { id: "general-statement", label: "Extrato Geral", icon: FileText },
  { id: "nfse", label: "NFS-e", icon: FileCheck },
  { id: "api", label: "API", icon: Code2 },
];

export default function FinancialModulePage() {
  const navigate = useNavigate();
  const { loading, hasFinancialAccess, isMaster, hasFinancialPermission, userRole } = useFinancialPermissions();
  
  const visibleTabs = useMemo(() => {
    if (isMaster || (userRole === "admin")) {
      return ALL_TABS.filter(tab => {
        const permKey = TAB_PERMISSION_MAP[tab.id];
        if (permKey === "master_only") return isMaster;
        return true;
      });
    }
    return ALL_TABS.filter(tab => {
      const permKey = TAB_PERMISSION_MAP[tab.id];
      if (permKey === null) return true; // always visible
      if (permKey === "master_only") return false;
      if (permKey === "admin_master_only") return false;
      return hasFinancialPermission(permKey);
    });
  }, [isMaster, hasFinancialPermission]);

  const [activeTab, setActiveTab] = useState("");

  // Set default tab to first visible tab
  useEffect(() => {
    if (!loading && visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [loading, visibleTabs, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasFinancialAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este módulo.
          </p>
          <Button onClick={() => navigate("/onboarding/staff")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Nexus
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 pb-3 pt-[max(calc(env(safe-area-inset-top,0px)+0.75rem),2.75rem)] flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/onboarding/staff")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nexus
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="flex min-w-0 items-center gap-2 py-0.5 text-lg font-semibold leading-[1.35]">
              <Calculator className="h-5 w-5 shrink-0 text-primary" />
              Módulo Financeiro
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex h-auto p-1 bg-muted/50">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 px-4 py-2 whitespace-nowrap data-[state=active]:bg-background"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <FinancialOverview />
          </TabsContent>
          <TabsContent value="receivables" className="mt-0">
            <ReceivablesPanel />
          </TabsContent>
          <TabsContent value="payables" className="mt-0">
            <PayablesPanel />
          </TabsContent>
          <TabsContent value="clients" className="mt-0">
            <ClientsContractsPanel />
          </TabsContent>
          <TabsContent value="banks" className="mt-0">
            <BankAccountsPanel />
          </TabsContent>
          <TabsContent value="billing" className="mt-0">
            <BillingPaymentsPanel />
          </TabsContent>
          <TabsContent value="reports" className="mt-0">
            <FinancialReportsPanel />
          </TabsContent>
          <TabsContent value="planning" className="mt-0">
            <FinancialPlanningPanel />
          </TabsContent>
          <TabsContent value="cfo" className="mt-0">
            <CFOInsightsPanel />
          </TabsContent>
          <TabsContent value="integrations" className="mt-0">
            <IntegrationsPanel />
          </TabsContent>
          <TabsContent value="billing-rules" className="mt-0">
            <BillingRulesPanel />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-0">
            <SuppliersPanel />
          </TabsContent>
          <TabsContent value="inbox" className="mt-0">
            <FinancialInboxPanel />
          </TabsContent>
          <TabsContent value="whatsapp-instance" className="mt-0">
            <WhatsAppInstancePanel />
          </TabsContent>
          <TabsContent value="bank-statement" className="mt-0">
            <BankStatementFullPanel />
          </TabsContent>
          <TabsContent value="general-statement" className="mt-0">
            <GeneralStatementPanel />
          </TabsContent>
          <TabsContent value="nfse" className="mt-0">
            <NfsePanel />
          </TabsContent>
          <TabsContent value="api" className="mt-0">
            <div className="space-y-8">
              <FinancialApiDocs />
              <SystemApiDocs />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
