import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, Plus } from "lucide-react";
import { CampaignsList } from "./CampaignsList";
import { CampaignForm } from "./CampaignForm";
import { BalloonCampaignsList } from "./BalloonCampaignsList";
import { BalloonCampaignForm } from "./BalloonCampaignForm";
import { BalloonPopGame } from "./BalloonPopGame";

interface EndomarketingPanelProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

export const EndomarketingPanel = ({ companyId, projectId, isAdmin }: EndomarketingPanelProps) => {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editingBalloonId, setEditingBalloonId] = useState<string | null>(null);
  const [playingBalloonId, setPlayingBalloonId] = useState<string | null>(null);

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

  const handleEditBalloon = (id: string) => {
    setEditingBalloonId(id);
    setActiveTab("balloon-form");
  };

  const handleCreateBalloon = () => {
    setEditingBalloonId(null);
    setActiveTab("balloon-form");
  };

  const handleBalloonFormClose = () => {
    setEditingBalloonId(null);
    setActiveTab("balloons");
  };

  const handlePlayBalloon = (id: string) => {
    setPlayingBalloonId(id);
    setActiveTab("balloon-play");
  };

  const handlePlayClose = () => {
    setPlayingBalloonId(null);
    setActiveTab("balloons");
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
          <TabsTrigger value="balloons" className="gap-2">
            🎈 Balões
          </TabsTrigger>
          {isAdmin && activeTab === "form" && (
            <TabsTrigger value="form" className="gap-2">
              <Plus className="h-4 w-4" />
              {editingCampaignId ? "Editar Campanha" : "Nova Campanha"}
            </TabsTrigger>
          )}
          {isAdmin && activeTab === "balloon-form" && (
            <TabsTrigger value="balloon-form" className="gap-2">
              🎈 {editingBalloonId ? "Editar" : "Nova"} Balões
            </TabsTrigger>
          )}
          {activeTab === "balloon-play" && (
            <TabsTrigger value="balloon-play" className="gap-2">
              🎈 Jogar
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

        <TabsContent value="balloons" className="mt-6">
          <BalloonCampaignsList
            projectId={projectId}
            isAdmin={isAdmin}
            onEdit={handleEditBalloon}
            onCreate={handleCreateBalloon}
            onPlay={handlePlayBalloon}
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

        {isAdmin && (
          <TabsContent value="balloon-form" className="mt-6">
            <BalloonCampaignForm
              companyId={companyId}
              projectId={projectId}
              campaignId={editingBalloonId}
              onClose={handleBalloonFormClose}
            />
          </TabsContent>
        )}

        <TabsContent value="balloon-play" className="mt-6">
          {playingBalloonId && (
            <BalloonPopGame
              campaignId={playingBalloonId}
              projectId={projectId}
              companyId={companyId}
              isAdmin={isAdmin}
              onClose={handlePlayClose}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
