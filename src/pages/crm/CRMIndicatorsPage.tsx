import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SalesIndicatorsTab } from "@/components/crm/indicators/SalesIndicatorsTab";
import { PreSalesIndicatorsTab } from "@/components/crm/indicators/PreSalesIndicatorsTab";
import { CRMCommissionCard } from "@/components/crm/CRMCommissionCard";
import { DollarSign, ChevronDown } from "lucide-react";

export const CRMIndicatorsPage = () => {
  const { staffRole, staffId } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
  const [activeTab, setActiveTab] = useState("sales");
  const [commissionOpen, setCommissionOpen] = useState(false);
  const isMaster = staffRole === "master";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";

  return (
    <div className="flex flex-col h-full">
      {/* Commission Card - Collapsible */}
      {(staffRole === "closer" || staffRole === "sdr" || isMaster) && (
        <div className="px-4 pt-4">
          <Collapsible open={commissionOpen} onOpenChange={setCommissionOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{isMaster ? "Remuneração da Equipe" : "Sua Remuneração"}</p>
                    <p className="text-[11px] text-muted-foreground">Toque para {commissionOpen ? "recolher" : "expandir"}</p>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${commissionOpen ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <CRMCommissionCard staffId={staffId} staffRole={staffRole} isMaster={isMaster} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border bg-card px-4">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger 
              value="sales" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6"
            >
              Comercial
            </TabsTrigger>
            <TabsTrigger 
              value="presales"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6"
            >
              Pré vendas
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="sales" className="m-0 h-full">
            <SalesIndicatorsTab staffId={staffId} staffRole={staffRole} />
          </TabsContent>
          <TabsContent value="presales" className="m-0 h-full">
            <PreSalesIndicatorsTab staffId={staffId} staffRole={staffRole} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
