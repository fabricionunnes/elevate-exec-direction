import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ClientCRMMeetings } from "./ClientCRMMeetings";
import { ClientCRMApiDocs } from "./ClientCRMApiDocs";
import {
  BarChart3, Briefcase, Users, CalendarCheck, MessageCircle, FileText, FileSignature, Settings, Code2, Video,
} from "lucide-react";

interface ClientCRMModuleProps {
  projectId: string;
  currentUser: OnboardingUser | null;
}

export const ClientCRMModule = ({ projectId, currentUser }: ClientCRMModuleProps) => {
  const { hasPermission } = useClientPermissions(projectId);
  const { isMaster } = useStaffPermissions();
  const crm = useClientCRM(projectId);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");

  const tabs = [
    { key: CLIENT_MENU_KEYS.crm_comercial_dashboard, id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: CLIENT_MENU_KEYS.crm_comercial_negocios, id: "negocios", label: "Negócios", icon: Briefcase },
    { key: CLIENT_MENU_KEYS.crm_comercial_contatos, id: "contatos", label: "Contatos", icon: Users },
    { key: CLIENT_MENU_KEYS.crm_comercial_atividades, id: "atividades", label: "Atividades", icon: CalendarCheck },
    { key: CLIENT_MENU_KEYS.crm_comercial_atendimentos, id: "atendimentos", label: "Atendimentos", icon: MessageCircle },
    { key: CLIENT_MENU_KEYS.crm_comercial_transcricoes, id: "transcricoes", label: "Transcrições", icon: FileText },
    { key: CLIENT_MENU_KEYS.crm_comercial_contratos, id: "contratos", label: "Contratos", icon: FileSignature },
    { key: CLIENT_MENU_KEYS.crm_comercial_reunioes, id: "reunioes", label: "Reuniões", icon: Video },
  ].filter((tab) => hasPermission(tab.key));

  // Always show settings tab
  const allTabs = [
    ...tabs,
    { key: "settings" as any, id: "settings", label: "Configurações", icon: Settings },
    ...(isMaster ? [{ key: "api" as any, id: "api", label: "API", icon: Code2 }] : []),
  ];

  const [activeTab, setActiveTab] = useState(allTabs[0]?.id || "dashboard");

  // Extract unique owners from deals
  const owners = useMemo(() => {
    const ownerMap = new Map<string, string>();
    crm.deals.forEach((d) => {
      if (d.owner_id && d.owner) {
        ownerMap.set(d.owner_id, (d.owner as any).name || "Sem nome");
      }
    });
    return Array.from(ownerMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [crm.deals]);

  // Filter deals and activities by selected owner
  const filteredDeals = useMemo(() => {
    if (selectedOwnerId === "all") return crm.deals;
    return crm.deals.filter((d) => d.owner_id === selectedOwnerId);
  }, [crm.deals, selectedOwnerId]);

  const filteredActivities = useMemo(() => {
    if (selectedOwnerId === "all") return crm.activities;
    const ownerDealIds = new Set(filteredDeals.map((d) => d.id));
    return crm.activities.filter((a) => a.deal_id && ownerDealIds.has(a.deal_id));
  }, [crm.activities, filteredDeals, selectedOwnerId]);

  if (allTabs.length === 1 && allTabs[0].id === "settings") {
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            CRM Comercial
          </h2>
          <p className="text-xs text-muted-foreground">Gerencie seus negócios, contatos e atividades comerciais</p>
        </div>
        {owners.length > 0 && (
          <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
          <ClientCRMDashboard deals={filteredDeals} contacts={crm.contacts} activities={filteredActivities} stages={crm.stages} />
        </TabsContent>

        <TabsContent value="negocios">
          <ClientCRMDeals
            deals={filteredDeals}
            stages={crm.stages}
            contacts={crm.contacts}
            pipelines={crm.pipelines}
            activePipelineId={crm.activePipelineId}
            setActivePipelineId={(id) => { crm.setActivePipelineId(id); crm.fetchAll(); }}
            activities={filteredActivities}
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
            projectId={projectId}
            pipelines={crm.pipelines}
            stages={crm.stages}
            activePipelineId={crm.activePipelineId}
            onCreateContact={crm.createContact}
            onUpdateContact={crm.updateContact}
            onDeleteContact={crm.deleteContact}
            onRefresh={crm.fetchAll}
          />
        </TabsContent>

        <TabsContent value="atividades">
          <ClientCRMActivities
            activities={filteredActivities}
            deals={filteredDeals}
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

        <TabsContent value="reunioes">
          <ClientCRMMeetings
            projectId={projectId}
            currentUser={currentUser}
            stages={crm.stages}
            onMoveDeal={crm.moveDealToStage}
            onRefresh={crm.fetchAll}
          />
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
