import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useClientPermissions } from "@/hooks/useClientPermissions";
import { CLIENT_MENU_KEYS, OnboardingUser } from "@/types/onboarding";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useClientCRM } from "./hooks/useClientCRM";
import { useClientCRMPipeline } from "./hooks/useClientCRMPipeline";
import { ClientCRMDashboard } from "./ClientCRMDashboard";
import { ClientCRMPipelinePage } from "./ClientCRMPipelinePage";
import { ClientCRMOriginsSidebar } from "./ClientCRMOriginsSidebar";
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
  const { hasPermission, currentUser: clientUser } = useClientPermissions(projectId);
  const { isMaster } = useStaffPermissions();
  const crm = useClientCRM(projectId);
  const pipeline = useClientCRMPipeline(projectId);
  const isVendedor = clientUser?.role === "vendedor";
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(isVendedor ? clientUser!.id : "all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Vendedor: força filtro por si mesmo (não pode ver dados de outros)
  useEffect(() => {
    if (isVendedor && clientUser?.id) {
      setSelectedOwnerId(clientUser.id);
    }
  }, [isVendedor, clientUser?.id]);

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

  if (crm.loading && pipeline.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPipelineTab = activeTab === "negocios";

  return (
    <div className="space-y-0">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            CRM Comercial
          </h2>
          <p className="text-xs text-muted-foreground">Gerencie seus negócios, contatos e atividades comerciais</p>
        </div>
        {!isPipelineTab && !isVendedor && owners.length > 0 && (
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
        {isVendedor && (
          <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-md bg-muted">
            Visualizando apenas seus dados
          </span>
        )}
      </div>

      <div className="px-4">
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

          <TabsContent value="negocios" className="mt-0 -mx-4">
            <div className="flex h-[calc(100vh-200px)] min-h-[500px]">
              <ClientCRMOriginsSidebar
                projectId={projectId}
                originGroups={pipeline.originGroups}
                origins={pipeline.origins}
                pipelines={pipeline.pipelines}
                selectedOrigin={pipeline.selectedOrigin}
                selectedPipeline={pipeline.selectedPipeline}
                onSelectOrigin={pipeline.setSelectedOrigin}
                onSelectPipeline={pipeline.setSelectedPipeline}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
              <div className="flex-1 min-w-0">
                <ClientCRMPipelinePage
                  projectId={projectId}
                  pipelines={pipeline.pipelines}
                  stages={pipeline.stages}
                  leads={pipeline.leads}
                  loading={pipeline.loading}
                  selectedPipeline={pipeline.selectedPipeline}
                  selectedOrigin={pipeline.selectedOrigin}
                  tagOptions={pipeline.tagOptions}
                  ownerOptions={pipeline.ownerOptions}
                  originOptions={pipeline.originOptions}
                  forecastData={pipeline.forecastData}
                  negotiationData={pipeline.negotiationData}
                  onCreateLead={pipeline.createLead}
                  onMoveLeadToStage={pipeline.moveLeadToStage}
                  onRefresh={pipeline.loadStagesAndLeads}
                />
              </div>
            </div>
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
    </div>
  );
};
