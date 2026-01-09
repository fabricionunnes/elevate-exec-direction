import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";

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

const ALLOWED_EMAIL = "fabricio@universidadevendas.com.br";

export default function FinancialModulePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/onboarding/login");
        return;
      }

      if (user.email === ALLOWED_EMAIL) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
        toast.error("Acesso negado. Este módulo é restrito.");
      }
    } catch (error) {
      console.error("Error checking access:", error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
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

  const tabs = [
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
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/onboarding/staff")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nexus
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Módulo Financeiro
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tabs Navigation - Scrollable on mobile */}
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex h-auto p-1 bg-muted/50">
              {tabs.map((tab) => {
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

          {/* Tab Contents */}
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
        </Tabs>
      </main>
    </div>
  );
}
