import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesIndicatorsTab } from "@/components/crm/indicators/SalesIndicatorsTab";
import { PreSalesIndicatorsTab } from "@/components/crm/indicators/PreSalesIndicatorsTab";
import { CRMCommissionCard } from "@/components/crm/CRMCommissionCard";

export const CRMIndicatorsPage = () => {
  const { staffRole, staffId } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
  const [activeTab, setActiveTab] = useState("sales");
  const isMaster = staffRole === "master";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";

  return (
    <div className="flex flex-col h-full">
      {/* Commission Card - Prominent at top */}
      {(staffRole === "closer" || staffRole === "sdr" || isMaster) && (
        <div className="px-4 pt-4">
          <CRMCommissionCard staffId={staffId} staffRole={staffRole} isMaster={isMaster} />
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
