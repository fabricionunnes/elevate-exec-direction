import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useClientPermissions } from "@/hooks/useClientPermissions";
import { CLIENT_MENU_KEYS, OnboardingUser } from "@/types/onboarding";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useClientCRM } from "./hooks/useClientCRM";
import { ClientCRMDashboard } from "./ClientCRMDashboard";
import { ClientCRMDeals } from "./ClientCRMDeals";
import { ClientCRMContacts } from "./ClientCRMContacts";
import { ClientCRMActivities } from "./ClientCRMActivities";
import { ClientCRMAtendimentos } from "./ClientCRMAtendimentos";
import { ClientCRMTranscriptions } from "./ClientCRMTranscriptions";
import { ClientCRMContracts } from "./ClientCRMContracts";
import { ClientCRMSettings } from "./ClientCRMSettings";
import { ClientCRMApiDocs } from "./ClientCRMApiDocs";
import {
  BarChart3, Briefcase, Users, CalendarCheck, MessageCircle, FileText, FileSignature, Settings, Code2,
} from "lucide-react";

interface ClientCRMModuleProps {
  projectId: string;
  currentUser: OnboardingUser | null;
}

export const ClientCRMModule = ({ projectId, currentUser }: ClientCRMModuleProps) => {
  const { hasPermission } = useClientPermissions(projectId);
  const { isMaster } = useStaffPermissions();
  const crm = useClientCRM(projectId);

  const tabs = [
    { key: CLIENT_MENU_KEYS.crm_comercial_dashboard, id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: CLIENT_MENU_KEYS.crm_comercial_negocios, id: "negocios", label: "Negócios", icon: Briefcase },
    { key: CLIENT_MENU_KEYS.crm_comercial_contatos, id: "contatos", label: "Contatos", icon: Users },
    { key: CLIENT_MENU_KEYS.crm_comercial_atividades, id: "atividades", label: "Atividades", icon: CalendarCheck },
    { key: CLIENT_MENU_KEYS.crm_comercial_atendimentos, id: "atendimentos", label: "Atendimentos", icon: MessageCircle },
    { key: CLIENT_MENU_KEYS.crm_comercial_transcricoes, id: "transcricoes", label: "Transcrições", icon: FileText },
    { key: CLIENT_MENU_KEYS.crm_comercial_contratos, id: "contratos", label: "Contratos", icon: FileSignature },
  ].filter((tab) => hasPermission(tab.key));

  // Always show settings tab
  const allTabs = [
    ...tabs,
    { key: "settings" as any, id: "settings", label: "Configurações", icon: Settings },
    ...(isMaster ? [{ key: "api" as any, id: "api", label: "API", icon: Code2 }] : []),
  ];

  const [activeTab, setActiveTab] = useState(allTabs[0]?.id || "dashboard");

  if (allTabs.length === 1 && allTabs[0].id === "settings") {
    // Only settings visible means no CRM modules enabled
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum módulo do CRM está habilitado para este projeto.
        </CardContent>
      </Card>
    );
  }

  if (crm.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          CRM Comercial
        </h2>
        <p className="text-xs text-muted-foreground">Gerencie seus negócios, contatos e atividades comerciais</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {allTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <ClientCRMDashboard deals={crm.deals} contacts={crm.contacts} activities={crm.activities} stages={crm.stages} />
        </TabsContent>

        <TabsContent value="negocios">
          <ClientCRMDeals
            deals={crm.deals}
            stages={crm.stages}
            contacts={crm.contacts}
            pipelines={crm.pipelines}
            activePipelineId={crm.activePipelineId}
            setActivePipelineId={(id) => { crm.setActivePipelineId(id); crm.fetchAll(); }}
            activities={crm.activities}
            projectId={projectId}
            onCreateDeal={crm.createDeal}
            onUpdateDeal={crm.updateDeal}
            onDeleteDeal={crm.deleteDeal}
            onMoveDeal={crm.moveDealToStage}
            onCreateActivity={crm.createActivity}
            onCompleteActivity={crm.completeActivity}
            onRefresh={crm.fetchAll}
          />
        </TabsContent>

        <TabsContent value="contatos">
          <ClientCRMContacts
            contacts={crm.contacts}
            onCreateContact={crm.createContact}
            onUpdateContact={crm.updateContact}
            onDeleteContact={crm.deleteContact}
          />
        </TabsContent>

        <TabsContent value="atividades">
          <ClientCRMActivities
            activities={crm.activities}
            deals={crm.deals}
            contacts={crm.contacts}
            onCreateActivity={crm.createActivity}
            onCompleteActivity={crm.completeActivity}
            onDeleteActivity={crm.deleteActivity}
          />
        </TabsContent>

        <TabsContent value="atendimentos">
          <ClientCRMAtendimentos projectId={projectId} />
        </TabsContent>

        <TabsContent value="transcricoes">
          <ClientCRMTranscriptions />
        </TabsContent>

        <TabsContent value="contratos">
          <ClientCRMContracts />
        </TabsContent>

        <TabsContent value="settings">
          <ClientCRMSettings
            projectId={projectId}
            pipelines={crm.pipelines}
            stages={crm.stages}
            activePipelineId={crm.activePipelineId}
            setActivePipelineId={crm.setActivePipelineId}
            onRefresh={crm.fetchAll}
          />
        </TabsContent>

        {isMaster && (
          <TabsContent value="api">
            <ClientCRMApiDocs />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
