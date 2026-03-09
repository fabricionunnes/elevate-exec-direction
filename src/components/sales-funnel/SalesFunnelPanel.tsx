import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FunnelListView } from "./FunnelListView";
import { FunnelTemplateLibrary } from "./FunnelTemplateLibrary";
import { FunnelCanvas } from "./FunnelCanvas";
import { FunnelRevenueSimulator } from "./FunnelRevenueSimulator";
import { FunnelCustomerJourney } from "./FunnelCustomerJourney";
import { LayoutList, Library, Filter as FunnelIcon, DollarSign, Route } from "lucide-react";

interface SalesFunnelPanelProps {
  projectId: string;
  companyId?: string;
  companySegment?: string | null;
  isStaff: boolean;
  canEdit: boolean;
}

export function SalesFunnelPanel({ projectId, companyId, companySegment, isStaff, canEdit }: SalesFunnelPanelProps) {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  const handleOpenFunnel = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setActiveTab("canvas");
  };

  const handleBackToList = () => {
    setSelectedFunnelId(null);
    setActiveTab("list");
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
            <LayoutList className="h-3.5 w-3.5" />
            Meus Funis
          </TabsTrigger>
          {selectedFunnelId && (
            <TabsTrigger value="canvas" className="gap-1.5 text-xs sm:text-sm">
              <FunnelIcon className="h-3.5 w-3.5" />
              Canvas Visual
            </TabsTrigger>
          )}
          {selectedFunnelId && (
            <TabsTrigger value="simulator" className="gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-3.5 w-3.5" />
              Simulador
            </TabsTrigger>
          )}
          <TabsTrigger value="journey" className="gap-1.5 text-xs sm:text-sm">
            <Route className="h-3.5 w-3.5" />
            Jornada
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 text-xs sm:text-sm">
            <Library className="h-3.5 w-3.5" />
            Biblioteca
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <FunnelListView
            projectId={projectId}
            canEdit={canEdit}
            onOpenFunnel={handleOpenFunnel}
          />
        </TabsContent>

        {selectedFunnelId && (
          <TabsContent value="canvas">
            <FunnelCanvas
              funnelId={selectedFunnelId}
              projectId={projectId}
              canEdit={canEdit}
              onBack={handleBackToList}
            />
          </TabsContent>
        )}

        {selectedFunnelId && (
          <TabsContent value="simulator">
            <FunnelRevenueSimulator
              funnelId={selectedFunnelId}
            />
          </TabsContent>
        )}

        <TabsContent value="journey">
          <FunnelCustomerJourney projectId={projectId} />
        </TabsContent>

        <TabsContent value="templates">
          <FunnelTemplateLibrary
            projectId={projectId}
            canEdit={canEdit}
            onFunnelCreated={(id) => handleOpenFunnel(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
