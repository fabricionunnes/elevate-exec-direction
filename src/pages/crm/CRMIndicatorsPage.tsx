import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SalesIndicatorsTab } from "@/components/crm/indicators/SalesIndicatorsTab";
import { PreSalesIndicatorsTab } from "@/components/crm/indicators/PreSalesIndicatorsTab";
import { FunnelsOverviewTab } from "@/components/crm/indicators/FunnelsOverviewTab";
import { CRMTrafficTab } from "@/components/crm/traffic/CRMTrafficTab";
import { LeadRevenueTab } from "@/components/crm/indicators/LeadRevenueTab";
import { AtendimentoDashboardTab } from "@/components/crm/indicators/AtendimentoDashboardTab";
import { AtividadesDashboardTab } from "@/components/crm/indicators/AtividadesDashboardTab";
import { NegociosDashboardTab } from "@/components/crm/indicators/NegociosDashboardTab";
import { VisaoGeralTab } from "@/components/crm/indicators/VisaoGeralTab";
import { CRMCommissionCard, CommissionSummary } from "@/components/crm/CRMCommissionCard";
import { DollarSign, ChevronDown, TrendingUp, Wallet, Megaphone, Filter, Banknote, MessageSquare, ListChecks, Briefcase, LayoutDashboard } from "lucide-react";

export const CRMIndicatorsPage = () => {
  const { staffRole, staffId } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
  const isMaster = staffRole === "master";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";
  // Closer: só a aba Comercial. SDR/pré-vendas: só a aba Pré vendas. Gestão: tudo.
  const isCloserUser = staffRole === "closer";
  const isSdrUser = staffRole === "sdr" || staffRole === "social_setter" || staffRole === "bdr";
  const showSales = !isSdrUser;      // comercial: todos menos SDR
  const showPresales = !isCloserUser; // pré-vendas: todos menos closer
  // Negócios, Atendimento e Atividades (benchmark Datacrazy): todo mundo vê; fora da gestão
  // o painel fica travado no próprio usuário (dono / atendente / responsável).
  const lockedStaffId = isAdmin ? null : staffId;
  // Visão geral (do digital) é a aba principal do CRM Comercial (Fabrício, 30/09/2026)
  const [activeTab, setActiveTab] = useState("visao");
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const showCommission = staffRole === "closer" || staffRole === "sdr" || staffRole === "head_comercial" || isMaster;

  return (
    <div className="flex flex-col h-full">
      {showCommission && (
        <div className="px-4 pt-4">
          <Collapsible open={commissionOpen} onOpenChange={setCommissionOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg shrink-0" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold">{isMaster ? "Remuneração da Equipe" : "Sua Remuneração"}</p>
                    {summary && !commissionOpen ? (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Wallet className="h-3 w-3" />
                          Total: <span className="font-semibold text-foreground">{formatCurrency(summary.total)}</span>
                        </span>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Meta: <span className="font-semibold text-foreground">{summary.achievedPercent}%</span>
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Toque para {commissionOpen ? "recolher" : "expandir"}</p>
                    )}
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ${commissionOpen ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <CRMCommissionCard staffId={staffId} staffRole={staffRole} isMaster={isMaster} onSummaryReady={setSummary} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border bg-card px-4">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger
              value="visao"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Visão geral
            </TabsTrigger>
            {showSales && (
              <TabsTrigger
                value="sales"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6"
              >
                Comercial
              </TabsTrigger>
            )}
            {showPresales && (
              <TabsTrigger
                value="presales"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6"
              >
                Pré vendas
              </TabsTrigger>
            )}
            <TabsTrigger
              value="negocios"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
            >
              <Briefcase className="h-3.5 w-3.5" /> Negócios
            </TabsTrigger>
            <TabsTrigger
              value="atendimento"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Atendimento
            </TabsTrigger>
            <TabsTrigger
              value="atividades"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" /> Atividades
            </TabsTrigger>
            {/* Funis: visão geral de todos os funis por etapa — só gestão */}
            {isAdmin && (
              <TabsTrigger
                value="funnels"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" /> Funis
              </TabsTrigger>
            )}
            {/* Tráfego Pago: só gestão (master/admin/head) — SDR e Closer não veem */}
            {isAdmin && (
              <TabsTrigger
                value="traffic"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
              >
                <Megaphone className="h-3.5 w-3.5" /> Tráfego Pago
              </TabsTrigger>
            )}
            {/* Faturamento dos leads: leitura de carteira, só gestão */}
            {isAdmin && (
              <TabsTrigger
                value="leadrevenue"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 gap-1.5"
              >
                <Banknote className="h-3.5 w-3.5" /> Faturamento dos leads
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="visao" className="m-0 h-full">
            <VisaoGeralTab staffId={staffId} lockedStaffId={lockedStaffId} onNavigate={(tab) => {
              // só abre abas que o papel do usuário enxerga
              const ok = tab === "sales" ? showSales : tab === "presales" ? showPresales : ["funnels", "traffic", "leadrevenue"].includes(tab) ? isAdmin : true;
              setActiveTab(ok ? tab : "negocios");
            }} />
          </TabsContent>
          {showSales && (
            <TabsContent value="sales" className="m-0 h-full">
              <SalesIndicatorsTab staffId={staffId} staffRole={staffRole} />
            </TabsContent>
          )}
          {showPresales && (
            <TabsContent value="presales" className="m-0 h-full">
              <PreSalesIndicatorsTab staffId={staffId} staffRole={staffRole} />
            </TabsContent>
          )}
          <TabsContent value="negocios" className="m-0 h-full">
            <NegociosDashboardTab staffId={staffId} lockedStaffId={lockedStaffId} />
          </TabsContent>
          <TabsContent value="atendimento" className="m-0 h-full">
            <AtendimentoDashboardTab lockedStaffId={lockedStaffId} />
          </TabsContent>
          <TabsContent value="atividades" className="m-0 h-full">
            <AtividadesDashboardTab lockedStaffId={lockedStaffId} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="funnels" className="m-0 h-full">
              <FunnelsOverviewTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="traffic" className="m-0 h-full p-4">
              <CRMTrafficTab isAdmin={isAdmin} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="leadrevenue" className="m-0 h-full">
              <LeadRevenueTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};
