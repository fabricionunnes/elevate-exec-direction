import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Gift } from "lucide-react";
import { GamificationConfigTab } from "./GamificationConfigTab";
import { GamificationMissionsTab } from "./GamificationMissionsTab";

interface GamificationPanelProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

export const GamificationPanel = ({ companyId, projectId, isAdmin }: GamificationPanelProps) => {
  const [activeTab, setActiveTab] = useState("config");

  if (!companyId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Este projeto precisa estar vinculado a uma empresa para usar a gamificação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">🎮 Gamificação do Time</h2>
        <p className="text-muted-foreground">
          Configure as regras do jogo, missões, badges e recompensas para engajar seu time comercial.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="missions" className="gap-2">
            <Gift className="h-4 w-4" />
            Missões & Recompensas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <GamificationConfigTab
            companyId={companyId}
            projectId={projectId}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="missions" className="mt-6">
          <GamificationMissionsTab
            companyId={companyId}
            projectId={projectId}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
