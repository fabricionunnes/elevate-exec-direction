import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, Plus } from "lucide-react";
import { CampaignsList } from "./CampaignsList";
import { CampaignForm } from "./CampaignForm";

interface EndomarketingPanelProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

export const EndomarketingPanel = ({ companyId, projectId, isAdmin }: EndomarketingPanelProps) => {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const handleEditCampaign = (campaignId: string) => {
    setEditingCampaignId(campaignId);
    setActiveTab("form");
  };

  const handleCreateCampaign = () => {
    setEditingCampaignId(null);
    setActiveTab("form");
  };

  const handleFormClose = () => {
    setEditingCampaignId(null);
    setActiveTab("campaigns");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Endomarketing</h2>
        <p className="text-sm text-muted-foreground">
          Campanhas de incentivo e gamificação para o time comercial
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="form" className="gap-2">
              <Plus className="h-4 w-4" />
              {editingCampaignId ? "Editar Campanha" : "Nova Campanha"}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <CampaignsList
            companyId={companyId}
            projectId={projectId}
            isAdmin={isAdmin}
            onEditCampaign={handleEditCampaign}
            onCreateCampaign={handleCreateCampaign}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="form" className="mt-6">
            <CampaignForm
              companyId={companyId}
              projectId={projectId}
              campaignId={editingCampaignId}
              onClose={handleFormClose}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
