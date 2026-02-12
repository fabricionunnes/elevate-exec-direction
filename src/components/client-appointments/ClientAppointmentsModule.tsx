import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Users,
  Scissors,
  UserCog,
  Building,
  Settings,
  BarChart3,
  Lock,
} from "lucide-react";
import { useAppointmentPermissions } from "./useAppointmentPermissions";
import { AppointmentAgendaPanel } from "./AppointmentAgendaPanel";
import { AppointmentClientsPanel } from "./AppointmentClientsPanel";
import { AppointmentServicesPanel } from "./AppointmentServicesPanel";
import { AppointmentProfessionalsPanel } from "./AppointmentProfessionalsPanel";
import { AppointmentResourcesPanel } from "./AppointmentResourcesPanel";
import { AppointmentSettingsPanel } from "./AppointmentSettingsPanel";
import { AppointmentReportsPanel } from "./AppointmentReportsPanel";
import type { AppointmentViewType } from "./types";

interface Props {
  projectId: string;
  userRole?: string;
}

export function ClientAppointmentsModule({ projectId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<AppointmentViewType>("agenda");
  const { canEdit, isReadOnly } = useAppointmentPermissions(userRole);

  const tabs = [
    { id: "agenda" as AppointmentViewType, label: "Agenda", icon: CalendarDays },
    { id: "clients" as AppointmentViewType, label: "Clientes", icon: Users },
    { id: "services" as AppointmentViewType, label: "Serviços", icon: Scissors },
    { id: "professionals" as AppointmentViewType, label: "Profissionais", icon: UserCog },
    { id: "resources" as AppointmentViewType, label: "Recursos", icon: Building },
    { id: "reports" as AppointmentViewType, label: "Relatórios", icon: BarChart3 },
    { id: "settings" as AppointmentViewType, label: "Configurações", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Lock className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Modo somente leitura – Apenas o cliente pode editar agendamentos
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppointmentViewType)} className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="agenda" className="mt-0">
          <AppointmentAgendaPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="clients" className="mt-0">
          <AppointmentClientsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="services" className="mt-0">
          <AppointmentServicesPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="professionals" className="mt-0">
          <AppointmentProfessionalsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="resources" className="mt-0">
          <AppointmentResourcesPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <AppointmentReportsPanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="settings" className="mt-0">
          <AppointmentSettingsPanel projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
