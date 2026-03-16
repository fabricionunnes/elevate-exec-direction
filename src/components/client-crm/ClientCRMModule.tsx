import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useClientPermissions } from "@/hooks/useClientPermissions";
import { CLIENT_MENU_KEYS, OnboardingUser } from "@/types/onboarding";
import {
  BarChart3,
  Briefcase,
  Users,
  CalendarCheck,
  MessageCircle,
  FileText,
  FileSignature,
} from "lucide-react";

interface ClientCRMModuleProps {
  projectId: string;
  currentUser: OnboardingUser | null;
}

export const ClientCRMModule = ({ projectId, currentUser }: ClientCRMModuleProps) => {
  const { hasPermission } = useClientPermissions(projectId);

  const tabs = [
    { key: CLIENT_MENU_KEYS.crm_comercial_dashboard, id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: CLIENT_MENU_KEYS.crm_comercial_negocios, id: "negocios", label: "Negócios", icon: Briefcase },
    { key: CLIENT_MENU_KEYS.crm_comercial_contatos, id: "contatos", label: "Contatos", icon: Users },
    { key: CLIENT_MENU_KEYS.crm_comercial_atividades, id: "atividades", label: "Atividades", icon: CalendarCheck },
    { key: CLIENT_MENU_KEYS.crm_comercial_atendimentos, id: "atendimentos", label: "Atendimentos", icon: MessageCircle },
    { key: CLIENT_MENU_KEYS.crm_comercial_transcricoes, id: "transcricoes", label: "Transcrições", icon: FileText },
    { key: CLIENT_MENU_KEYS.crm_comercial_contratos, id: "contratos", label: "Contratos", icon: FileSignature },
  ].filter((tab) => hasPermission(tab.key));

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "dashboard");

  if (tabs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum módulo do CRM está habilitado para este projeto.
        </CardContent>
      </Card>
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
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Dashboard do CRM</h3>
              <p className="text-sm">Visão geral dos seus negócios e métricas de vendas.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negocios">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Negócios</h3>
              <p className="text-sm">Gerencie seu pipeline de vendas e oportunidades.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contatos">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Contatos</h3>
              <p className="text-sm">Base de contatos e leads do seu negócio.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividades">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Atividades</h3>
              <p className="text-sm">Tarefas e follow-ups comerciais.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atendimentos">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Atendimentos</h3>
              <p className="text-sm">Conecte sua instância do WhatsApp e gerencie conversas com clientes.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve — você poderá conectar sua própria instância aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcricoes">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Transcrições</h3>
              <p className="text-sm">Transcrições de reuniões e chamadas comerciais.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">Contratos</h3>
              <p className="text-sm">Gerencie propostas e contratos comerciais.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
