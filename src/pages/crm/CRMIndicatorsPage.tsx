import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesIndicatorsTab } from "@/components/crm/indicators/SalesIndicatorsTab";
import { PreSalesIndicatorsTab } from "@/components/crm/indicators/PreSalesIndicatorsTab";

export const CRMIndicatorsPage = () => {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <div className="flex flex-col h-full">
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
            <SalesIndicatorsTab />
          </TabsContent>
          <TabsContent value="presales" className="m-0 h-full">
            <PreSalesIndicatorsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
